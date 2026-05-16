import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import {
  Edit, Trash2, CheckCircle, Package, ShoppingBag,
  Plus, AlertTriangle, TrendingUp, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { getAccessoryTypeName } from "@/lib/accessoryTypes";

/* ── Status pill colours ─────────────────────────────────────────── */
const STATUS_PILL: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  draft:    "bg-amber-100   text-amber-700   dark:bg-amber-900/40   dark:text-amber-400",
  sold_out: "bg-red-100     text-red-700     dark:bg-red-900/40     dark:text-red-400",
  inactive: "bg-slate-100   text-slate-500   dark:bg-slate-800      dark:text-slate-400",
};

type Filter = "all" | "active" | "draft" | "low_stock";

const VendorProducts = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    setProductsLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("vendor_id", user?.id)
      .order("created_at", { ascending: false });
    setProducts(data || []);
    setProductsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message || "Failed to delete");
    else { toast.success("Product deleted"); fetchProducts(); }
  };

  const handlePublish = async (id: string) => {
    try {
      const { error } = await supabase.rpc("publish_product", { product_id_to_publish: id });
      if (error) toast.error(error.message || "Failed to publish");
      else { toast.success("Product published! 🎉"); fetchProducts(); }
    } catch (e: any) { toast.error(e.message || "Failed to publish"); }
  };

  /* ── Derived counts ──────────────────────────────────────────────── */
  const active   = products.filter(p => p.status === "active");
  const drafts   = products.filter(p => p.status === "draft");
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 3);

  const displayed = products.filter(p => {
    if (filter === "active")    return p.status === "active";
    if (filter === "draft")     return p.status === "draft";
    if (filter === "low_stock") return p.stock > 0 && p.stock <= 3;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">Loading…</div>
  );

  /* ── Product card ────────────────────────────────────────────────── */
  const ProductCard = ({ product }: { product: any }) => {
    const isLow = product.stock > 0 && product.stock <= 3;
    const isOut = product.stock === 0;
    const isAccessory = product.category === "accessories";

    return (
      <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all duration-200">
        {/* Image */}
        <div className="relative h-40 bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Package className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {/* Status badge overlay */}
          <div className="absolute top-2 left-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize backdrop-blur-sm ${STATUS_PILL[product.status] ?? STATUS_PILL.inactive}`}>
              {product.status === "active" ? "Live" : product.status}
            </span>
          </div>
          {/* Low stock warning */}
          {(isLow || isOut) && (
            <div className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isOut ? "bg-red-500 text-white" : "bg-amber-400 text-amber-900"}`}>
              <AlertTriangle className="h-2.5 w-2.5" />
              {isOut ? "Out" : `${product.stock} left`}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-3">
          <p className="font-semibold text-sm leading-tight truncate mb-0.5">{product.name}</p>
          {isAccessory && (
            <p className="text-[11px] text-muted-foreground mb-1">{getAccessoryTypeName(product.accessory_type || "")}</p>
          )}
          <p className="text-base font-bold text-primary">KES {product.price_ksh?.toLocaleString()}</p>

          {/* Action row */}
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
            {product.status === "draft" && (
              <button
                onClick={() => handlePublish(product.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
              >
                <CheckCircle className="h-3.5 w-3.5" /> Publish
              </button>
            )}
            <button
              onClick={() => navigate(isAccessory ? `/vendor/edit-accessory/${product.id}` : `/vendor/edit-product/${product.id}`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-muted hover:bg-muted/70 text-xs font-semibold transition-colors"
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => handleDelete(product.id)}
              className="h-8 w-8 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ── Skeleton ────────────────────────────────────────────────────── */
  const Skeleton = () => (
    <div className="bg-card border border-border rounded-2xl overflow-hidden animate-pulse">
      <div className="h-40 bg-muted" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-8 bg-muted rounded-xl mt-3" />
      </div>
    </div>
  );

  /* ── Empty state ─────────────────────────────────────────────────── */
  const EmptyState = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
        <Package className="h-9 w-9 text-primary" />
      </div>
      <h3 className="font-bold text-lg mb-1">
        {filter === "all" ? "No products yet" : `No ${filter.replace("_", " ")} products`}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {filter === "all"
          ? "List your first product and start earning today."
          : "Try a different filter to see more products."}
      </p>
      {filter === "all" && (
        <button
          onClick={() => navigate("/vendor/list-item")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Package className="h-4 w-4" /> List your first item
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden">
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24">

          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => navigate("/vendor/dashboard")}
              aria-label="Back"
              className="h-8 w-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Products</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {productsLoading ? "Loading…" : `${products.length} total listing${products.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* ── Stat chips ── */}
          {!productsLoading && products.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-card border border-border rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-emerald-600">{active.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Live</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-3 text-center">
                <p className="text-xl font-bold text-amber-600">{drafts.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Drafts</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-3 text-center">
                <p className={`text-xl font-bold ${lowStock.length > 0 ? "text-red-500" : "text-muted-foreground"}`}>{lowStock.length}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Low Stock</p>
              </div>
            </div>
          )}

          {/* ── Filter pills ── */}
          {!productsLoading && products.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
              {(["all", "active", "draft", "low_stock"] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                    filter === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {f === "all" ? "All" : f === "low_stock" ? "Low Stock" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* ── Product grid ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {productsLoading
              ? [...Array(4)].map((_, i) => <Skeleton key={i} />)
              : displayed.length === 0
              ? <EmptyState />
              : displayed.map(p => <ProductCard key={p.id} product={p} />)
            }
          </div>

        </main>
      </div>

      {/* ── Single FAB — sits above WhatsApp widget ── */}
      <div className="fixed bottom-28 right-4 z-40">
        <button
          onClick={() => navigate("/vendor/list-item")}
          className="flex items-center gap-2 pl-4 pr-5 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-xl hover:bg-primary/90 transition-all"
        >
          <Plus className="h-4 w-4" /> List Item
        </button>
      </div>
    </div>
  );
};

export default VendorProducts;
