import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatBar, MiniAreaChart, DonutChart, DataTable, StatusPill } from "@/components/admin/AdminShared";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, Star, DollarSign, Percent, Store, Scale, Clock,
  CheckCircle2, XCircle, ClipboardList, Megaphone, Settings, Mail,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LowRatedVendor {
  vendor_id: string;
  store_name: string;
  avg_rating: number;
  rating_count: number;
}

interface RecentOrder {
  id: string;
  total_ksh: number;
  status: string;
  created_at: string;
  customer_name: string;
}

const QUICK_ACTIONS = [
  { label: "Orders", icon: ClipboardList, href: "/admin/orders" },
  { label: "Announce", icon: Megaphone, href: "/admin/comms" },
  { label: "Mailing List", icon: Mail, href: "/admin/mailing-list" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
];

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
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

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
        // For the activity feed and the recent-orders table
        supabase.from("orders").select("id, created_at, status, total_ksh, customer:profiles!customer_id(full_name)").order("created_at", { ascending: false }).limit(10),
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

      setRecentOrders(
        (recentOrdersData || []).map((o: any) => ({
          id: o.id,
          total_ksh: o.total_ksh,
          status: o.status,
          created_at: o.created_at,
          customer_name: o.customer?.full_name || "Unknown",
        }))
      );

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

  const orderStatusDonut = [
    { name: "Pending", value: stats.pendingOrders },
    { name: "Completed", value: stats.completedOrders },
    { name: "Disputed", value: stats.disputedOrders },
  ].filter(d => d.value > 0);

  return (
    <AdminLayout>
      {loadingData ? (
        <SneakerLoader message="Loading..." fullScreen={false} />
      ) : (
        <div className="flex flex-col gap-4">

          {/* Stat card row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBar label="Total revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} />
            <StatBar label="This month" value={formatCurrency(stats.monthlyRevenue)} icon={DollarSign} delay={0.05} />
            <StatBar label="Commission" value={formatCurrency(stats.netCommission)} icon={Percent} delay={0.1} />
            <StatBar label="Vendors" value={stats.totalVendors} icon={Store} delay={0.15} />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {QUICK_ACTIONS.map(action => (
              <Link
                key={action.href}
                to={action.href}
                className="flex items-center gap-2.5 rounded-2xl border border-border bg-card shadow-soft px-3.5 py-3 hover:shadow-hover hover:-translate-y-0.5 transition-all"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <action.icon size={14} strokeWidth={2} className="text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">{action.label}</span>
              </Link>
            ))}
          </div>

          {/* Chart + donut row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-foreground">Revenue</p>
                <p className="text-[11px] text-muted-foreground">Last 30 days</p>
              </div>
              <MiniAreaChart
                data={dailyRevenue}
                dataKey="revenue"
                gradientId="adminRevenue"
                height={220}
                tooltipFormatter={(v) => formatCurrency(v)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-soft p-4">
              <p className="text-xs font-medium text-foreground mb-3">Order status</p>
              {orderStatusDonut.length > 0 ? (
                <DonutChart
                  data={orderStatusDonut}
                  height={140}
                  centerLabel="Orders"
                  centerValue={stats.pendingOrders + stats.completedOrders + stats.disputedOrders}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-8 text-center">No orders yet</p>
              )}

              <div className="mt-3 pt-3 border-t border-border">
                <div className={cn(
                  "flex items-center gap-1.5 text-[11px]",
                  stats.openDisputes > 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  <Scale size={11} strokeWidth={2} />
                  {stats.openDisputes} open dispute{stats.openDisputes === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>

          {/* Recent orders table + secondary column */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-foreground">Recent orders</p>
              </div>
              <DataTable
                rowKey={(o: RecentOrder) => o.id}
                rows={recentOrders}
                viewAllHref="/admin/orders"
                emptyMessage="No orders yet"
                columns={[
                  {
                    header: "Order",
                    cell: (o) => <span className="font-medium text-foreground">#{o.id.substring(0, 8)}</span>,
                  },
                  {
                    header: "Customer",
                    cell: (o) => <span className="text-muted-foreground truncate">{o.customer_name}</span>,
                  },
                  {
                    header: "Status",
                    cell: (o) => <StatusPill status={o.status} />,
                  },
                  {
                    header: "Date",
                    cell: (o) => <span className="text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}</span>,
                  },
                  {
                    header: "Total",
                    align: "right",
                    cell: (o) => <span className="font-medium text-foreground">{formatCurrency(o.total_ksh)}</span>,
                  },
                ]}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Vendors needing attention */}
              {lowRatedVendors.length > 0 && (
                <div className="rounded-2xl border border-border bg-card shadow-soft px-4 py-3">
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

              {/* Activity feed */}
              <div className="rounded-2xl border border-border bg-card shadow-soft p-4 flex-1">
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

        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDashboard;
