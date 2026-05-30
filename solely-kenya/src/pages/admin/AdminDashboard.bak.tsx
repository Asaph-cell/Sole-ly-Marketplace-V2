import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Package, Users, DollarSign, AlertCircle, Eye, TrendingUp, Clock,
  CheckCircle, Truck, ArrowUpRight, Mail, Send, Trash2, Pause, Play, Image,
  MessageCircle, Lightbulb
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AdminDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Stats
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    totalVendors: 0,
    totalCustomers: 0,
    completedOrders: 0,
    pendingOrders: 0,
    openDisputes: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    netCommission: 0,
    totalViews: 0,
  });

  // Data
  const [products, setProducts] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [openDisputes, setOpenDisputes] = useState<any[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<any[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string, revenue: number, orders: number }[]>([]);

  // Announcement state
  const [announcementSubject, setAnnouncementSubject] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementAudience, setAnnouncementAudience] = useState<"all" | "vendors" | "customers">("all");
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Product actions
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState<"all" | "active" | "draft">("all");

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!data) {
        navigate("/");
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        return;
      }

      setIsAdmin(true);
      loadData();
    };

    if (!loading) {
      checkAdmin();
    }
  }, [user, loading, navigate]);

  const loadData = async () => {
    setLoadingData(true);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const [
        { count: productsCount },
        { count: activeProductsCount },
        { count: vendorsCount },
        { count: customersCount },
        { count: completedOrdersCount },
        { count: pendingOrdersCount },
        { count: disputesCount },
        { data: commissionsAll },
        { data: ordersAll },
        { data: ordersMonth },
        { count: viewsCount },
        { data: recentOrdersData },
        { data: disputesData },
        { data: dailyOrdersData },
        { data: blogSuggestionsData },
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "vendor"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending_vendor_confirmation"),
        supabase.from("disputes").select("*", { count: "exact", head: true }).in("status", ["open", "under_review"]),
        supabase.from("commission_ledger").select("commission_amount"),
        supabase.from("orders").select("total_ksh").eq("status", "completed"),
        supabase.from("orders").select("total_ksh").eq("status", "completed").gte("created_at", monthStart),
        supabase.from("product_views").select("*", { count: "exact", head: true }),
        // Recent orders
        supabase.from("orders")
          .select(`id, created_at, total_ksh, status, profiles:customer_id (full_name)`)
          .order("created_at", { ascending: false })
          .limit(10),
        // Open disputes
        supabase.from("disputes")
          .select(`id, reason, opened_at, order_id, customer:customer_id (full_name)`)
          .in("status", ["open", "under_review"])
          .limit(5),
        supabase.from("orders")
          .select("created_at, total_ksh")
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: true }),
        // Company feedback
        supabase.from("company_feedback")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      // Fetch products separately with explicit error handling
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (productsError) {
        console.error("Products fetch error:", productsError);
      } else {
        console.log("Products loaded:", productsData?.length);
        setProducts(productsData || []);
      }

      const totalCommission = (commissionsAll || []).reduce((sum: number, r: any) => sum + (r.commission_amount || 0), 0);
      const totalRevenue = (ordersAll || []).reduce((sum: number, r: any) => sum + (r.total_ksh || 0), 0);
      const monthlyRevenue = (ordersMonth || []).reduce((sum: number, r: any) => sum + (r.total_ksh || 0), 0);

      // Process daily revenue for graph
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

      setStats({
        totalProducts: productsCount || 0,
        activeProducts: activeProductsCount || 0,
        totalVendors: vendorsCount || 0,
        totalCustomers: customersCount || 0,
        completedOrders: completedOrdersCount || 0,
        pendingOrders: pendingOrdersCount || 0,
        openDisputes: disputesCount || 0,
        totalRevenue,
        monthlyRevenue,
        netCommission: totalCommission,
        totalViews: viewsCount || 0,
      });

      setRecentOrders(recentOrdersData || []);
      setOpenDisputes(disputesData || []);
      setFeedbackItems(blogSuggestionsData || []);
      setDailyRevenue(dailyRevenueArray);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  const toggleProductStatus = async (productId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "draft" : "active";
    try {
      const { error } = await supabase
        .from("products")
        .update({ status: newStatus })
        .eq("id", productId);

      if (error) throw error;

      toast({ title: "Success", description: `Product ${newStatus === "active" ? "activated" : "paused"}` });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
      toast({ title: "Deleted", description: "Product removed permanently" });
      setProductToDelete(null);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const sendAnnouncement = async () => {
    setShowConfirmDialog(false);
    setSendingAnnouncement(true);
    try {
      const response = await supabase.functions.invoke("send-announcement", {
        body: { subject: announcementSubject, htmlContent: announcementMessage, targetAudience: announcementAudience },
      });

      if (response.error) throw new Error(response.error.message);

      toast({ title: "Sent!", description: response.data.message });
      setAnnouncementSubject("");
      setAnnouncementMessage("");
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const formatStatus = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  const updateFeedbackStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("company_feedback")
        .update({ status })
        .eq("id", id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Feedback updated" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteFeedback = async (id: string) => {
    try {
      const { error } = await supabase.from("company_feedback").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Feedback removed" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading || !isAdmin) {
    return <SneakerLoader message="Loading admin dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <VendorNavbar />
      <main className="container mx-auto p-4 md:p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage your marketplace</p>
        </div>

        {loadingData ? (
          <SneakerLoader message="Loading..." fullScreen={false} />
        ) : (
          <>
            {/* Key Stats - Compact Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Completed Revenue</p>
                      <p className="text-lg font-bold">KES {stats.totalRevenue.toLocaleString()}</p>
                    </div>
                    <DollarSign size={20} strokeWidth={1.5} className=" text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">This Month (Completed)</p>
                      <p className="text-lg font-bold">KES {stats.monthlyRevenue.toLocaleString()}</p>
                    </div>
                    <TrendingUp size={20} strokeWidth={1.5} className=" text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Commission</p>
                      <p className="text-lg font-bold">KES {stats.netCommission.toLocaleString()}</p>
                    </div>
                    <DollarSign size={20} strokeWidth={1.5} className=" text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Products</p>
                      <p className="text-lg font-bold">{stats.activeProducts}/{stats.totalProducts}</p>
                    </div>
                    <Package size={20} strokeWidth={1.5} className=" text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Link to="/admin/vendors">
                <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Vendors</p>
                        <p className="text-lg font-bold">{stats.totalVendors}</p>
                      </div>
                      <Users size={20} strokeWidth={1.5} className=" text-cyan-500" />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Views</p>
                      <p className="text-lg font-bold">{stats.totalViews.toLocaleString()}</p>
                    </div>
                    <Eye size={20} strokeWidth={1.5} className=" text-pink-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alert Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <Card className={stats.pendingOrders > 0 ? "border-yellow-500/50" : ""}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock size={20} strokeWidth={1.5} className=" text-yellow-500" />
                    <div>
                      <p className="font-medium">{stats.pendingOrders} Pending Orders</p>
                      <p className="text-xs text-muted-foreground">Awaiting vendor</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={stats.completedOrders > 0 ? "border-green-500/50" : ""}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={20} strokeWidth={1.5} className=" text-green-500" />
                    <div>
                      <p className="font-medium">{stats.completedOrders} Completed</p>
                      <p className="text-xs text-muted-foreground">All time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Link to="/admin/disputes">
                <Card className={stats.openDisputes > 0 ? "border-red-500/50 hover:bg-accent cursor-pointer" : "hover:bg-accent cursor-pointer"}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle size={20} strokeWidth={1.5} className={` ${stats.openDisputes> 0 ? "text-red-500" : "text-muted-foreground"}`} />
                      <div>
                        <p className="font-medium">{stats.openDisputes} Open Disputes</p>
                        <p className="text-xs text-muted-foreground">Need resolution</p>
                      </div>
                    </div>
                    <ArrowUpRight size={16} strokeWidth={1.5}  />
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Main Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="products" className="flex items-center gap-1">
                  <Package size={16} strokeWidth={1.5}  /> Products
                </TabsTrigger>
                <TabsTrigger value="announcements" className="flex items-center gap-1">
                  <Mail size={16} strokeWidth={1.5}  /> Email
                </TabsTrigger>
                <TabsTrigger value="community" className="flex items-center gap-1">
                  <MessageCircle size={16} strokeWidth={1.5}  /> Community
                </TabsTrigger>
                <TabsTrigger value="disputes" className={stats.openDisputes > 0 ? "text-red-600" : ""}>
                   Disputes
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Revenue Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Revenue (Last 7 Days)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dailyRevenue.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No order data yet</p>
                      ) : (
                        <div className="flex items-end gap-1 h-32">
                          {dailyRevenue.slice(-7).map((day, idx) => {
                            const maxRevenue = Math.max(...dailyRevenue.slice(-7).map(d => d.revenue), 1);
                            return (
                              <div key={idx} className="flex flex-col items-center flex-1">
                                <div
                                  className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-pointer relative group"
                                  style={{ height: `${Math.max((day.revenue / maxRevenue) * 100, 4)}px` }}
                                >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    KES {day.revenue.toLocaleString()}
                                  </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1">{day.date}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Orders */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Orders</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {recentOrders.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">No orders yet</p>
                      ) : (
                        <div className="space-y-2">
                          {recentOrders.slice(0, 5).map((order) => (
                            <div key={order.id} className="flex items-center justify-between text-sm">
                              <div>
                                <span className="font-mono">#{order.id.slice(0, 6)}</span>
                                <span className="text-muted-foreground ml-2">{order.profiles?.full_name || "Guest"}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-medium">KES {order.total_ksh?.toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Products Tab */}
              <TabsContent value="products">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package size={20} strokeWidth={1.5}  />
                      All Products
                    </CardTitle>
                    <CardDescription>
                      Manage product listings. Pause or delete products with issues.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Search and Filter */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                      <Input
                        placeholder="Search products..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="sm:max-w-xs"
                      />
                      <Select value={productStatusFilter} onValueChange={(v: any) => setProductStatusFilter(v)}>
                        <SelectTrigger className="sm:w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="draft">Draft/Paused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {products.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No products yet</p>
                    ) : (
                      <div className="space-y-2">
                        {products
                          .filter(p => productStatusFilter === "all" || p.status === productStatusFilter)
                          .filter(p => productSearch === "" || p.name?.toLowerCase().includes(productSearch.toLowerCase()))
                          .map((product) => (
                            <div key={product.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-accent/50">
                              {/* Image */}
                              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                {product.images?.[0] ? (
                                  <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Image size={20} strokeWidth={1.5} className=" text-muted-foreground" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  KES {product.price_ksh?.toLocaleString()}
                                </p>
                              </div>

                              {/* Status */}
                              <Badge variant={product.status === "active" ? "default" : "secondary"}>
                                {product.status}
                              </Badge>

                              {/* Actions */}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleProductStatus(product.id, product.status)}
                                >
                                  {product.status === "active" ? (
                                    <><Pause strokeWidth={1.5} className="h-3 w-3 mr-1" /> Pause</>
                                  ) : (
                                    <><Play strokeWidth={1.5} className="h-3 w-3 mr-1" /> Activate</>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setProductToDelete(product.id)}
                                >
                                  <Trash2 strokeWidth={1.5} className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Announcements Tab */}
              <TabsContent value="announcements">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail size={20} strokeWidth={1.5}  />
                      Send Announcement
                    </CardTitle>
                    <CardDescription>
                      Email users about updates, news, or promotions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Audience</label>
                      <Select value={announcementAudience} onValueChange={(v: any) => setAnnouncementAudience(v)}>
                        <SelectTrigger className="w-full md:w-[250px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users ({stats.totalCustomers})</SelectItem>
                          <SelectItem value="vendors">Vendors Only ({stats.totalVendors})</SelectItem>
                          <SelectItem value="customers">Customers ({stats.totalCustomers - stats.totalVendors})</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        placeholder="Exciting news from Sole-ly!"
                        value={announcementSubject}
                        onChange={(e) => setAnnouncementSubject(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Message (HTML supported)</label>
                      <Textarea
                        placeholder="Write your announcement..."
                        value={announcementMessage}
                        onChange={(e) => setAnnouncementMessage(e.target.value)}
                        rows={6}
                      />
                    </div>

                    {announcementMessage && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Preview</label>
                        <div className="border rounded p-4 bg-muted/50" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(announcementMessage) }} />
                      </div>
                    )}

                    <Button
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={!announcementSubject.trim() || !announcementMessage.trim() || sendingAnnouncement}
                    >
                      <Send size={16} strokeWidth={1.5} className=" mr-2" />
                      {sendingAnnouncement ? "Sending..." : "Send Announcement"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Community/Blog Tab */}
              <TabsContent value="community">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                       <Lightbulb size={20} strokeWidth={1.5} className=" text-primary" />
                       Company Improvements & Feedback
                    </CardTitle>
                    <CardDescription>
                       Direct feedback from the community on how to improve Solely.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {feedbackItems.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No feedback yet. Check back later! 🚀</p>
                    ) : (
                      <div className="space-y-4">
                        {feedbackItems.map((f) => (
                          <div key={f.id} className="p-4 border rounded-xl bg-accent/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <p className="font-bold italic text-lg leading-tight">"{f.message}"</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Clock strokeWidth={1.5} className="h-3 w-3" /> {new Date(f.created_at).toLocaleDateString()}</span>
                                <Badge variant={f.status === 'pending' ? 'outline' : f.status === 'reviewed' ? 'default' : f.status === 'implemented' ? 'secondary' : 'destructive'}>
                                  {f.status}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {f.status === 'pending' && (
                                <Button size="sm" onClick={() => updateFeedbackStatus(f.id, 'reviewed')}>
                                  <CheckCircle size={16} strokeWidth={1.5} className=" mr-1" /> Reviewed
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-500" onClick={() => deleteFeedback(f.id)}>
                                <Trash2 size={16} strokeWidth={1.5}  />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="disputes">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Open Disputes</CardTitle>
                      <CardDescription>Customer complaints needing resolution</CardDescription>
                    </div>
                    <Link to="/admin/disputes">
                      <Button variant="outline" size="sm">View All <ArrowUpRight size={16} strokeWidth={1.5} className=" ml-1" /></Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {openDisputes.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No open disputes 🎉</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Opened</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openDisputes.map((d) => (
                            <TableRow key={d.id}>
                              <TableCell>{d.customer?.full_name || "Unknown"}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">{d.reason?.replace(/_/g, " ")}</Badge>
                              </TableCell>
                              <TableCell>{new Date(d.opened_at).toLocaleDateString()}</TableCell>
                              <TableCell>
                                <Link to="/admin/disputes">
                                  <Button size="sm" variant="outline">Resolve</Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Confirm Send Dialog */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm Send</DialogTitle>
                  <DialogDescription>
                    Send to {announcementAudience === "all" ? `all ${stats.totalCustomers} users` :
                      announcementAudience === "vendors" ? `${stats.totalVendors} vendors` :
                        `${stats.totalCustomers - stats.totalVendors} customers`}?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
                  <Button onClick={sendAnnouncement} disabled={sendingAnnouncement}>
                    {sendingAnnouncement ? "Sending..." : "Send"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Product Confirmation */}
            <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the product. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col-reverse gap-3 mt-6 w-full md:flex-row md:justify-end">
                  <AlertDialogCancel className="w-full mt-0 md:w-auto">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => productToDelete && deleteProduct(productToDelete)} className="w-full md:w-auto">
                    Delete
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;

