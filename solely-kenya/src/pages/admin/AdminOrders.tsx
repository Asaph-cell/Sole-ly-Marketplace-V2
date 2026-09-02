import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchBar, StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminOrder {
  id: string;
  status: string;
  total_ksh: number;
  subtotal_ksh: number;
  shipping_fee_ksh: number;
  commission_amount: number;
  payout_amount: number;
  commission_rate: number;
  created_at: string;
  customer: { full_name: string; email: string } | null;
  vendor: { full_name: string; store_name: string } | null;
  order_items: { id: string; product_name: string; quantity: number; unit_price_ksh: number; size: string | null }[];
  order_shipping_details: {
    recipient_name: string; phone: string; address_line1: string; city: string;
    delivery_type: string | null; courier_name: string | null; tracking_number: string | null; delivery_notes: string | null;
  } | null;
  payments: { status: string; amount_ksh: number }[];
  escrow_transactions: { status: string }[];
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  "pending_payment", "pending_vendor_confirmation", "accepted", "shipped",
  "arrived", "completed", "disputed", "cancelled_by_vendor", "cancelled_by_customer", "refunded",
];

const AdminOrders = () => {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const vendorIdParam = searchParams.get("vendor");

  const loadPage = async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select(`
          id, status, total_ksh, subtotal_ksh, shipping_fee_ksh, commission_amount, payout_amount, commission_rate, created_at,
          customer:profiles!customer_id!inner(full_name, email),
          vendor:profiles!vendor_id!inner(full_name, store_name),
          order_items(id, product_name, quantity, unit_price_ksh, size),
          order_shipping_details(recipient_name, phone, address_line1, city, delivery_type, courier_name, tracking_number, delivery_notes),
          payments(status, amount_ksh),
          escrow_transactions(status)
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (vendorIdParam) query = query.eq("vendor_id", vendorIdParam);
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,store_name.ilike.%${searchQuery}%`, { foreignTable: "vendor" });
      }

      const { data, error } = await query;
      if (error) throw error;

      setHasMore((data || []).length === PAGE_SIZE);
      setOrders(prev => append ? [...prev, ...(data as any)] : (data as any));
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(0);
    const t = setTimeout(() => loadPage(0, false), searchQuery ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, searchQuery, vendorIdParam]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next, true);
  };

  const formatCurrency = (val: number) => `KES ${val.toLocaleString()}`;

  return (
    <AdminLayout pageTitle="Orders">
      <div className="flex flex-col sm:flex-row gap-2 mb-1">
        <div className="flex-1">
          <SearchBar
            placeholder="Search by vendor or store name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] mb-3 text-xs">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <SneakerLoader message="Loading orders..." fullScreen={false} />
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState icon={ClipboardList} title="No orders found" subtitle="Try adjusting your search or filters" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {orders.map(order => {
              const isExpanded = expandedId === order.id;
              const escrowStatus = order.escrow_transactions?.[0]?.status;
              const paymentStatus = order.payments?.[0]?.status;
              return (
                <div key={order.id}>
                  <button
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground truncate">
                          #{order.id.slice(0, 8)} · {order.vendor?.store_name || order.vendor?.full_name}
                        </p>
                        <StatusPill status={order.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {order.customer?.full_name} · {formatCurrency(order.total_ksh)} · {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        {paymentStatus && paymentStatus !== "captured" && ` · payment: ${paymentStatus}`}
                        {escrowStatus && escrowStatus !== "held" && ` · escrow: ${escrowStatus}`}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                      <div className="space-y-1">
                        {order.order_items?.map(item => (
                          <div key={item.id} className="flex justify-between text-xs">
                            <span>{item.quantity} × {item.product_name}{item.size && <span className="text-muted-foreground ml-1">(Size {item.size})</span>}</span>
                            <span className="font-medium">{formatCurrency(item.quantity * item.unit_price_ksh)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="bg-muted/60 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(order.subtotal_ksh)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatCurrency(order.shipping_fee_ksh)}</span></div>
                        <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Total</span><span>{formatCurrency(order.total_ksh)}</span></div>
                        <div className="flex justify-between text-muted-foreground"><span>Commission ({order.commission_rate}%)</span><span>− {formatCurrency(order.commission_amount)}</span></div>
                        <div className="flex justify-between text-success font-semibold"><span>Vendor payout</span><span>{formatCurrency(order.payout_amount)}</span></div>
                      </div>

                      {order.order_shipping_details && (
                        <div className="bg-muted/40 rounded-xl p-3 text-xs space-y-1">
                          <p className="font-semibold text-sm mb-1">Delivery info</p>
                          <p><span className="text-muted-foreground">Recipient: </span>{order.order_shipping_details.recipient_name}</p>
                          <p><span className="text-muted-foreground">Phone: </span>{order.order_shipping_details.phone}</p>
                          <p><span className="text-muted-foreground">Address: </span>{order.order_shipping_details.address_line1}{order.order_shipping_details.city ? `, ${order.order_shipping_details.city}` : ""}</p>
                          {order.order_shipping_details.courier_name && (
                            <p><span className="text-muted-foreground">Courier: </span>{order.order_shipping_details.courier_name} {order.order_shipping_details.tracking_number && `(${order.order_shipping_details.tracking_number})`}</p>
                          )}
                          {order.order_shipping_details.delivery_notes && (
                            <p className="text-primary mt-1"><span className="font-medium">Note: </span>{order.order_shipping_details.delivery_notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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

export default AdminOrders;
