import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { VendorBalanceCard } from "@/components/vendor/VendorBalanceCard";
import { PayoutHistory } from "@/components/vendor/PayoutHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import {
  Package, Star, Eye, ShoppingCart, TrendingUp,
  DollarSign, AlertTriangle, ArrowRight, Clock,
  CheckCircle, Zap, Share2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

// ── Status badge colour map ───────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  completed:                   "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  arrived:                     "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  pending_vendor_confirmation: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  processing:                  "bg-blue-100  text-blue-700  dark:bg-blue-900/40  dark:text-blue-400",
  shipped:                     "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  cancelled:                   "bg-red-100   text-red-700   dark:bg-red-900/40   dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  completed:                   "Completed",
  arrived:                     "Arrived",
  pending_vendor_confirmation: "Needs Action",
  processing:                  "Processing",
  shipped:                     "Shipped",
  cancelled:                   "Cancelled",
};

const VendorDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile]               = useState<any>(null);
  const [dataLoading, setDataLoading]       = useState(true);
  const [stats, setStats] = useState({
    totalProducts:  0,
    averageRating:  0,
    totalViews:     0,
    ordersReceived: 0,
    totalEarned:    0,
    paidOut:        0,
    pendingBalance: 0,
    pendingOrders:  0,
  });
  const [viewsData, setViewsData]           = useState<Array<{ date: string; views: number }>>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [recentOrders, setRecentOrders]     = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      await Promise.all([fetchProfile(), fetchStats(), fetchViewsData()]);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setDataLoading(false);
    }
  };

  const fetchProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", user?.id).single();
    setProfile(data);
  };

  const fetchStats = async () => {
    const { data: products } = await supabase
      .from("products").select("id, name, stock, views").eq("vendor_id", user?.id);

    const totalViews = products?.reduce((s, p) => s + (p.views || 0), 0) || 0;
    setLowStockProducts(products?.filter(p => p.stock < 5 && p.stock > 0).slice(0, 5) || []);

    const { data: ratings } = await supabase
      .from("vendor_ratings").select("rating").eq("vendor_id", user?.id);
    const averageRating = ratings?.length
      ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

    const { data: orders } = await supabase
      .from("orders").select("*").eq("vendor_id", user?.id)
      .order("created_at", { ascending: false });

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const pendingOrdersCount = orders?.filter(o =>
      o.status === "pending_vendor_confirmation" &&
      new Date(o.created_at) >= cutoff
    ).length || 0;
    setRecentOrders(orders?.slice(0, 5) || []);

    const completedOrders = orders?.filter(o => o.status === "completed" || o.status === "arrived") || [];
    const totalEarnings = completedOrders.reduce((s, o) => s + (o.payout_amount || 0), 0);

    const { data: payouts } = await supabase
      .from("payouts").select("amount_ksh, status").eq("vendor_id", user?.id);
    const paidOut = (payouts || [])
      .filter((p: any) => p.status === "paid" || p.status === "processing")
      .reduce((s: number, p: any) => s + (p.amount_ksh || 0), 0);

    const { data: balanceData } = await supabase
      .from("vendor_balances").select("pending_balance").eq("vendor_id", user?.id).single();

    setStats({
      totalProducts:  products?.length || 0,
      averageRating:  Number(averageRating.toFixed(1)),
      totalViews,
      ordersReceived: orders?.length || 0,
      totalEarned:    totalEarnings,
      paidOut,
      pendingBalance: balanceData?.pending_balance || 0,
      pendingOrders:  pendingOrdersCount,
    });
  };

  const fetchViewsData = async () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    const { data: views } = await supabase
      .from("product_views").select("viewed_at, product_id")
      .gte("viewed_at", startOfMonth.toISOString())
      .order("viewed_at", { ascending: true });

    if (!views) { setViewsData([]); return; }

    const { data: vendorProducts } = await supabase
      .from("products").select("id").eq("vendor_id", user?.id);

    const ids = new Set(vendorProducts?.map(p => p.id) || []);
    const filtered = views.filter(v => ids.has(v.product_id));

    const byDate: Record<string, number> = {};
    filtered.forEach(v => {
      const d = new Date(v.viewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      byDate[d] = (byDate[d] || 0) + 1;
    });

    setViewsData(Object.entries(byDate).map(([date, views]) => ({ date, views })));
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading…</div>;

  // ── Greeting ─────────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const vendorName = profile?.full_name?.split(" ")[0] || "Vendor";

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-10">

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-5 sm:mb-6">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">{greeting},</p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{vendorName} 👋</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 text-xs sm:text-sm bg-white"
                onClick={() => {
                  const link = `${window.location.origin}/store/${profile?.store_link || profile?.id}`;
                  navigator.clipboard.writeText(link);
                  toast({
                    title: "Link Copied!",
                    description: "Your store link has been copied to your clipboard.",
                  });
                }}
              >
                <Share2 size={14} strokeWidth={1.5} /> Copy Store Link
              </Button>

              <Button size="sm" onClick={() => navigate("/vendor/list-item")} className="gap-1.5 text-xs sm:text-sm">
                <Package size={14} strokeWidth={1.5}  /> List Item
              </Button>
            </div>
          </div>

          {/* ── Push notification prompt ── */}
          <PushNotificationPrompt variant="banner" />

          {dataLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* ── Urgent action banner (only when needed) ── */}
              {stats.pendingOrders > 0 && (
                <Link
                  to="/vendor/orders"
                  className="flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-400/30 hover:bg-amber-500/15 transition-colors"
                >
                  <Zap size={16} strokeWidth={1.5} className=" text-amber-600 shrink-0" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex-1">
                    {stats.pendingOrders} order{stats.pendingOrders !== 1 ? "s" : ""} need your confirmation
                  </p>
                  <ArrowRight size={16} strokeWidth={1.5} className=" text-amber-600 shrink-0" />
                </Link>
              )}

              {/* ── 4 KPI cards in 2×2 (mobile) / 4×1 (desktop) ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
                {/* Products */}
                <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-1.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Products</span>
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package size={14} strokeWidth={1.5} className=" text-primary" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalProducts}</p>
                  <Link to="/vendor/products" className="text-[11px] text-primary font-medium flex items-center gap-0.5 hover:underline">
                    Manage <ArrowRight strokeWidth={1.5} className="h-3 w-3" />
                  </Link>
                </div>

                {/* Rating */}
                <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-1.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rating</span>
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Star size={14} strokeWidth={1.5} className=" text-amber-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">
                    {stats.averageRating > 0 ? stats.averageRating : "—"}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {stats.averageRating > 0 ? "out of 5 ★" : "No ratings yet"}
                  </span>
                </div>

                {/* Views */}
                <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-1.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Views</span>
                    <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Eye size={14} strokeWidth={1.5} className=" text-blue-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
                  <span className="text-[11px] text-muted-foreground">Product page views</span>
                </div>

                {/* Orders */}
                <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-1.5 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Orders</span>
                    <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <ShoppingCart size={14} strokeWidth={1.5} className=" text-purple-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{stats.ordersReceived}</p>
                  <Link to="/vendor/orders" className="text-[11px] text-primary font-medium flex items-center gap-0.5 hover:underline">
                    View all <ArrowRight strokeWidth={1.5} className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* ── Earnings summary row ── */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-5">
                <div className="bg-card rounded-2xl border border-border p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={14} strokeWidth={1.5} className=" text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Earned</span>
                  </div>
                  <p className="text-xl font-bold">KES {stats.totalEarned.toLocaleString()}</p>
                  <span className="text-[11px] text-muted-foreground">From completed orders</span>
                </div>

                <div className="bg-green-50 dark:bg-green-950/30 rounded-2xl border border-green-200 dark:border-green-800 p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle size={14} strokeWidth={1.5} className=" text-green-600" />
                    <span className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">Paid Out</span>
                  </div>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">KES {stats.paidOut.toLocaleString()}</p>
                  <span className="text-[11px] text-green-600 dark:text-green-500">Sent to M-Pesa</span>
                </div>
              </div>

              {/* ── Wallet + Payout History ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <VendorBalanceCard vendorId={user?.id!} />
                <PayoutHistory vendorId={user?.id!} />
              </div>

              {/* ── Chart + Sidebar (alerts & recent orders) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Chart */}
                <Card className="lg:col-span-2 rounded-2xl border-border">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Product Views</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">This month</p>
                    </div>
                    <Eye size={16} strokeWidth={1.5} className=" text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {viewsData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Eye strokeWidth={1.5} className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No views recorded this month</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={viewsData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={6} tick={{ fontSize: 11 }} />
                          <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                            cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
                          />
                          <Area
                            type="monotone" dataKey="views"
                            stroke="hsl(var(--primary))" strokeWidth={2}
                            fill="url(#fillViews)" dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Right column: Low stock + Recent orders */}
                <div className="space-y-4">

                  {/* Low stock */}
                  <Card className="rounded-2xl border-border">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <AlertTriangle size={16} strokeWidth={1.5} className=" text-destructive" />
                        Low Stock
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {lowStockProducts.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">All products well stocked ✓</p>
                      ) : (
                        <div className="space-y-2">
                          {lowStockProducts.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="truncate max-w-[65%] font-medium">{p.name}</span>
                              <span className="font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                                {p.stock} left
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent orders */}
                  <Card className="rounded-2xl border-border">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                        <Clock size={16} strokeWidth={1.5} className=" text-muted-foreground" />
                        Recent Orders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {recentOrders.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No orders yet.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {recentOrders.map((order: any) => (
                            <div key={order.id} className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold">#{order.id.slice(0, 8)}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                                </p>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[order.status] ?? "bg-muted text-muted-foreground"}`}>
                                {STATUS_LABEL[order.status] ?? order.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          ))}
                          <Button
                            variant="outline" size="sm"
                            className="w-full mt-1 text-xs h-8 rounded-lg"
                            onClick={() => navigate("/vendor/orders")}
                          >
                            View all orders
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default VendorDashboard;
