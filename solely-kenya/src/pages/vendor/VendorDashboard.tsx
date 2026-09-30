import { useEffect, useState, type ReactNode } from "react";
import { DashboardSkeleton } from "@/components/skeletons";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { VendorBalanceCard } from "@/components/vendor/VendorBalanceCard";
import { useVendorInsights, RANGE_DAYS, SOURCE_LABEL } from "@/components/vendor/VendorInsights";
import { StoreSetupCard } from "@/components/vendor/StoreSetupCard";
import { usePendingOrders } from "@/components/vendor/PendingOrdersBanner";
import { useWaitingDeliveryChats } from "@/components/vendor/DeliveryInquiryBanner";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { ArrowRight, Check, ChevronRight, Copy, Link2, MessageCircle, PackageCheck, PackageMinus, Plus, Scale } from "lucide-react";
import { Area, AreaChart, XAxis, ResponsiveContainer, Tooltip } from "recharts";

// Dot colour + wording for each order state. Plain words the seller would use.
const STATUS: Record<string, { label: string; dot: string }> = {
  pending_payment:             { label: "Awaiting payment", dot: "bg-muted-foreground/50" },
  pending_vendor_confirmation: { label: "Needs you",        dot: "bg-primary" },
  accepted:                    { label: "Accepted",         dot: "bg-foreground" },
  processing:                  { label: "Processing",       dot: "bg-foreground" },
  shipped:                     { label: "In transit",       dot: "bg-foreground" },
  arrived:                     { label: "Delivered",        dot: "bg-success" },
  completed:                   { label: "Completed",        dot: "bg-success" },
  disputed:                    { label: "Disputed",         dot: "bg-destructive" },
  refunded:                    { label: "Refunded",         dot: "bg-muted-foreground/50" },
  cancelled:                   { label: "Cancelled",        dot: "bg-muted-foreground/50" },
  cancelled_by_vendor:         { label: "Cancelled",        dot: "bg-muted-foreground/50" },
  cancelled_by_customer:       { label: "Cancelled",        dot: "bg-muted-foreground/50" },
};

const LOW_STOCK = 5;
const TOP_PRODUCTS = 5;

// Pill shape only; colour, hover and press come from the Button variants.
const pillQuiet =
  "h-10 rounded-full px-4";
const pillGold =
  "h-10 rounded-full px-5";

const Panel = ({ title, action, children, className = "" }: {
  title: string;
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
}) => (
  <section className={`rounded-2xl border border-border bg-card p-5 sm:p-6 ${className}`}>
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="font-sans text-sm font-semibold tracking-normal">{title}</h2>
      {action && (
        <Link
          to={action.to}
          className="group inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {action.label}
          <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
    {children}
  </section>
);

const Stat = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="min-w-0 px-0 sm:px-5 sm:first:pl-0 sm:last:pr-0">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 whitespace-nowrap font-display text-[clamp(1.5rem,2.4vw,1.875rem)] leading-none tabular-nums">{value}</p>
    {hint && <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
  </div>
);

const VendorDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [rating, setRating] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [openDisputes, setOpenDisputes] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const insights = useVendorInsights(user?.id);
  // Same live sources as the strips on other pages, so the numbers always match.
  const pending = usePendingOrders();
  const deliveryChats = useWaitingDeliveryChats();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const [{ data: prof }, { data: ratings }, { data: orders }, { count }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).single(),
        supabase.from("vendor_ratings").select("rating").eq("vendor_id", user!.id),
        supabase
          .from("orders")
          .select("id, status, created_at, total_ksh")
          .eq("vendor_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("disputes")
          .select("id", { count: "exact", head: true })
          .eq("vendor_id", user!.id)
          .eq("status", "open"),
      ]);

      setProfile(prof);
      setRecentOrders(orders || []);
      setOpenDisputes(count || 0);
      const n = ratings?.length || 0;
      setRating({ avg: n ? ratings!.reduce((s, r) => s + r.rating, 0) / n : 0, count: n });
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setDataLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0];

  const copyStoreLink = async () => {
    const link = `${window.location.origin}/store/${profile?.store_link || profile?.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Store link copied", { description: "Paste it in your Instagram bio or WhatsApp status." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link", { description: link });
    }
  };

  const { rows, totals, daily, conversion, sources, totalSourceViews } = insights;
  const lowStock = rows.filter((r) => r.stock !== null && r.stock > 0 && r.stock < LOW_STOCK);
  const visibleRows = showAllProducts ? rows : rows.slice(0, TOP_PRODUCTS);
  const busy = dataLoading || insights.loading;

  // Only things the seller can act on right now, most urgent first. This is
  // the dashboard's one place for alerts; the strips under the navbar hide here.
  const pendingCount = pending.active.length;
  const waitingCount = deliveryChats.waiting.length;
  const todos = [
    pendingCount > 0 && {
      icon: PackageCheck,
      title: `${pendingCount} order${pendingCount === 1 ? "" : "s"} waiting for you`,
      detail: pending.deadline ? `${pending.deadline.text} to accept. Confirm so the buyer knows you're on it.` : "Confirm so the buyer knows you're on it.",
      cta: "Confirm",
      to: "/vendor/orders",
      urgent: !!pending.deadline?.urgent,
    },
    openDisputes > 0 && {
      icon: Scale,
      title: `${openDisputes} dispute${openDisputes === 1 ? " needs" : "s need"} your side`,
      detail: "Reply with what happened. Unanswered disputes usually go the buyer's way.",
      cta: "Respond",
      to: "/vendor/disputes",
      urgent: true,
    },
    waitingCount > 0 && {
      icon: MessageCircle,
      title: waitingCount === 1 ? "A buyer is waiting on you" : `${waitingCount} buyers are waiting on you`,
      detail: "Agree the delivery fee so they can pay.",
      cta: "Open chat",
      to: deliveryChats.to,
      urgent: false,
    },
    lowStock.length > 0 && {
      icon: PackageMinus,
      title: `${lowStock.length} product${lowStock.length === 1 ? " is" : "s are"} almost sold out`,
      detail: lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(", "),
      cta: "Restock",
      to: "/vendor/products",
      urgent: false,
    },
  ].filter(Boolean) as Array<{ icon: typeof PackageCheck; title: string; detail: string; cta: string; to: string; urgent: boolean }>;

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />

        <main className="flex-1 min-w-0 px-4 py-6 pb-12 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl space-y-6">

            {/* ── Header ── */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-3xl leading-tight sm:text-4xl">
                  {greeting}{firstName && <>, <span className="italic text-primary">{firstName}</span></>}
                </h1>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button variant="outline" className={pillQuiet} onClick={copyStoreLink} disabled={!profile}>
                  {copied ? <Check size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.75} />}
                  Store link
                </Button>
                <Button variant="outline" className={pillQuiet} onClick={() => navigate("/vendor/payment-links")}>
                  <Link2 size={15} strokeWidth={1.75} /> Payment link
                </Button>
                <Button className={`${pillGold} order-first col-span-2 sm:order-last`} onClick={() => navigate("/vendor/list-item")}>
                  <Plus size={16} strokeWidth={2} /> List an item
                </Button>
              </div>
            </header>

            {/* ── Things that need the seller today ── */}
            {!busy && todos.length > 0 && (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-primary/30 bg-card">
                {todos.map(({ icon: Icon, title, detail, cta, to, urgent }) => (
                  <li key={title}>
                    <Link to={to} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 sm:px-5">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${urgent ? "bg-destructive/10 text-destructive" : "bg-primary/15"}`}>
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{title}</p>
                        <p className="truncate text-xs text-muted-foreground">{detail}</p>
                      </div>
                      <span className="hidden text-xs font-semibold sm:inline">{cta}</span>
                      <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {!dataLoading && <StoreSetupCard profile={profile} />}
            <PushNotificationPrompt variant="banner" />

            {/* ── Main grid ── */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

              <div className="min-w-0 space-y-6">
                {/* Performance */}
                <Panel title={`Last ${RANGE_DAYS} days`}>
                  {busy ? (
                    <div className="h-64 rounded-xl bg-muted animate-pulse" />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-border">
                        <Stat label="Visitors" value={totals.visitors.toLocaleString()} />
                        <Stat label="Sales" value={totals.orders.toLocaleString()} />
                        <Stat
                          label="Look-to-buy"
                          value={conversion === null ? "–" : `${conversion.toFixed(1)}%`}
                          hint={conversion === null ? "No visitors yet" : undefined}
                        />
                        <Stat
                          label="Rating"
                          value={rating.count ? rating.avg.toFixed(1) : "–"}
                          hint={rating.count ? `From ${rating.count} review${rating.count === 1 ? "" : "s"}` : "No reviews yet"}
                        />
                      </div>

                      <div className="mt-6 -mx-1">
                        <ResponsiveContainer width="100%" height={150}>
                          <AreaChart data={daily} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                            <defs>
                              <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              interval="preserveStartEnd"
                              minTickGap={40}
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <Tooltip
                              formatter={(v: number) => [v, "Views"]}
                              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                              contentStyle={{
                                borderRadius: 10,
                                border: "1px solid hsl(var(--border))",
                                background: "hsl(var(--card))",
                                fontSize: 12,
                              }}
                              cursor={{ stroke: "hsl(var(--border))" }}
                            />
                            <Area type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#fillViews)" dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                        <p className="px-1 text-[11px] text-muted-foreground">Product views per day</p>
                      </div>

                      {totals.abandoned > 0 && (
                        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground tabular-nums">KES {totals.abandonedValue.toLocaleString()}</span>{" "}
                          reached checkout but wasn't paid ({totals.abandoned} order{totals.abandoned === 1 ? "" : "s"}).
                        </p>
                      )}
                    </>
                  )}
                </Panel>

                {/* Products */}
                <Panel title="Your products" action={{ label: "Manage", to: "/vendor/products" }}>
                  {busy ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="flex flex-col items-start gap-3 py-2">
                      <p className="text-sm text-muted-foreground">Nothing listed yet. Your first item takes about two minutes.</p>
                      <Button className={pillGold} onClick={() => navigate("/vendor/list-item")}>
                        <Plus size={16} strokeWidth={2} /> List an item
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="-mx-5 overflow-x-auto sm:-mx-6">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground">
                              <th className="pb-2 pl-5 text-left font-medium sm:pl-6">Product</th>
                              <th className="hidden px-3 pb-2 text-right font-medium sm:table-cell">Visitors</th>
                              <th className="px-3 pb-2 text-right font-medium">Sold</th>
                              <th className="pb-2 pl-3 pr-5 text-right font-medium sm:pr-6">Earned</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border border-t border-border">
                            {visibleRows.map((r) => {
                              // Looked at but never bought: the listing itself needs work.
                              const unsold = r.visitors >= 5 && r.orders === 0;
                              const low = r.stock !== null && r.stock < LOW_STOCK;
                              return (
                                <tr key={r.id}>
                                  <td className="w-full max-w-0 py-3 pl-5 pr-3 sm:pl-6">
                                    <p className="truncate font-medium">{r.name}</p>
                                    {(unsold || low) && (
                                      <p className="text-[11px] text-muted-foreground">
                                        {low && <span className="font-medium text-destructive">{r.stock === 0 ? "Sold out" : `${r.stock} left`}</span>}
                                        {low && unsold && " · "}
                                        {unsold && "Seen but not sold yet"}
                                      </p>
                                    )}
                                  </td>
                                  <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{r.visitors}</td>
                                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{r.orders}</td>
                                  <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right font-medium tabular-nums sm:pr-6">
                                    {r.revenue > 0 ? `KES ${r.revenue.toLocaleString()}` : "–"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {rows.length > TOP_PRODUCTS && (
                        <button
                          type="button"
                          onClick={() => setShowAllProducts((v) => !v)}
                          className="mt-3 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {showAllProducts ? "Show top 5" : `Show all ${rows.length}`}
                        </button>
                      )}
                    </>
                  )}
                </Panel>
              </div>

              {/* ── Right rail ── */}
              <aside className="order-first min-w-0 space-y-6 lg:order-none">
                {user?.id && <VendorBalanceCard vendorId={user.id} />}

                <Panel title="Recent orders" action={{ label: "All orders", to: "/vendor/orders" }}>
                  {dataLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
                    </div>
                  ) : recentOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No orders yet. Share your store link to get the first one.</p>
                  ) : (
                    <ul className="-my-2.5 divide-y divide-border">
                      {recentOrders.map((order) => {
                        const expired = order.status === "pending_vendor_confirmation" && Date.now() - new Date(order.created_at).getTime() > 48 * 60 * 60 * 1000;
                        const s = expired
                          ? { label: "Expired", dot: "bg-muted-foreground/50" }
                          : STATUS[order.status] ?? { label: order.status.replace(/_/g, " "), dot: "bg-muted-foreground/50" };
                        return (
                          <li key={order.id}>
                            <Link to="/vendor/orders" className="flex items-center justify-between gap-3 py-2.5 transition-opacity hover:opacity-70">
                              <div className="min-w-0">
                                <p className="text-sm font-medium tabular-nums">KES {(order.total_ksh || 0).toLocaleString()}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(order.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                                  {" · "}
                                  <span className="font-mono">#{order.id.slice(0, 6)}</span>
                                </p>
                              </div>
                              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                                {s.label}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>

                {!busy && totalSourceViews > 0 && (
                  <Panel title="Where visitors came from">
                    <ul className="space-y-3">
                      {sources.map(({ key, count }) => {
                        const meta = SOURCE_LABEL[key] || SOURCE_LABEL.unknown;
                        const pct = (count / totalSourceViews) * 100;
                        return (
                          <li key={key}>
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                              <span>{meta.label}</span>
                              <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </Panel>
                )}
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default VendorDashboard;
