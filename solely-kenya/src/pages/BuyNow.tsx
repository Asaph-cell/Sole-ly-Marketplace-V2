import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import {
  Shield, Star, CheckCircle, ChevronLeft, ChevronRight,
  Lock, Truck, ThumbsUp, AlertTriangle, Share2, Copy
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";

const BuyNow = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem, clearCart } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [vendorStats, setVendorStats] = useState({ rating: 0, sales: 0, reviews: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (productId) fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const { data: p, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("status", "active")
        .single();

      if (error || !p) { setLoading(false); return; }
      setProduct(p);

      // Vendor profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", p.vendor_id)
        .single();
      setVendor(prof);

      // Vendor stats — rating + completed sales
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .eq("vendor_id", p.vendor_id);

      const { count: salesCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", p.vendor_id)
        .eq("status", "completed");

      const reviewCount = reviews?.length ?? 0;
      const avg = reviewCount > 0
        ? (reviews!.reduce((s, r) => s + r.rating, 0) / reviewCount)
        : 0;

      setVendorStats({ rating: avg, sales: salesCount ?? 0, reviews: reviewCount });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = () => {
    if (!product) return;

    const needsSize = product.sizes?.length > 0 && product.sizes[0] !== "";
    const needsColor = product.colors?.length > 0 && product.colors[0] !== "";

    if (needsSize && !selectedSize) { toast.error("Please select a size"); return; }
    if (needsColor && !selectedColor) { toast.error("Please select a colour"); return; }
    if (product.stock === 0) { toast.error("This item is out of stock"); return; }

    clearCart();
    addItem({
      productId: product.id,
      vendorId: product.vendor_id,
      name: product.name,
      priceKsh: product.price_ksh,
      imageUrl: product.images?.[0] ?? null,
      size: selectedSize,
      availableSizes: product.sizes ?? [],
      color: selectedColor,
      availableColors: product.colors ?? [],
    }, 1);

    navigate("/checkout");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    if (!product) return;
    const msg = encodeURIComponent(
      `Hey! Check out *${product.name}* for KES ${product.price_ksh.toLocaleString()} 🛍️\n\nPay safely through Solely's escrow — your money is protected until you confirm delivery 🔒\n\n👉 ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <AlertTriangle strokeWidth={1.5} className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Product not found</h1>
        <p className="text-muted-foreground text-sm text-center">
          This link may have expired or the item is no longer available.
        </p>
        <button
          onClick={() => navigate("/shop")}
          className="px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Browse the marketplace
        </button>
      </div>
    );
  }

  const needsSize = product.sizes?.length > 0 && product.sizes[0] !== "";
  const needsColor = product.colors?.length > 0 && product.colors[0] !== "";
  const images: string[] = product.images ?? [];

  const conditionMap: Record<string, string> = {
    new: "Brand New", like_new: "Like New", good: "Thrifted",
    fair: "Thrifted", thrifted: "Thrifted", refurbished: "Refurbished",
  };

  // Specs from new jsonb column
  const specs = product.specs as Record<string, string> | null;
  const specEntries = specs ? Object.entries(specs).filter(([, v]) => v) : [];

  return (
    <div className="min-h-screen bg-background">
      {product && (
        <SEO
          title={`Buy ${product.name} — KES ${product.price_ksh.toLocaleString()} | Solely`}
          description={`${product.name} for KES ${product.price_ksh.toLocaleString()}. Pay safely through Solely escrow. Funds released only when you confirm delivery.`}
          image={images[0]}
          type="product"
          canonical={`https://solely.ke/buy/${product.id}`}
        />
      )}

      {/* ── Trust top bar ── */}
      <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2">
        <Lock strokeWidth={1.5} className="h-3 w-3" />
        Solely Escrow — Your money is protected until you confirm delivery
      </div>

      {/* ── Minimal header ── */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={1.5}  />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="font-black text-lg tracking-tight text-primary">SOLE</span>
          <span className="font-black text-lg tracking-tight">.LY</span>
        </div>
        <button
          onClick={handleCopyLink}
          className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <CheckCircle size={16} strokeWidth={1.5} className=" text-green-500" /> : <Share2 size={16} strokeWidth={1.5}  />}
        </button>
      </header>

      <div className="max-w-lg mx-auto pb-32">

        {/* ── Image gallery ── */}
        <div className="relative bg-muted">
          {images.length > 0 ? (
            <img
              src={images[selectedImage]}
              alt={product.name}
              className="w-full aspect-square object-cover"
            />
          ) : (
            <div className="w-full aspect-square flex items-center justify-center">
              <Shield strokeWidth={1.5} className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}

          {/* Image nav arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={() => setSelectedImage(i => Math.max(0, i - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center"
              >
                <ChevronLeft size={16} strokeWidth={1.5}  />
              </button>
              <button
                onClick={() => setSelectedImage(i => Math.min(images.length - 1, i + 1))}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 text-white flex items-center justify-center"
              >
                <ChevronRight size={16} strokeWidth={1.5}  />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`h-1.5 rounded-full transition-all ${i === selectedImage ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none bg-background border-b border-border">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`h-14 w-14 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${i === selectedImage ? "border-primary" : "border-border"}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pt-5 space-y-5">

          {/* ── Name + price ── */}
          <div>
            {product.brand && (
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">{product.brand}</p>
            )}
            <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
            <p className="text-3xl font-black text-primary mt-2">
              KES {product.price_ksh.toLocaleString()}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {product.stock > 0 ? (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  ✓ In Stock ({product.stock} available)
                </span>
              ) : (
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  Out of Stock
                </span>
              )}
              {product.condition && (
                <span className="text-xs font-semibold bg-muted px-2.5 py-1 rounded-full">
                  {conditionMap[product.condition] ?? product.condition}
                </span>
              )}
            </div>
          </div>

          {/* ── Seller card ── */}
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/60 border border-border">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {vendor?.full_name?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate flex items-center gap-1">
                {vendor?.full_name ?? "Solely Vendor"}
                {vendor?.is_verified && <CheckCircle size={14} strokeWidth={1.5} className=" text-primary shrink-0" />}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                {vendorStats.rating > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star strokeWidth={1.5} className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {vendorStats.rating.toFixed(1)} ({vendorStats.reviews})
                  </span>
                )}
                {vendorStats.sales > 0 && (
                  <span className="text-xs text-muted-foreground">{vendorStats.sales} sales</span>
                )}
              </div>
            </div>
            <Shield size={20} strokeWidth={1.5} className=" text-primary shrink-0" />
          </div>

          {/* ── Specs ── */}
          {specEntries.length > 0 && (
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Specifications</p>
              </div>
              <div className="divide-y divide-border">
                {specEntries.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                    <span className="text-xs font-semibold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Description ── */}
          {product.description && (
            <div>
              <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* ── Size selector ── */}
          {needsSize && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Select Size</label>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose your size" />
                </SelectTrigger>
                <SelectContent>
                  {product.sizes.map((s: string) => (
                    <SelectItem key={s} value={s}>EU {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Colour selector ── */}
          {needsColor && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">Select Colour</label>
              <Select value={selectedColor} onValueChange={setSelectedColor}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose a colour" />
                </SelectTrigger>
                <SelectContent>
                  {product.colors.map((c: string) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── How escrow works ── */}
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Lock size={16} strokeWidth={1.5} className=" text-primary" />
              <p className="text-sm font-bold text-primary">How your payment is protected</p>
            </div>
            <div className="space-y-3">
              {[
                { icon: Lock, title: "You pay securely", desc: "Your payment goes into Solely escrow — not to the seller yet" },
                { icon: Truck, title: "Seller delivers", desc: "Seller ships or hands over the item. You receive a Package PIN" },
                { icon: ThumbsUp, title: "You confirm & release", desc: "Happy with the item? Enter your PIN. Seller gets paid instantly." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Share this listing ── */}
          <div className="rounded-2xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Share this listing</p>
            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-muted text-sm font-semibold hover:bg-muted/70 transition-colors"
              >
                {copied ? <CheckCircle size={16} strokeWidth={1.5} className=" text-green-500" /> : <Copy size={16} strokeWidth={1.5}  />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#22c55e] transition-colors"
              >
                <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto space-y-2">
          <button
            onClick={handleBuy}
            disabled={product.stock === 0}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg"
          >
            <Lock size={16} strokeWidth={1.5}  />
            Buy Securely — KES {product.price_ksh.toLocaleString()}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            🔒 Funds held in escrow · Released only when you confirm delivery
          </p>
        </div>
      </div>
    </div>
  );
};

export default BuyNow;
