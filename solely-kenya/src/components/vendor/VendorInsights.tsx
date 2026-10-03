import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Compass, Store, Globe } from "lucide-react";

/**
 * The numbers a vendor needs to make a decision, which the raw view counter
 * never answered: did anyone actually buy after looking, which listing is dead,
 * how much nearly-money is sitting in unpaid checkouts, and is the traffic
 * coming from links they shared or from people browsing the site.
 */

export const RANGE_DAYS = 30;

// A sale is anything the buyer actually paid for. Unpaid and reversed orders
// are excluded so conversion isn't flattered by checkouts that never completed.
const NON_SALE_STATUSES = new Set([
    "pending_payment",
    "cancelled_by_vendor",
    "cancelled_by_customer",
    "refunded",
]);

export const SOURCE_LABEL: Record<string, { label: string; icon: typeof Link2 }> = {
    buy_link: { label: "Links you shared", icon: Link2 },
    product_page: { label: "Browsing Solely", icon: Compass },
    storefront: { label: "Your storefront", icon: Store },
    own_site: { label: "Your website", icon: Globe },
    unknown: { label: "Before tracking", icon: Compass },
};

export interface InsightRow {
    id: string;
    name: string;
    stock: number | null;
    views: number;
    visitors: number;
    orders: number;
    revenue: number;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export const useVendorInsights = (vendorId: string | undefined) => {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<InsightRow[]>([]);
    const [sources, setSources] = useState<Array<{ key: string; count: number }>>([]);
    const [daily, setDaily] = useState<Array<{ date: string; label: string; views: number }>>([]);
    const [totals, setTotals] = useState({
        visitors: 0,
        orders: 0,
        abandoned: 0,
        abandonedValue: 0,
    });

    useEffect(() => {
        if (vendorId) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vendorId]);

    const load = async () => {
        setLoading(true);
        try {
            const since = new Date(Date.now() - RANGE_DAYS * 86400_000);

            const [{ data: products }, { data: orders }] = await Promise.all([
                supabase.from("products").select("id, name, stock").eq("vendor_id", vendorId!),
                supabase
                    .from("orders")
                    .select("id, status, total_ksh, created_at")
                    .eq("vendor_id", vendorId!),
            ]);

            // One bucket per day so quiet days show as zero instead of vanishing.
            const buckets = new Map<string, number>();
            for (let i = RANGE_DAYS - 1; i >= 0; i--) {
                buckets.set(dayKey(new Date(Date.now() - i * 86400_000)), 0);
            }

            const productIds = (products || []).map((p) => p.id);
            if (productIds.length === 0) {
                setRows([]);
                setDaily(toSeries(buckets));
                return;
            }

            const recentOrderIds = (orders || [])
                .filter((o) => new Date(o.created_at) >= since)
                .map((o) => o.id);

            const [{ data: views }, { data: items }] = await Promise.all([
                supabase
                    .from("product_views")
                    .select("product_id, source, visitor_id, viewed_at")
                    .in("product_id", productIds)
                    .gte("viewed_at", since.toISOString()),
                recentOrderIds.length
                    ? supabase
                        .from("order_items")
                        .select("order_id, product_id, line_total_ksh")
                        .in("order_id", recentOrderIds)
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
                const day = dayKey(new Date(v.viewed_at));
                if (buckets.has(day)) buckets.set(day, buckets.get(day)! + 1);
            });

            // Same window as the views, so the look-to-buy rate compares like with like.
            const paidOrderIds = new Set(
                (orders || [])
                    .filter((o) => !NON_SALE_STATUSES.has(o.status) && new Date(o.created_at) >= since)
                    .map((o) => o.id)
            );

            const orderCount = new Map<string, number>();
            const revenue = new Map<string, number>();
            (items || []).forEach((it: any) => {
                if (!paidOrderIds.has(it.order_id)) return;
                orderCount.set(it.product_id, (orderCount.get(it.product_id) || 0) + 1);
                revenue.set(it.product_id, (revenue.get(it.product_id) || 0) + (it.line_total_ksh || 0));
            });

            const built: InsightRow[] = (products || []).map((p) => ({
                id: p.id,
                name: p.name,
                stock: p.stock,
                views: viewCount.get(p.id) || 0,
                visitors: (visitorSets.get(p.id)?.size || 0) + (anonCount.get(p.id) || 0),
                orders: orderCount.get(p.id) || 0,
                revenue: revenue.get(p.id) || 0,
            }));
            built.sort((a, b) => b.revenue - a.revenue || b.views - a.views);
            setRows(built);
            setDaily(toSeries(buckets));

            setSources(
                Array.from(sourceCount.entries())
                    .map(([key, count]) => ({ key, count }))
                    .sort((a, b) => b.count - a.count)
            );

            const abandonedOrders = (orders || []).filter((o) => o.status === "pending_payment");
            setTotals({
                visitors: built.reduce((s, r) => s + r.visitors, 0),
                orders: built.reduce((s, r) => s + r.orders, 0),
                abandoned: abandonedOrders.length,
                abandonedValue: abandonedOrders.reduce((s, o) => s + (o.total_ksh || 0), 0),
            });
        } finally {
            setLoading(false);
        }
    };

    const conversion = totals.visitors > 0 ? (totals.orders / totals.visitors) * 100 : null;
    const totalSourceViews = sources.reduce((s, x) => s + x.count, 0);

    return { loading, rows, sources, totals, daily, conversion, totalSourceViews };
};

const toSeries = (buckets: Map<string, number>) =>
    Array.from(buckets.entries()).map(([date, views]) => ({
        date,
        label: new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
        views,
    }));
