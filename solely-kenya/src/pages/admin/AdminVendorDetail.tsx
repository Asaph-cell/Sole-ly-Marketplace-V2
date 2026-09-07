import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatusPill, ActionButton, EmptyState, MiniAreaChart } from "@/components/admin/AdminShared";
import { useAdminAction } from "@/hooks/useAdminAction";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { Star, Scale, ClipboardList, Package, History, ArrowRight, ShieldCheck } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface VendorProfile {
  id: string;
  full_name: string | null;
  store_name: string | null;
  store_logo_url: string | null;
  vendor_city: string | null;
  vendor_county: string | null;
  kyc_status: string | null;
  created_at: string;
}

interface DisputeRow {
  id: string;
  order_id: string;
  reason: string;
  status: string;
  opened_at: string;
  customer: { full_name: string } | null;
}

interface OrderRow {
  id: string;
  status: string;
  total_ksh: number;
  created_at: string;
}

interface ProductRow {
  id: string;
  name: string;
  status: string;
  price_ksh: number | null;
}

interface ActivityRow {
  id: string;
  action_type: string;
  target_type: string;
  created_at: string;
  admin: { full_name: string } | null;
}

const AdminVendorDetail = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  const { adminAction } = useAdminAction();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [ratingStats, setRatingStats] = useState<{ avg_rating: number; rating_count: number } | null>(null);
  const [ratingTrend, setRatingTrend] = useState<{ date: string; rating: number }[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  const loadAll = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const [
        { data: profileData },
        { data: statsData },
        { data: ratingsData },
        { data: disputesData },
        { data: ordersData },
        { data: productsData },
        { data: activityData },
      ] = await Promise.all([
        supabase.from("profiles").select("id, full_name, store_name, store_logo_url, vendor_city, vendor_county, kyc_status, created_at").eq("id", vendorId).single(),
        supabase.from("vendor_rating_stats").select("avg_rating, rating_count").eq("vendor_id", vendorId).maybeSingle(),
        supabase.from("vendor_ratings").select("rating, created_at").eq("vendor_id", vendorId).order("created_at", { ascending: true }),
        supabase.from("disputes").select("id, order_id, reason, status, opened_at, customer:profiles!customer_id(full_name)").eq("vendor_id", vendorId).order("opened_at", { ascending: false }).limit(10),
        supabase.from("orders").select("id, status, total_ksh, created_at").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10),
        supabase.from("products").select("id, name, status, price_ksh").eq("vendor_id", vendorId).order("created_at", { ascending: false }),
        supabase.from("admin_activity_log").select("id, action_type, target_type, created_at, admin:profiles!admin_id(full_name)").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(10),
      ]);

      setProfile(profileData);
      setRatingStats(statsData);
      setRatingTrend((ratingsData || []).map(r => ({ date: format(new Date(r.created_at), "MMM d"), rating: r.rating })));
      setDisputes(disputesData as any || []);
      setOrders(ordersData || []);
      setProducts(productsData || []);
      setActivity(activityData as any || []);
    } catch (error) {
      console.error("Error loading vendor detail:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const formatCurrency = (val: number) => `KES ${val.toLocaleString()}`;

  if (loading) {
    return (
      <AdminLayout pageTitle="Vendor">
        <SneakerLoader message="Loading vendor..." fullScreen={false} />
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout pageTitle="Vendor">
        <div className="rounded-xl border border-border bg-card">
          <EmptyState icon={Package} title="Vendor not found" subtitle="This vendor may have been removed" />
        </div>
      </AdminLayout>
    );
  }

  const name = profile.store_name || profile.full_name || "Vendor";

  return (
    <AdminLayout pageTitle="Vendor">
      {/* Profile header */}
      <div className="rounded-xl border border-border bg-card shadow-soft p-4 mb-3 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0 overflow-hidden">
          {profile.store_logo_url ? (
            <img src={profile.store_logo_url} alt={name} className="w-full h-full object-cover" />
          ) : name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-foreground flex items-center gap-1.5 truncate">
            {name}
            {profile.kyc_status === "approved" && <ShieldCheck size={14} className="text-primary shrink-0" fill="currentColor" stroke="white" />}
          </h1>
          <p className="text-xs text-muted-foreground">
            {profile.vendor_city ? `${profile.vendor_city}${profile.vendor_county ? `, ${profile.vendor_county}` : ""} · ` : ""}
            Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-medium bg-clip-text text-transparent bg-gradient-to-br from-primary to-amber-600">
            {ratingStats ? Number(ratingStats.avg_rating).toFixed(1) : "-"}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
            <Star size={9} className="fill-primary text-primary" />
            {ratingStats?.rating_count || 0} ratings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Rating trend */}
        <div className="rounded-xl border border-border bg-card shadow-soft p-4">
          <p className="text-xs font-medium text-foreground mb-2">Rating trend</p>
          {ratingTrend.length >= 3 ? (
            <MiniAreaChart data={ratingTrend} dataKey="rating" gradientId="vendorRatingTrend" height={140} />
          ) : (
            <EmptyState compact icon={Star} title="Not enough data yet" subtitle="Needs at least 3 ratings to chart a trend" />
          )}
        </div>

        {/* Recent admin actions */}
        <div className="rounded-xl border border-border bg-card shadow-soft p-4">
          <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
            <History size={12} strokeWidth={1.5} />
            Recent admin actions
          </p>
          {activity.length === 0 ? (
            <EmptyState compact icon={History} title="No actions recorded" subtitle="Admin actions on this vendor will appear here" />
          ) : (
            <div className="divide-y divide-border">
              {activity.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                  <span className="text-foreground">{a.admin?.full_name || "Admin"} · {a.action_type.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disputes */}
        <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5"><Scale size={12} strokeWidth={1.5} />Disputes</p>
            <Link to="/admin/disputes" className="text-[11px] text-primary flex items-center gap-1 hover:text-primary-hover">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          {disputes.length === 0 ? (
            <EmptyState compact icon={Scale} title="No disputes" subtitle="This vendor has a clean record" />
          ) : (
            <div className="divide-y divide-border">
              {disputes.map(d => (
                <Link key={d.id} to={`/admin/disputes?dispute=${d.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs hover:bg-muted/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-foreground truncate">#{d.order_id.slice(0, 8)} · {d.reason.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-muted-foreground">{d.customer?.full_name} · {formatDistanceToNow(new Date(d.opened_at), { addSuffix: true })}</p>
                  </div>
                  <StatusPill status={d.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Orders */}
        <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5"><ClipboardList size={12} strokeWidth={1.5} />Orders</p>
            <Link to={`/admin/orders?vendor=${vendorId}`} className="text-[11px] text-primary flex items-center gap-1 hover:text-primary-hover">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          {orders.length === 0 ? (
            <EmptyState compact icon={ClipboardList} title="No orders yet" subtitle="Orders will appear here once this vendor sells" />
          ) : (
            <div className="divide-y divide-border">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="text-foreground truncate">#{o.id.slice(0, 8)} · {formatCurrency(o.total_ksh)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</p>
                  </div>
                  <StatusPill status={o.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products */}
        <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden md:col-span-2">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5"><Package size={12} strokeWidth={1.5} />Products</p>
          </div>
          {products.length === 0 ? (
            <EmptyState compact icon={Package} title="No products listed" subtitle="This vendor hasn't listed anything yet" />
          ) : (
            <div className="divide-y divide-border">
              {products.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatCurrency(p.price_ksh || 0)}</p>
                  </div>
                  <StatusPill status={p.status} />
                  <div className="flex gap-1.5 flex-shrink-0">
                    {p.status !== "paused" ? (
                      <ActionButton label="Pause" onClick={async () => { if (await adminAction("pause_product", p.id)) loadAll(); }} />
                    ) : (
                      <ActionButton label="Restore" onClick={async () => { if (await adminAction("restore_product", p.id)) loadAll(); }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminVendorDetail;
