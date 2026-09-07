import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, ShoppingCart, Repeat, Link2, Compass, Store } from "lucide-react";

/**
 * The numbers a vendor needs to make a decision, which the raw view counter
 * never answered: did anyone actually buy after looking, which listing is dead,
 * how much nearly-money is sitting in unpaid checkouts, and is the traffic
 * coming from links they shared or from people browsing the site.
 */

const RANGE_DAYS = 30;

// A sale is anything the buyer actually paid for. Unpaid and reversed orders
// are excluded so conversion isn't flattered by checkouts that never completed.
const NON_SALE_STATUSES = new Set([
    "pending_payment",
    "cancelled_by_vendor",
    "cancelled_by_customer",
    "refunded",
]);

const SOURCE_LABEL: Record<string, { label: string; icon: typeof Link2 }> = {
    buy_link: { label: "Links you shared", icon: Link2 },
    product_page: { label: "Browsing Solely", icon: Compass },
    storefront: { label: "Your storefront", icon: Store },
    unknown: { label: "Before tracking", icon: Compass },
};

interface Row {
    id: string;
    name: string;
    views: number;
    visitors: number;
    orders: number;
    revenue: number;
}

export const VendorInsights = ({ vendorId }: { vendorId: string }) => {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Row[]>([]);
    const [sources, setSources] = useState<Array<{ key: string; count: number }>>([]);
    const [totals, setTotals] = useState({
        visitors: 0,
        orders: 0,
        abandoned: 0,
        abandonedValue: 0,
        repeatBuyers: 0,
        buyers: 0,
    });

    useEffect(() => {
        if (vendorId) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vendorId]);

    const load = async () => {
        setLoading(true);
        try {
            const since = new Date(Date.now() - RANGE_DAYS * 86400_000).toISOString();

            const [{ data: products }, { data: orders }] = await Promise.all([
                supabase.from("products").select("id, name").eq("vendor_id", vendorId),
                supabase
                    .from("orders")
                    .select("id, status, customer_id, total_ksh")
                    .eq("vendor_id", vendorId),
            ]);

            const productIds = (products || []).map((p) => p.id);
            if (productIds.length === 0) {
                setRows([]);
                setLoading(false);
                return;
            }

            const [{ data: views }, { data: items }] = await Promise.all([
                supabase
                    .from("product_views")
                    .select("product_id, source, visitor_id")
                    .in("product_id", productIds)
                    .gte("viewed_at", since),
                (orders || []).length
                    ? supabase
                        .from("order_items")
                        .select("order_id, product_id, line_total_ksh")
                        .in("order_id", (orders || []).map((o) => o.id))
                    : Promise.resolve({ data: [] as any[] }),
            ]);

            // Views and distinct visitors per product. A null visitor_id means
            // storage was blocked, so it can't be de-duplicated - count each of
            // those as its own visitor rather than collapsing them into one.
            const viewCount = new Map<string, number>();
            const visitorSets = new Map<string, Set<string>>();
            const anonCount = new Map<string, number>();
            const sourceCount = new Map<string, number>();

            (views || []).forEach((v: any) => {
                viewCount.set(v.product_id, (viewCount.get(v.product_id) || 0) + 1);
                if (v.visitor_id) {
                    if (!visitorSets.has(v.product_id)) visitorSets.set(v.product_id, new Set());
                    visitorSets.get(v.product_id)!.add(v.visitor_id);
                } else {
                    anonCount.set(v.product_id, (anonCount.get(v.product_id) || 0) + 1);
                }
                const key = v.source || "unknown";
                sourceCount.set(key, (sourceCount.get(key) || 0) + 1);
            });

            const paidOrderIds = new Set(
                (orders || []).filter((o) => !NON_SALE_STATUSES.has(o.status)).map((o) => o.id)
            );

            const orderCount = new Map<string, number>();
            const revenue = new Map<string, number>();
            (items || []).forEach((it: any) => {
                if (!paidOrderIds.has(it.order_id)) return;
                orderCount.set(it.product_id, (orderCount.get(it.product_id) || 0) + 1);
                revenue.set(it.product_id, (revenue.get(it.product_id) || 0) + (it.line_total_ksh || 0));
            });

            const built: Row[] = (products || []).map((p) => ({
                id: p.id,
                name: p.name,
                views: viewCount.get(p.id) || 0,
                visitors: (visitorSets.get(p.id)?.size || 0) + (anonCount.get(p.id) || 0),
                orders: orderCount.get(p.id) || 0,
                revenue: revenue.get(p.id) || 0,
            }));
            built.sort((a, b) => b.revenue - a.revenue || b.views - a.views);
            setRows(built);

            setSources(
                Array.from(sourceCount.entries())
                    .map(([key, count]) => ({ key, count }))
                    .sort((a, b) => b.count - a.count)
            );

            const abandonedOrders = (orders || []).filter((o) => o.status === "pending_payment");
            const buyerOrderCounts = new Map<string, number>();
            (orders || [])
                .filter((o) => paidOrderIds.has(o.id) && o.customer_id)
                .forEach((o) => buyerOrderCounts.set(o.customer_id!, (buyerOrderCounts.get(o.customer_id!) || 0) + 1));

            setTotals({
                visitors: built.reduce((s, r) => s + r.visitors, 0),
                orders: built.reduce((s, r) => s + r.orders, 0),
                abandoned: abandonedOrders.length,
                abandonedValue: abandonedOrders.reduce((s, o) => s + (o.total_ksh || 0), 0),
                repeatBuyers: Array.from(buyerOrderCounts.values()).filter((n) => n > 1).length,
                buyers: buyerOrderCounts.size,
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="rounded-2xl border-border">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Loading insights…
                </CardContent>
            </Card>
        );
    }

    const conversion = totals.visitors > 0 ? (totals.orders / totals.visitors) * 100 : 0;
    const totalSourceViews = sources.reduce((s, x) => s + x.count, 0);

    const stat = (
        label: string,
        value: string,
        hint: string,
        Icon: typeof Users,
        tone?: "warn"
    ) => (
        <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon size={15} strokeWidth={1.5} className={tone === "warn" ? "text-amber-500" : "text-muted-foreground"} />
            </div>
            <p className={`text-2xl font-bold ${tone === "warn" ? "text-amber-600 dark:text-amber-500" : ""}`}>{value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stat("Real people", String(totals.visitors), `Last ${RANGE_DAYS} days, repeat visits merged`, Users)}
                {stat(
                    "Look-to-buy rate",
                    totals.visitors > 0 ? `${conversion.toFixed(1)}%` : "-",
                    totals.visitors > 0 ? `${totals.orders} bought of ${totals.visitors} who looked` : "No visitors yet",
                    Target
                )}
                {stat(
                    "Didn't pay",
                    String(totals.abandoned),
                    totals.abandoned > 0
                        ? `KES ${totals.abandonedValue.toLocaleString()} reached checkout, never paid`
                        : "No unpaid checkouts",
                    ShoppingCart,
                    totals.abandoned > 0 ? "warn" : undefined
                )}
                {stat(
                    "Came back",
                    String(totals.repeatBuyers),
                    totals.buyers > 0
                        ? `of ${totals.buyers} customer${totals.buyers === 1 ? "" : "s"} bought more than once`
                        : "No customers yet",
                    Repeat
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Which listing is working, which is dead */}
                <Card className="lg:col-span-2 rounded-2xl border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">How each product is doing</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Last {RANGE_DAYS} days</p>
                    </CardHeader>
                    <CardContent>
                        {rows.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No products yet</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="text-left font-medium py-2">Product</th>
                                            <th className="text-right font-medium py-2 px-2">People</th>
                                            <th className="text-right font-medium py-2 px-2">Sold</th>
                                            <th className="text-right font-medium py-2 px-2">Rate</th>
                                            <th className="text-right font-medium py-2">Earned</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r) => {
                                            const rate = r.visitors > 0 ? (r.orders / r.visitors) * 100 : null;
                                            // Looked at but never bought - the listing itself is the
                                            // problem, and that's the one thing worth flagging.
                                            const deadStock = r.visitors >= 5 && r.orders === 0;
                                            return (
                                                <tr key={r.id} className="border-b last:border-0">
                                                    <td className="py-2.5 pr-2">
                                                        <span className="font-medium">{r.name}</span>
                                                        {deadStock && (
                                                            <span className="ml-2 text-[10px] rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5">
                                                                seen, not sold
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right tabular-nums">{r.visitors}</td>
                                                    <td className="py-2.5 px-2 text-right tabular-nums">{r.orders}</td>
                                                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground">
                                                        {rate === null ? "-" : `${rate.toFixed(0)}%`}
                                                    </td>
                                                    <td className="py-2.5 text-right tabular-nums font-medium">
                                                        {r.revenue > 0 ? `KES ${r.revenue.toLocaleString()}` : "-"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Is their own marketing working, or is it Solely's traffic */}
                <Card className="rounded-2xl border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Where visitors came from</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Last {RANGE_DAYS} days</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {totalSourceViews === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No visits yet</p>
                        ) : (
                            sources.map(({ key, count }) => {
                                const meta = SOURCE_LABEL[key] || SOURCE_LABEL.unknown;
                                const pct = (count / totalSourceViews) * 100;
                                const Icon = meta.icon;
                                return (
                                    <div key={key}>
                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                            <span className="flex items-center gap-1.5">
                                                <Icon size={13} strokeWidth={1.5} className="text-muted-foreground" />
                                                {meta.label}
                                            </span>
                                            <span className="tabular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
