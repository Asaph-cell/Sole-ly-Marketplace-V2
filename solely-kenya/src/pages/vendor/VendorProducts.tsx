import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import {
  Edit, Trash2, CheckCircle, Package, ShoppingBag,
  Plus, AlertTriangle, ChevronLeft, Share2, Copy,
  X, Check, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { getAccessoryTypeName } from "@/lib/accessoryTypes";
import { QRCodeCanvas } from "qrcode.react";

/* ── Status pill colours ─────────────────────────────────────────── */
const STATUS_PILL: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  draft:    "bg-amber-100   text-amber-700   dark:bg-amber-900/40   dark:text-amber-400",
  sold_out: "bg-red-100     text-red-700     dark:bg-red-900/40     dark:text-red-400",
  inactive: "bg-slate-100   text-slate-500   dark:bg-slate-800      dark:text-slate-400",
};

type Filter = "all" | "active" | "draft" | "low_stock";

// ── Pay Link Share Modal ──────────────────────────────────────────────
const ShareModal = ({ product, onClose }: { product: any; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const payLink = `${window.location.origin}/buy/${product.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(payLink);
    setCopied(true);
    toast.success("Pay link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hey! I'm selling *${product.name}* for KES ${product.price_ksh?.toLocaleString()} 🛍️\n\nPay safely through Solely escrow — your money is held until you confirm delivery 🔒\n\n👉 ${payLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  const handleDownloadQR = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `solely-pay-link-${product.id}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-background rounded-3xl p-5 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-base">Share Pay Link</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]">{product.name}</p>
          </div>
          <button onClick={onClose} className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Link display */}
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{payLink}</span>
          <button onClick={handleCopy} className="shrink-0">
            {copied
              ? <Check className="h-4 w-4 text-emerald-500" />
              : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-border font-semibold text-sm hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#25D366] text-white font-semibold text-sm hover:bg-[#22c55e] transition-colors"
          >
            <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3 pt-1">
          <div className="p-3 bg-white rounded-2xl border border-border">
            <QRCodeCanvas ref={qrRef} value={payLink} size={160} fgColor="#1a1a1a" />
          </div>
          <button
            onClick={handleDownloadQR}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Download QR Code
          </button>
          <p className="text-[10px] text-muted-foreground text-center">Print this QR and attach to your TikTok bio, business card, or product packaging</p>
        </div>
      </div>
    </div>
  );
};

const VendorProducts = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [shareProduct, setShareProduct] = useState<any | null>(null);

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
            {/* Share Pay Link */}
            <button
              onClick={() => setShareProduct(product)}
              className="h-8 w-8 flex items-center justify-center rounded-xl text-primary hover:bg-primary/10 transition-colors"
              title="Share Pay Link"
            >
              <Share2 className="h-3.5 w-3.5" />
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
      {/* ── Pay Link Share Modal ── */}
      {shareProduct && (
        <ShareModal product={shareProduct} onClose={() => setShareProduct(null)} />
      )}
    </div>
  );
};

export default VendorProducts;
