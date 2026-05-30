import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchBar, ActionButton, StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { useToast } from "@/hooks/use-toast";
import { Store, Star } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { SneakerLoader } from "@/components/ui/SneakerLoader";

interface VendorDetails {
  id: string;
  full_name: string | null;
  created_at: string;
  rating?: number;
  total_sales?: number;
  status: string;
}

const AdminVendors = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
        .select("user_id, role");

      if (rolesError) throw rolesError;
      
      const vendorRoles = roles?.filter(r => r.role === "vendor") || [];
      const revokedRoles = roles?.filter(r => r.role === "revoked_vendor") || [];
      
      const activeVendorIds = vendorRoles.map(r => r.user_id);
      const revokedVendorIds = revokedRoles.map(r => r.user_id);
      const allVendorIds = [...activeVendorIds, ...revokedVendorIds];

      if (allVendorIds.length === 0) {
        setVendors([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, created_at")
        .in("id", allVendorIds);

      if (profilesError) throw profilesError;

      const vendorsData = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: ratings } = await supabase
            .from("vendor_ratings")
            .select("rating")
            .eq("vendor_id", profile.id);
          
          let avgRating = 5.0;
          if (ratings && ratings.length > 0) {
            avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
          }

          const { count: salesCount } = await supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("vendor_id", profile.id)
            .eq("status", "completed");

          const isRevoked = revokedVendorIds.includes(profile.id);

          return {
            ...profile,
            rating: avgRating,
            total_sales: salesCount || 0,
            status: isRevoked ? "revoked" : "active"
          };
        })
      );

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

    try {
      if (type === "penalize") {
        const { error } = await supabase.from("vendor_ratings").insert({
          vendor_id: vendor.id,
          buyer_id: user?.id,
          rating: 1,
          review_text: "System Penalty: Violation of marketplace rules or vendor misconduct.",
        });
        if (error) throw error;
        toast({ title: "Success", description: `${vendor.full_name} has been penalized.` });
      } 
      else if (type === "revoke") {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: "revoked_vendor" })
          .eq("user_id", vendor.id)
          .eq("role", "vendor");
        
        // If update fails (e.g. role doesn't exist), we might need to upsert
        if (error) {
          await supabase.from("user_roles").delete().eq("user_id", vendor.id);
          await supabase.from("user_roles").insert({ user_id: vendor.id, role: "revoked_vendor" });
        }
        
        toast({ title: "Success", description: `Vendor status revoked for ${vendor.full_name}.` });
      }
      else if (type === "restore") {
        await supabase.from("user_roles").delete().eq("user_id", vendor.id);
        await supabase.from("user_roles").insert({ user_id: vendor.id, role: "vendor" });
        toast({ title: "Success", description: `Vendor status restored for ${vendor.full_name}.` });
      }
      
      loadVendors();
    } catch (error) {
      console.error("Error performing action:", error);
      toast({ title: "Error", description: "Failed to perform action", variant: "destructive" });
    } finally {
      setConfirmState({ type: null, vendor: null });
    }
  };

  const filteredVendors = vendors.filter(v => {
    const fullName = (v.full_name || "").toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || v.id.includes(searchQuery);
  });

  return (
    <AdminLayout pageTitle="Vendors">
      <SearchBar 
        placeholder="Search vendors..." 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {loading ? (
        <SneakerLoader message="Loading vendors..." fullScreen={false} />
      ) : filteredVendors.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState 
            icon={Store}
            title="No vendors yet"
            subtitle="Registered vendors will appear here"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {filteredVendors.map(v => (
            <div key={v.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
              
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center text-xs font-medium text-primary">
                {(v.full_name || "V")[0].toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {v.full_name || "Unknown Vendor"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">
                    {v.total_sales} sales
                  </span>
                  <span className="text-muted-foreground/30 text-xs">·</span>
                  <Star size={10} className="text-primary fill-primary" />
                  <span className="text-[11px] text-muted-foreground">
                    {v.rating?.toFixed(1) || "5.0"}
                  </span>
                </div>
              </div>

              <StatusPill status={v.status} />

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
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
