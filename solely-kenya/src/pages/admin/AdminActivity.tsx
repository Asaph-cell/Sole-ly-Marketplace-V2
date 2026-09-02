import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { EmptyState } from "@/components/admin/AdminShared";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { History, PauseCircle, PlayCircle, Trash2, Star, ShieldOff, ShieldCheck, RefreshCw, SplitSquareHorizontal, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActivityEntry {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  vendor_id: string | null;
  details: Record<string, any>;
  created_at: string;
  admin?: { full_name: string; email: string };
}

const PAGE_SIZE = 25;

const ACTION_META: Record<string, { icon: any; color: string; label: string }> = {
  pause_product: { icon: PauseCircle, color: "text-muted-foreground", label: "Paused product" },
  restore_product: { icon: PlayCircle, color: "text-success", label: "Restored product" },
  delete_product: { icon: Trash2, color: "text-destructive", label: "Deleted product" },
  penalize_vendor: { icon: Star, color: "text-destructive", label: "Penalized vendor" },
  revoke_vendor: { icon: ShieldOff, color: "text-destructive", label: "Revoked vendor" },
  restore_vendor: { icon: ShieldCheck, color: "text-success", label: "Restored vendor" },
  resolve_dispute_release: { icon: CheckCircle2, color: "text-success", label: "Released funds" },
  resolve_dispute_refund: { icon: RefreshCw, color: "text-primary", label: "Issued refund" },
  resolve_dispute_partial_refund: { icon: SplitSquareHorizontal, color: "text-primary", label: "Issued partial refund" },
  resolve_dispute_close: { icon: XCircle, color: "text-muted-foreground", label: "Dismissed dispute" },
};

const summarize = (entry: ActivityEntry): string => {
  const d = entry.details || {};
  switch (entry.action_type) {
    case "pause_product":
    case "restore_product":
    case "delete_product":
      return d.product_name ? `"${d.product_name}"` : entry.target_id.slice(0, 8);
    case "penalize_vendor":
    case "revoke_vendor":
    case "restore_vendor":
      return d.vendor_name || entry.target_id.slice(0, 8);
    case "resolve_dispute_release":
      return `KES ${Number(d.amount_released || 0).toLocaleString()} to vendor`;
    case "resolve_dispute_refund":
      return `KES ${Number(d.refund_amount || 0).toLocaleString()} to buyer`;
    case "resolve_dispute_partial_refund":
      return `KES ${Number(d.refund_amount || 0).toLocaleString()} partial refund`;
    case "resolve_dispute_close":
      return `Order restored to "${d.restored_status || "previous"}"`;
    default:
      return "";
  }
};

const targetLink = (entry: ActivityEntry): string | null => {
  if (entry.target_type === "vendor") return `/admin/vendors/${entry.target_id}`;
  if (entry.target_type === "dispute") return `/admin/disputes?dispute=${entry.target_id}`;
  if (entry.vendor_id) return `/admin/vendors/${entry.vendor_id}`;
  return null;
};

const AdminActivity = () => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>("all");

  const loadPage = async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      let query = supabase
        .from("admin_activity_log")
        .select("*, admin:profiles!admin_id(full_name, email)")
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1);

      if (actionFilter !== "all") query = query.eq("action_type", actionFilter);

      const { data, error } = await query;
      if (error) throw error;

      setHasMore((data || []).length === PAGE_SIZE);
      setEntries(prev => append ? [...prev, ...(data as any)] : (data as any));
    } catch (error) {
      console.error("Error loading activity log:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(0);
    loadPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next, true);
  };

  return (
    <AdminLayout pageTitle="Activity Log">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-3">
        {[{ id: "all", label: "All actions" }, ...Object.entries(ACTION_META).map(([id, m]) => ({ id, label: m.label }))].map(f => (
          <button
            key={f.id}
            onClick={() => setActionFilter(f.id)}
            className={cn(
              "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              actionFilter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SneakerLoader message="Loading activity..." fullScreen={false} />
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState icon={History} title="No activity yet" subtitle="Admin actions will be recorded here as they happen" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {entries.map(entry => {
              const meta = ACTION_META[entry.action_type] || { icon: History, color: "text-muted-foreground", label: entry.action_type };
              const Icon = meta.icon;
              const link = targetLink(entry);
              const row = (
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <div className={cn("h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5")}>
                    <Icon size={13} strokeWidth={1.5} className={meta.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-medium">{entry.admin?.full_name || "Admin"}</span>
                      {" "}{meta.label.charAt(0).toLowerCase() + meta.label.slice(1)}
                      {summarize(entry) && <span className="text-muted-foreground"> · {summarize(entry)}</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
              return link ? (
                <Link key={entry.id} to={link} className="block">{row}</Link>
              ) : (
                <div key={entry.id}>{row}</div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
};

export default AdminActivity;
