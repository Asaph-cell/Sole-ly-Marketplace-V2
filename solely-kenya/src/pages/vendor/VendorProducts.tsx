import { useEffect, useState, useRef } from "react";
import { DashboardSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import {
  Edit, Trash2, CheckCircle, Package, ShoppingBag,
  Plus, AlertTriangle, ChevronLeft, Share2, Copy,
  X, Check, ExternalLink, ImageDown, Loader2, CopyPlus,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { getAccessoryTypeName } from "@/lib/accessoryTypes";
import { QRCodeCanvas } from "qrcode.react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ── Status pill colours ─────────────────────────────────────────── */
const STATUS_PILL: Record<string, string> = {
  active:   "bg-success-soft text-success  ",
  draft:    "bg-primary-soft   text-primary-strong      ",
  sold_out: "bg-destructive-soft     text-destructive          ",
  inactive: "bg-muted   text-muted-foreground         ",
};

type Filter = "all" | "active" | "draft" | "low_stock";

// ── Pay Link Share Modal ──────────────────────────────────────────────
const ShareModal = ({ product, onClose }: { product: any; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);
  // short_code keeps this short enough for an Instagram bio or a printed
  // poster; the uuid is only a fallback for a product created before codes
  // existed, and /buy still accepts both.
  const payLink = `${window.location.origin}/buy/${product.short_code || product.id}`;

  // Story-shaped card rendered server-side, carrying the product, the price
  // and the escrow promise.
  const storyCardUrl =
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image` +
    `?id=${product.id}&format=story`;

  const handleStoryCard = async () => {
    if (cardBusy) return;
    setCardBusy(true);
    try {
      // Fetched as a blob rather than linked directly: the image comes from
      // the Supabase domain, and browsers ignore the `download` attribute on
      // a cross-origin href - it would navigate away instead of saving.
      const res = await fetch(storyCardUrl);
      if (!res.ok) throw new Error(`Card service returned ${res.status}`);
      const blob = await res.blob();
      const fileName = `solely-${(product.name || "product")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40)}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // On a phone this opens the OS share sheet, so the vendor can post
      // straight to Instagram or WhatsApp. Everywhere else, save the file.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: `${product.name} - KES ${product.price_ksh?.toLocaleString()}`,
        });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(objectUrl);
        toast.success("Share card saved");
      }
    } catch (err) {
      // A cancelled share sheet rejects with AbortError - not a failure.
      if ((err as Error)?.name === "AbortError") return;
      console.error("Share card failed:", err);
      toast.error("Couldn't build the share card. Please try again.");
    } finally {
      setCardBusy(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(payLink);
    setCopied(true);
    toast.success("Pay link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hey! I'm selling *${product.name}* for KES ${product.price_ksh?.toLocaleString()}\n\nPay safely through Solely. Your money is held until you confirm delivery.\n\n${payLink}`
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
            <X size={16} strokeWidth={1.5}  />
          </button>
        </div>

        {/* Link display */}
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{payLink}</span>
          <button onClick={handleCopy} className="shrink-0">
            {copied
              ? <Check size={16} strokeWidth={1.5} className=" text-success" />
              : <Copy size={16} strokeWidth={1.5} className=" text-muted-foreground" />}
          </button>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-border font-semibold text-sm hover:bg-muted transition-colors"
          >
            {copied ? <Check size={16} strokeWidth={1.5} className=" text-success" /> : <Copy size={16} strokeWidth={1.5}  />}
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

        {/* Story card */}
        <button
          onClick={handleStoryCard}
          disabled={cardBusy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {cardBusy
            ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            : <ImageDown size={16} strokeWidth={1.5} />}
          {cardBusy ? "Building card..." : "Share Card for Stories"}
        </button>
        <p className="text-[10px] text-muted-foreground text-center -mt-2">
          A ready-to-post image with your product, price and the escrow badge
        </p>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3 pt-1">
          <div className="p-3 bg-card rounded-2xl border border-border">
            <QRCodeCanvas ref={qrRef} value={payLink} size={160} fgColor="#1a1a1a" />
          </div>
          <button
            onClick={handleDownloadQR}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <ExternalLink size={14} strokeWidth={1.5}  /> Download QR Code
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
  const [toDelete, setToDelete] = useState<any | null>(null);
  // Which card is mid-action, so its button can say so and ignore double taps.
  const [busy, setBusy] = useState<{ id: string; action: "publish" | "delete" } | null>(null);
  // Card that just went live, briefly marked so the change is easy to spot.
  const [justPublished, setJustPublished] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  // `quiet` refreshes in place instead of swapping the grid for skeletons,
  // so the card the vendor just acted on stays where their eyes are.
  const fetchProducts = async (quiet = false) => {
    if (!quiet) setProductsLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("vendor_id", user?.id)
      .order("created_at", { ascending: false });
    setProducts(data || []);
    setProductsLoading(false);
  };

  const handleDelete = async () => {
    const product = toDelete;
    if (!product) return;
    setBusy({ id: product.id, action: "delete" });
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    setBusy(null);
    setToDelete(null);
    if (error) {
      toast.error(error, { description: "The product was not deleted." });
      return;
    }
    setProducts((ps) => ps.filter((p) => p.id !== product.id));
    toast.success("Product deleted", { description: product.name });
  };

  const handlePublish = async (id: string) => {
    if (busy) return;
    setBusy({ id, action: "publish" });
    try {
      const { error } = await supabase.rpc("publish_product", { product_id_to_publish: id });
      if (error) throw error;
      await fetchProducts(true);
      setJustPublished(id);
      setTimeout(() => setJustPublished((cur) => (cur === id ? null : cur)), 2500);
      toast.success("Product is live", { description: "Buyers can see it in the shop now." });
    } catch (e) {
      toast.error(e, { retry: () => handlePublish(id) });
    } finally {
      setBusy(null);
    }
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

  if (loading) return <DashboardSkeleton />;

  /* ── Product card ────────────────────────────────────────────────── */
  const ProductCard = ({ product }: { product: any }) => {
    const isLow = product.stock > 0 && product.stock <= 3;
    const isOut = product.stock === 0;
    const isAccessory = product.category === "accessories";

    const publishing = busy?.id === product.id && busy.action === "publish";
    const fresh = justPublished === product.id;

    return (
      <div className={`group bg-card border rounded-2xl overflow-hidden hover:shadow-md transition-[box-shadow,border-color] duration-200 ${fresh ? "border-success ring-2 ring-success/25" : "border-border"}`}>
        {/* Image */}
        <div className="relative h-40 bg-muted">
          {(product.images?.[0] || product.image_url) ? (
            <img
              src={product.images?.[0] || product.image_url}
              alt={product.name}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Package strokeWidth={1.5} className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {/* Status badge overlay */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <span className={`inline-flex w-fit items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize backdrop-blur-sm ${STATUS_PILL[product.status] ?? STATUS_PILL.inactive}`}>
              {fresh && <Check size={10} strokeWidth={3} />}
              {product.status === "active" ? "Live" : product.status}
            </span>
            {product.free_delivery && (
              <span className="w-fit text-[10px] font-bold px-2 py-0.5 rounded-full bg-success text-white backdrop-blur-sm shadow-sm">
                Free Delivery
              </span>
            )}
          </div>
          {/* Low stock warning */}
          {(isLow || isOut) && (
            <div className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isOut ? "bg-destructive text-white" : "bg-primary text-primary-strong"}`}>
              <AlertTriangle strokeWidth={1.5} className="h-2.5 w-2.5" />
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
                disabled={!!busy}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-success hover:bg-success text-white text-xs font-semibold transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-70"
              >
                {publishing
                  ? <><Loader2 size={14} strokeWidth={1.75} className="animate-spin" /> Publishing…</>
                  : <><CheckCircle size={14} strokeWidth={1.5} /> Publish</>}
              </button>
            )}
            <button
              onClick={() => navigate(isAccessory ? `/vendor/edit-accessory/${product.id}` : `/vendor/edit-product/${product.id}`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-muted hover:bg-muted/70 text-xs font-semibold transition-colors"
            >
              <Edit size={14} strokeWidth={1.5}  /> Edit
            </button>
            {/* Same details, new photos: for the same item in another size or colour. */}
            {!isAccessory && (
              <button
                onClick={() => navigate("/vendor/list-item", { state: { cloneFrom: product } })}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="List another like this"
                aria-label={`List another like ${product.name}`}
              >
                <CopyPlus size={14} strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={() => setToDelete(product)}
              aria-label={`Delete ${product.name}`}
              className="h-8 w-8 flex items-center justify-center rounded-xl text-destructive hover:bg-destructive-soft transition-colors"
            >
              <Trash2 size={14} strokeWidth={1.5}  />
            </button>
            {/* Share Pay Link */}
            <button
              onClick={() => setShareProduct(product)}
              className="h-8 w-8 flex items-center justify-center rounded-xl text-primary hover:bg-primary/10 transition-colors"
              title="Share Pay Link"
              aria-label={`Share pay link for ${product.name}`}
            >
              <Share2 size={14} strokeWidth={1.5}  />
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
        <Package strokeWidth={1.5} className="h-9 w-9 text-primary" />
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
        <Button onClick={() => navigate("/vendor/list-item")} className="h-11 rounded-full px-5">
          <Package size={16} strokeWidth={1.75} /> List your first item
        </Button>
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
              <ChevronLeft size={16} strokeWidth={1.5}  />
            </button>
            <div>
              <h1 className="font-display text-3xl leading-tight">Products</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {productsLoading ? "Loading…" : `${products.length} total listing${products.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* ── Filter pills ── */}
          {!productsLoading && products.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
              {([
                ["all", "All", products.length],
                ["active", "Live", active.length],
                ["draft", "Drafts", drafts.length],
                ["low_stock", "Low stock", lowStock.length],
              ] as [Filter, string, number][]).map(([f, label, count]) => {
                const on = filter === f;
                const alert = f === "low_stock" && count > 0;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={on}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-out-strong active:scale-[0.97] ${
                      on
                        ? "border-secondary bg-secondary text-secondary-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                    }`}
                  >
                    {label}
                    <span className={`tabular-nums ${on ? "opacity-70" : alert ? "text-destructive" : "opacity-60"}`}>{count}</span>
                  </button>
                );
              })}
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

      {/* ── Single FAB ── */}
      <div className="fixed bottom-6 right-4 z-40">
        <Button onClick={() => navigate("/vendor/list-item")} className="h-12 rounded-full pl-4 pr-5">
          <Plus size={18} strokeWidth={2} /> List item
        </Button>
      </div>
      {/* ── Pay Link Share Modal ── */}
      {shareProduct && (
        <ShareModal product={shareProduct} onClose={() => setShareProduct(null)} />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => { if (!open && !busy) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.name} will be removed from your store. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel disabled={!!busy} className="mt-0 flex-1">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={!!busy}
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy?.action === "delete" ? <><Loader2 size={16} className="animate-spin" /> Deleting…</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VendorProducts;
