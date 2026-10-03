import { useState, useEffect } from "react";
import { ListSkeleton } from "@/components/skeletons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchBar, ActionButton, StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { useToast } from "@/hooks/use-toast";
import { useAdminAction } from "@/hooks/useAdminAction";
import { Store, Star, ExternalLink, Download, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { toKenyanIntl, formatKenyanPhone } from "@/lib/phone";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VendorDetails {
  id: string;
  full_name: string | null;
  store_name: string | null;
  email: string | null;
  // The number buyers get once they order (Contact Vendor button, pickup email).
  whatsapp_number: string | null;
  store_phone: string | null;
  vendor_address_line1: string | null;
  vendor_address_line2: string | null;
  vendor_city: string | null;
  vendor_county: string | null;
  created_at: string;
  kyc_status?: string | null;
  rating?: number;
  total_sales?: number;
  status: string;
}

const AdminVendors = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { adminAction } = useAdminAction();
  const [vendors, setVendors] = useState<VendorDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [confirmState, setConfirmState] = useState<{
    type: "penalize" | "revoke" | "restore" | null;
    vendor: VendorDetails | null;
  }>({ type: null, vendor: null });

  const loadVendors = async () => {
    setLoading(true);
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["vendor", "revoked_vendor"]);

      if (rolesError) throw rolesError;

      const roleByVendorId = new Map((roles || []).map(r => [r.user_id, r.role]));
      const allVendorIds = Array.from(roleByVendorId.keys());

      if (allVendorIds.length === 0) {
        setVendors([]);
        return;
      }

      const [{ data: profiles, error: profilesError }, { data: ratingStats }, { data: completedOrders }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, store_name, email, whatsapp_number, store_phone, vendor_address_line1, vendor_address_line2, vendor_city, vendor_county, created_at, kyc_status").in("id", allVendorIds),
        supabase.from("vendor_rating_stats").select("vendor_id, avg_rating, rating_count").in("vendor_id", allVendorIds),
        supabase.from("orders").select("vendor_id").eq("status", "completed").in("vendor_id", allVendorIds),
      ]);

      if (profilesError) throw profilesError;

      const ratingByVendorId = new Map((ratingStats || []).map(r => [r.vendor_id, r]));
      const salesCountByVendorId = new Map<string, number>();
      (completedOrders || []).forEach(o => {
        salesCountByVendorId.set(o.vendor_id, (salesCountByVendorId.get(o.vendor_id) || 0) + 1);
      });

      const vendorsData = (profiles || []).map((profile) => {
        const stats = ratingByVendorId.get(profile.id);
        return {
          ...profile,
          rating: stats ? Number(stats.avg_rating) : 5.0,
          total_sales: salesCountByVendorId.get(profile.id) || 0,
          status: roleByVendorId.get(profile.id) === "revoked_vendor" ? "revoked" : "active",
        };
      });

      // Sellers waiting on a verification review float to the top.
      vendorsData.sort((a, b) => Number(b.kyc_status === "pending") - Number(a.kyc_status === "pending"));
      setVendors(vendorsData);
    } catch (error) {
      console.error("Error loading vendors:", error);
      toast({ title: "Error", description: "Failed to load vendors", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadVendors();
    }
  }, [user]);

  const handleAction = async () => {
    const { type, vendor } = confirmState;
    if (!type || !vendor) return;

    const actionMap: Record<string, string> = {
      "penalize": "penalize_vendor",
      "revoke": "revoke_vendor",
      "restore": "restore_vendor",
    };

    const action = actionMap[type];
    if (action) {
      const ok = await adminAction(action, vendor.id);
      if (ok) loadVendors();
    }
    
    setConfirmState({ type: null, vendor: null });
  };

  const filteredVendors = vendors.filter(v => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const text = [v.full_name, v.store_name, v.email, v.vendor_city, v.vendor_county]
      .filter(Boolean).join(" ").toLowerCase();
    // Match phone searches regardless of format: "0712 345", "+254712", "712345" all hit.
    const qDigits = q.replace(/\D/g, "").replace(/^(254|0)/, "");
    const phoneHit = qDigits.length >= 3 && [v.whatsapp_number, v.store_phone]
      .some(p => toKenyanIntl(p).includes(qDigits));
    return text.includes(q) || v.id.includes(q) || phoneHit;
  });

  const exportContacts = () => {
    const cell = (val: string | number | null | undefined) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const header = ["Store", "Owner", "Email", "WhatsApp (shown to buyers)", "Store phone (public)", "Address line 1", "Address line 2", "City", "County", "Status", "Verification", "Completed sales", "Joined"];
    const rows = filteredVendors.map(v => [
      v.store_name, v.full_name, v.email, v.whatsapp_number, v.store_phone,
      v.vendor_address_line1, v.vendor_address_line2, v.vendor_city, v.vendor_county,
      v.status, v.kyc_status, v.total_sales, v.created_at.slice(0, 10),
    ]);
    // BOM so Excel opens it as UTF-8 instead of mangling non-ASCII store names.
    const csv = "﻿" + [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `solely-vendor-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingReviews = vendors.filter(v => v.kyc_status === "pending").length;

  return (
    <AdminLayout pageTitle="Vendors">
      {pendingReviews > 0 && (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
          {pendingReviews} {pendingReviews === 1 ? "seller is" : "sellers are"} waiting for a verification review. They're at the top of the list.
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <SearchBar
            placeholder="Name, phone, email, town..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={exportContacts}
          disabled={loading || filteredVendors.length === 0}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:bg-muted transition disabled:opacity-50 disabled:pointer-events-none"
          title="Download the contacts of the vendors shown below as a spreadsheet"
        >
          <Download size={13} strokeWidth={1.75} />
          <span className="hidden sm:inline">Export contacts</span>
          <span className="sm:hidden">CSV</span>
        </button>
      </div>

      {loading ? (
        <ListSkeleton rows={8} />
      ) : filteredVendors.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-soft">
          <EmptyState 
            icon={Store}
            title="No vendors yet"
            subtitle="Registered vendors will appear here"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-soft divide-y divide-border">
          {filteredVendors.map(v => (
            <div key={v.id} className="flex flex-col gap-2.5 px-4 py-3 hover:bg-muted/40 transition-colors sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center text-xs font-medium text-primary">
                  {(v.store_name || v.full_name || "V")[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link to={`/admin/vendors/${v.id}`} className="text-sm font-medium text-foreground truncate hover:text-primary transition-colors">
                      {v.store_name || v.full_name || "Unknown Vendor"}
                    </Link>
                    <span className="ml-auto shrink-0"><StatusPill status={v.status} /></span>
                  </div>
                  {v.store_name && v.full_name && (
                    <p className="text-[11px] text-muted-foreground truncate">{v.full_name}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                    {v.whatsapp_number ? (
                      <a
                        href={`tel:+${toKenyanIntl(v.whatsapp_number)}`}
                        className="inline-flex items-center gap-1 text-foreground hover:text-primary whitespace-nowrap"
                      >
                        <Phone size={11} strokeWidth={1.75} />
                        {formatKenyanPhone(v.whatsapp_number)}
                      </a>
                    ) : (
                      <span className="italic whitespace-nowrap">No contact number</span>
                    )}
                    {v.vendor_city && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="whitespace-nowrap">{v.vendor_city}</span>
                      </>
                    )}
                  </div>
                  {v.kyc_status === "pending" && (
                    <Link to={`/admin/vendors/${v.id}`} className="mt-1 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                      Review verification
                    </Link>
                  )}
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="whitespace-nowrap">{v.total_sales} {v.total_sales === 1 ? "sale" : "sales"}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                      <Star size={10} className="text-primary fill-primary" />
                      {v.rating?.toFixed(1) || "5.0"}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <Link
                      to={`/store/${v.id}`}
                      className="text-primary hover:underline inline-flex items-center gap-0.5 whitespace-nowrap"
                    >
                      <ExternalLink size={10} />
                      Store
                    </Link>
                  </div>
                </div>
              </div>

              {/* Actions: own line on phones so they don't squeeze the details */}
              <div className="flex items-center gap-1.5 flex-shrink-0 pl-12 sm:pl-0">
                {v.status !== "revoked" ? (
                  <>
                    <ActionButton
                      label="Penalize"
                      onClick={() => setConfirmState({ type: "penalize", vendor: v })}
                    />
                    <ActionButton
                      label="Revoke"
                      variant="danger"
                      onClick={() => setConfirmState({ type: "revoke", vendor: v })}
                    />
                  </>
                ) : (
                  <ActionButton
                    label="Restore"
                    onClick={() => setConfirmState({ type: "restore", vendor: v })}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmState.type} onOpenChange={(open) => !open && setConfirmState({ type: null, vendor: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmState.type === "penalize" && `Penalize ${confirmState.vendor?.full_name}?`}
              {confirmState.type === "revoke" && `Revoke ${confirmState.vendor?.full_name}'s privileges?`}
              {confirmState.type === "restore" && `Restore ${confirmState.vendor?.full_name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmState.type === "penalize" && "This will inject a 1-star rating and affect their ranking."}
              {confirmState.type === "revoke" && "They will be immediately banned from listing items."}
              {confirmState.type === "restore" && "They will regain their ability to list and sell items."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={cn(
                confirmState.type === "penalize" || confirmState.type === "revoke" 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {confirmState.type === "penalize" && "Yes, penalize"}
              {confirmState.type === "revoke" && "Yes, revoke access"}
              {confirmState.type === "restore" && "Yes, restore access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminVendors;
