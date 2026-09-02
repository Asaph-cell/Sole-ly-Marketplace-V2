import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatBar, MiniAreaChart } from "@/components/admin/AdminShared";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, Star, DollarSign, Percent, Store, Scale, Clock, CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LowRatedVendor {
  vendor_id: string;
  store_name: string;
  avg_rating: number;
  rating_count: number;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const [loadingData, setLoadingData] = useState(true);

  const [stats, setStats] = useState({
    totalVendors: 0,
    completedOrders: 0,
    pendingOrders: 0,
    openDisputes: 0,
    disputedOrders: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    netCommission: 0,
  });

  const [dailyRevenue, setDailyRevenue] = useState<{ date: string, revenue: number, orders: number }[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [lowRatedVendors, setLowRatedVendors] = useState<LowRatedVendor[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const [
        { count: vendorsCount },
        { count: completedOrdersCount },
        { count: pendingOrdersCount },
        { count: openDisputesCount },
        { count: allDisputesCount },
        { data: commissionsAll },
        { data: ordersAll },
        { data: ordersMonth },
        { data: dailyOrdersData },
        { data: recentOrdersData },
        { data: recentDisputesData }
      ] = await Promise.all([
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "vendor"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending_vendor_confirmation"),
        supabase.from("disputes").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("disputes").select("*", { count: "exact", head: true }),
        supabase.from("commission_ledger").select("commission_amount"),
        supabase.from("orders").select("total_ksh").eq("status", "completed"),
        supabase.from("orders").select("total_ksh").eq("status", "completed").gte("created_at", monthStart),
        supabase.from("orders").select("created_at, total_ksh").gte("created_at", thirtyDaysAgo).order("created_at", { ascending: true }),
        // For activity feed
        supabase.from("orders").select("id, created_at, status").order("created_at", { ascending: false }).limit(10),
        supabase.from("disputes").select("id, opened_at, status").order("opened_at", { ascending: false }).limit(10),
      ]);

      // Vendors needing attention: lowest average rating, with enough ratings
      // (>=3) that one troll review doesn't unfairly flag a brand-new vendor.
      const { data: lowRatedStats } = await supabase
        .from("vendor_rating_stats")
        .select("vendor_id, avg_rating, rating_count")
        .gte("rating_count", 3)
        .order("avg_rating", { ascending: true })
        .limit(6);

      if (lowRatedStats && lowRatedStats.length > 0) {
        const { data: lowRatedProfiles } = await supabase
          .from("public_vendor_profiles")
          .select("id, store_name")
          .in("id", lowRatedStats.map(s => s.vendor_id));
        const nameByVendorId = new Map((lowRatedProfiles || []).map(p => [p.id, p.store_name]));
        setLowRatedVendors(
          lowRatedStats.map(s => ({
            vendor_id: s.vendor_id,
            store_name: nameByVendorId.get(s.vendor_id) || "Unknown store",
            avg_rating: Number(s.avg_rating),
            rating_count: s.rating_count,
          }))
        );
      } else {
        setLowRatedVendors([]);
      }

      const totalCommission = (commissionsAll || []).reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0);
      const totalRevenue = (ordersAll || []).reduce((sum: number, r: any) => sum + (r.total_ksh || 0), 0);
      const monthlyRevenue = (ordersMonth || []).reduce((sum: number, r: any) => sum + (r.total_ksh || 0), 0);

      const dailyData: Record<string, { revenue: number, orders: number }> = {};
      (dailyOrdersData || []).forEach((order: any) => {
        const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dailyData[date]) dailyData[date] = { revenue: 0, orders: 0 };
        dailyData[date].revenue += order.total_ksh || 0;
        dailyData[date].orders += 1;
      });
      const dailyRevenueArray = Object.entries(dailyData).map(([date, data]) => ({
        date, revenue: data.revenue, orders: data.orders
      }));

      // Combine and sort for activity feed
      const feed = [
        ...(recentOrdersData || []).map(o => ({
          id: o.id,
          timestamp: new Date(o.created_at).getTime(),
          timeAgo: formatDistanceToNow(new Date(o.created_at), { addSuffix: true }),
          title: o.status === 'completed' ? `Order #${o.id.substring(0, 8)} completed` : `New order #${o.id.substring(0, 8)} placed`,
          type: o.status === 'completed' ? "order_complete" : "vendor_new"
        })),
        ...(recentDisputesData || []).map(d => ({
          id: d.id,
          timestamp: new Date(d.opened_at).getTime(),
          timeAgo: formatDistanceToNow(new Date(d.opened_at), { addSuffix: true }),
          title: `Dispute opened for order #${d.id.substring(0, 8)}`,
          type: "dispute_open"
        }))
      ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

      setActivityFeed(feed);

      setStats({
        totalVendors: vendorsCount || 0,
        completedOrders: completedOrdersCount || 0,
        pendingOrders: pendingOrdersCount || 0,
        openDisputes: openDisputesCount || 0,
        disputedOrders: allDisputesCount || 0,
        totalRevenue,
        monthlyRevenue,
        netCommission: totalCommission,
      });

      setDailyRevenue(dailyRevenueArray);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const formatCurrency = (val: number) => `KES ${val.toLocaleString()}`;

  return (
    <AdminLayout>
      {loadingData ? (
        <SneakerLoader message="Loading..." fullScreen={false} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          {/* Left column */}
          <div className="flex flex-col gap-2.5">
            {/* Main revenue stat */}
            <StatBar
              label="Total revenue"
              value={formatCurrency(stats.totalRevenue)}
              icon={DollarSign}
              variant="hero"
            />

            {/* 2-col sub stats */}
            <div className="grid grid-cols-2 gap-2">
              <StatBar label="This month" value={formatCurrency(stats.monthlyRevenue)} icon={DollarSign} delay={0.05} />
              <StatBar label="Commission" value={formatCurrency(stats.netCommission)} icon={Percent} delay={0.1} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatBar label="Vendors" value={stats.totalVendors} icon={Store} delay={0.15} />
              <StatBar
                label="Disputes"
                value={`${stats.openDisputes} open`}
                alert={stats.openDisputes > 0}
                icon={Scale}
                delay={0.2}
              />
            </div>

            {/* Orders at a glance */}
            <div className="rounded-xl border border-border bg-card shadow-soft px-4 py-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Orders
              </p>
              <div className="grid grid-cols-3 divide-x divide-border">
                {[
                  { label: "Pending", value: stats.pendingOrders, color: "text-primary", bg: "bg-primary/10", icon: Clock },
                  { label: "Completed", value: stats.completedOrders, color: "text-success", bg: "bg-success/10", icon: CheckCircle2 },
                  { label: "Disputed", value: stats.disputedOrders, color: "text-destructive", bg: "bg-destructive/10", icon: XCircle },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center gap-1 py-1">
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", item.bg)}>
                      <item.icon size={13} strokeWidth={2} className={item.color} />
                    </div>
                    <p className={cn("text-base font-medium", item.color)}>
                      {item.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vendors needing attention */}
            {lowRatedVendors.length > 0 && (
              <div className="rounded-xl border border-border bg-card shadow-soft px-4 py-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <AlertTriangle size={11} strokeWidth={2} className="text-destructive" />
                  Vendors needing attention
                </p>
                <div className="flex flex-col divide-y divide-border">
                  {lowRatedVendors.map(v => (
                    <Link key={v.vendor_id} to={`/admin/vendors/${v.vendor_id}`} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 group">
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-primary">
                        {v.store_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 min-w-0 text-xs text-foreground group-hover:text-primary transition-colors truncate">
                        {v.store_name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0 text-[11px] text-muted-foreground">
                        <Star size={10} strokeWidth={1.5} className="text-destructive fill-destructive" />
                        {v.avg_rating.toFixed(1)} ({v.rating_count})
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-2.5">
            {/* Mini chart */}
            <div className="rounded-xl border border-border bg-card shadow-soft p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-foreground">Revenue</p>
                <p className="text-[11px] text-muted-foreground">Last 30 days</p>
              </div>
              <MiniAreaChart
                data={dailyRevenue}
                dataKey="revenue"
                gradientId="adminRevenue"
                height={200}
                tooltipFormatter={(v) => formatCurrency(v)}
              />
            </div>

            {/* Activity feed */}
            <div className="rounded-xl border border-border bg-card shadow-soft p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-foreground">
                  Recent activity
                </p>
              </div>

              <div className="flex flex-col divide-y divide-border">
                {activityFeed.map(item => {
                  const meta = item.type === "order_complete"
                    ? { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" }
                    : item.type === "dispute_open"
                    ? { icon: Scale, color: "text-destructive", bg: "bg-destructive/10" }
                    : { icon: DollarSign, color: "text-primary", bg: "bg-primary/10" };
                  return (
                    <div key={`${item.type}-${item.id}`} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                      <div className={cn("h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0", meta.bg)}>
                        <meta.icon size={12} strokeWidth={2} className={meta.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-snug">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {item.timeAgo}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {activityFeed.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No recent activity</p>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
