import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Scale, Star, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/admin/AdminShared";
import { formatDistanceToNow } from "date-fns";

interface OpenDispute { id: string; order_id: string; reason: string; opened_at: string; }
interface LowRatedVendor { vendor_id: string; store_name: string; avg_rating: number; }
interface FailedPayout { id: string; vendor_id: string; amount_ksh: number; }

/**
 * Live-computed attention center, not a persisted per-user notification
 * inbox - there's no single "admin inbox" concept and possibly multiple
 * admins, so this re-derives "things needing action" the same way
 * AdminLayout's existing dispute-badge count already does, just extended
 * to a popover with more categories. No read/unread state.
 */
export function NotificationBell() {
  const [openDisputes, setOpenDisputes] = useState<OpenDispute[]>([]);
  const [lowRatedVendors, setLowRatedVendors] = useState<LowRatedVendor[]>([]);
  const [failedPayouts, setFailedPayouts] = useState<FailedPayout[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [{ data: disputes }, { data: lowRated }, { data: payouts }] = await Promise.all([
      supabase.from("disputes").select("id, order_id, reason, opened_at").eq("status", "open").order("opened_at", { ascending: false }),
      supabase.from("vendor_rating_stats").select("vendor_id, avg_rating, rating_count").gte("rating_count", 3).order("avg_rating", { ascending: true }).limit(5),
      supabase.from("payouts").select("id, vendor_id, amount_ksh").eq("status", "failed"),
    ]);

    setOpenDisputes(disputes || []);
    setFailedPayouts(payouts || []);

    if (lowRated && lowRated.length > 0) {
      const { data: profiles } = await supabase.from("public_vendor_profiles").select("id, store_name").in("id", lowRated.map(v => v.vendor_id));
      const nameMap = new Map((profiles || []).map(p => [p.id, p.store_name]));
      setLowRatedVendors(lowRated.map(v => ({ vendor_id: v.vendor_id, store_name: nameMap.get(v.vendor_id) || "Unknown store", avg_rating: Number(v.avg_rating) })));
    } else {
      setLowRatedVendors([]);
    }
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "vendor_ratings" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalCount = openDisputes.length + lowRatedVendors.length + failedPayouts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Notifications"
        >
          <Bell size={15} strokeWidth={1.5} className="text-muted-foreground" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[9px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {totalCount > 9 ? "9+" : totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[70vh] overflow-y-auto">
        {totalCount === 0 ? (
          <EmptyState compact icon={Bell} title="You're all caught up" subtitle="Nothing needs attention right now" />
        ) : (
          <div className="divide-y divide-border">
            {openDisputes.map(d => (
              <Link key={`d-${d.id}`} to={`/admin/disputes?dispute=${d.id}`} onClick={() => setOpen(false)} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <Scale size={13} strokeWidth={1.5} className="text-destructive mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-foreground truncate">Open dispute · #{d.order_id.slice(0, 8)} · {d.reason.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(d.opened_at), { addSuffix: true })}</p>
                </div>
              </Link>
            ))}
            {lowRatedVendors.map(v => (
              <Link key={`v-${v.vendor_id}`} to={`/admin/vendors/${v.vendor_id}`} onClick={() => setOpen(false)} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <Star size={13} strokeWidth={1.5} className="text-destructive mt-0.5 shrink-0 fill-destructive" />
                <p className="text-xs text-foreground truncate">Low rating · {v.store_name} ({v.avg_rating.toFixed(1)}★)</p>
              </Link>
            ))}
            {failedPayouts.map(p => (
              <Link key={`p-${p.id}`} to={`/admin/vendors/${p.vendor_id}`} onClick={() => setOpen(false)} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <AlertTriangle size={13} strokeWidth={1.5} className="text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-foreground truncate">Failed payout · KES {p.amount_ksh.toLocaleString()}</p>
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
