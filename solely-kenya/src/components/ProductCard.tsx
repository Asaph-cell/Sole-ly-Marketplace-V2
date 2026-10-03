import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Truck, RefreshCcw, Recycle, Play, Pause, Star, Check, Sparkles, ShoppingCart } from "lucide-react";
import { useLiveOffers } from "@/lib/liveOffers";
import { motion } from "framer-motion";

import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/lib/toast";

interface ProductCardProps {
  id: number | string;
  name: string;
  price: number;
  /** Was-price for reductions; only shown when higher than price. */
  originalPrice?: number | null;
  image: string;
  brand?: string;
  description?: string;
  averageRating?: number | null;
  reviewCount?: number;
  createdAt: string;
  condition?: "new" | "thrifted" | "refurbished" | "like_new" | "good" | "fair";
  videoUrl?: string | null;
  freeDelivery?: boolean | null;
  category?: string;
  vendorId?: string;
}

// Inline star display (read-only)
const StarDisplay = ({ value, count }: { value?: number | null; count?: number }) => {
  if (!value || value === 0) return null;
  const rounded = Math.round(value * 2) / 2; // round to nearest 0.5
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={11}
            strokeWidth={1.5}
            className={
              star <= Math.floor(rounded)
                ? "fill-primary-strong text-primary-strong"
                : star - 0.5 === rounded
                ? "fill-primary-foreground text-primary-strong"
                : "text-muted-foreground"
            }
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground font-medium">
        {value.toFixed(1)}
        {count ? ` (${count})` : ""}
      </span>
    </div>
  );
};

const ProductCard = ({
  id,
  name,
  price,
  originalPrice,
  image,
  brand,
  description,
  averageRating,
  reviewCount,
  createdAt,
  condition = "new",
  videoUrl,
  freeDelivery,
  category,
  vendorId,
}: ProductCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { addItem } = useCart();
  const { isWished, toggle } = useWishlist();
  const { user } = useAuth();
  const navigate = useNavigate();
  const wished = isWished(String(id));
  const offer = useLiveOffers().get(vendorId ?? "");
  // Bumped on each like; keys the heart so the pop replays every time.
  const [likePop, setLikePop] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(addedTimer.current), []);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle hover for desktop
  useEffect(() => {
    if (!isMobile && videoRef.current && videoUrl) {
      if (isHovering) {
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isHovering, isMobile, videoUrl]);

  // Handle tap for mobile
  const handleMobileTap = (e: React.MouseEvent) => {
    if (isMobile && videoUrl) {
      e.preventDefault();
      e.stopPropagation();
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          videoRef.current.play().catch(() => { });
          setIsPlaying(true);
        }
      }
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to add items to your cart");
      navigate(`/auth?redirect=/product/${id}`);
      return;
    }
    addItem({
      productId: String(id),
      vendorId: vendorId ?? "unknown",
      name,
      priceKsh: price,
      imageUrl: image,
      category,
    });
    toast.success("Added to cart", { description: name, duration: 2000 });
    // Brief confirmation on the button itself, where the user is looking.
    setJustAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(false), 1400);
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to save items to your wishlist");
      navigate(`/auth?redirect=/wishlist`);
      return;
    }
    if (!wished) setLikePop((n) => n + 1);
    toggle(String(id));
  };

  // Calculate if product is new (within last 30 days)
  const isNew = (Date.now() - new Date(createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;

  const wasPrice = originalPrice && originalPrice > price ? originalPrice : null;
  const percentOff = wasPrice ? Math.max(1, Math.round((1 - price / wasPrice) * 100)) : 0;

  // Format price with commas (e.g. 65000 -> 65,000)
  const formatPrice = (p: number) => {
    return p.toLocaleString();
  };

  // Determine background color based on category
  const getBgColor = (cat?: string) => {
    if (!cat) return "bg-[#e2e8f0]";
    const c = cat.toLowerCase();
    if (c === "womens-fashion" || c === "beauty") return "bg-[#fce7f3]";
    if (c === "electronics" || c === "phones" || c === "laptops") return "bg-[#e2e8f0]";
    if (c === "shoes") return "bg-[#fef3c7]";
    if (c === "bags") return "bg-[#ffedd5]";
    if (c === "sports") return "bg-[#dcfce7]";
    return "bg-[#f1f5f9]";
  };

  return (
    <div
      onMouseEnter={() => !isMobile && setIsHovering(true)}
      onMouseLeave={() => !isMobile && setIsHovering(false)}
      className="h-full"
    >
      <Link
        to={`/product/${id}`}
        className="card block h-full group bg-card border border-border rounded-[20px] overflow-hidden hover:shadow-xl hover:border-border hover:-translate-y-1 transition-[transform,box-shadow,border-color] duration-200 ease-out-strong flex flex-col relative"
      >
        {/* ── img-wrap ── */}
        <div
          className={`img-wrap relative w-full aspect-square overflow-hidden`}
          onClick={handleMobileTap}
        >
          {/* New, top left */}
          {isNew && (
            <span className="badge absolute top-2.5 left-2.5 z-10 px-2 py-1 bg-[#c2841d] text-white text-[10px] leading-none font-bold rounded-full shadow-sm">
              New
            </span>
          )}

          {/* Video indicator, left of the heart */}
          {videoUrl && (
            <span className="absolute top-2.5 right-12 z-10 flex items-center justify-center w-7 h-7 bg-card/90 text-foreground rounded-full shadow-sm" aria-hidden>
              {isPlaying ? <Pause size={12} strokeWidth={2.5} /> : <Play size={12} strokeWidth={2.5} className="ml-0.5" />}
            </span>
          )}

          {/* Wishlist button */}
          <button
            className={`wishlist absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-card/90 shadow-sm transition-[transform,background-color,color] duration-150 ease-out hover:bg-card active:scale-90 ${wished ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
            onClick={handleWishlist}
            aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={wished}
          >
            {/* Hover only darkens the outline, so nobody thinks they liked it by
                pointing at it. The fill and the pop happen on the click itself. */}
            <span key={likePop} className={`flex ${likePop && wished ? "fx-like-pop" : ""}`}>
              <Heart size={15} strokeWidth={2} className={wished ? "fill-destructive" : ""} />
            </span>
          </button>

          {/* Native lazy loading fetches well ahead of the viewport, so fast
              scrolls land on loaded images instead of blurred placeholders. */}
          <img
            src={image}
            alt={name}
            loading="lazy"
            decoding="async"
            className={`w-full h-full bg-muted object-cover transition-[transform,opacity] duration-300 ease-out-strong group-hover:scale-105 ${(isHovering || isPlaying) && videoUrl ? "opacity-0" : "opacity-100"}`}
          />

          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovering || isPlaying ? "opacity-100" : "opacity-0"}`}
              muted
              loop
              playsInline
              preload="none"
            />
          )}

        </div>

        {/* ── label strip: Free delivery / Thrifted / Refurbished ── */}
        {(freeDelivery || condition !== "new") && (
          <div className="flex text-[10px] font-extrabold text-white leading-none">
            {freeDelivery && (
              <span className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 bg-[#1a5138] whitespace-nowrap">
                <Truck size={12} strokeWidth={2.5} /> Free delivery
              </span>
            )}
            {(condition === "refurbished" || condition === "like_new") && (
              <span className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 bg-[#2b4162] whitespace-nowrap">
                <RefreshCcw size={12} strokeWidth={2.5} /> Refurbished
              </span>
            )}
            {(condition === "thrifted" || condition === "good" || condition === "fair") && (
              <span className="flex-1 flex items-center justify-center gap-1 py-1.5 px-1 bg-[#5b3671] whitespace-nowrap">
                <Recycle size={12} strokeWidth={2.5} /> Thrifted
              </span>
            )}
          </div>
        )}

        {/* ── body: price first ── */}
        <div className="body p-2.5 sm:p-3 flex flex-col flex-grow gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="price font-extrabold text-[#c2841d] leading-none whitespace-nowrap text-[17px] sm:text-[19px]">
              <span className="text-[0.6em] tracking-wide mr-0.5">KES</span>
              {formatPrice(price)}
            </span>
            <button
              onClick={handleAddToCart}
              aria-live="polite"
              aria-label={justAdded ? "Added to cart" : "Add to cart"}
              className={`btn-fx shrink-0 flex items-center justify-center w-9 h-9 rounded-xl shadow-sm ${justAdded ? "bg-success text-success-foreground" : "bg-foreground text-background hover:bg-foreground/85"}`}
            >
              {justAdded ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="flex"
                >
                  <Check size={16} strokeWidth={3} />
                </motion.span>
              ) : (
                <ShoppingCart size={16} strokeWidth={2.2} />
              )}
            </button>
          </div>

          {wasPrice && (
            <div className="flex items-center gap-1.5 -mt-0.5 leading-none">
              <s className="text-[11px] text-muted-foreground font-semibold whitespace-nowrap">KES {formatPrice(wasPrice)}</s>
              <span className="px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-extrabold">-{percentOff}%</span>
            </div>
          )}

          {/* Name: two lines, no description */}
          <p className="name text-[13px] sm:text-[14px] font-bold text-foreground leading-tight line-clamp-2 min-h-[2.5em]" title={name}>
            {name}
          </p>

          <StarDisplay value={averageRating} count={reviewCount} />

          {/* Seller offer: up to two lines so longer wording still reads */}
          {offer && (
            <span className="mt-auto flex items-start gap-1.5 px-2 py-1.5 bg-[#14213d] text-[#ffd166] text-[10.5px] leading-tight font-extrabold rounded-lg">
              <Sparkles size={11} strokeWidth={2.5} className="shrink-0 mt-px" />
              <span className="line-clamp-2 break-words min-w-0">{offer.title}</span>
            </span>
          )}
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;
