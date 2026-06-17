import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, Truck, RefreshCcw, Recycle, Play, Star } from "lucide-react";
import { motion } from "framer-motion";
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ProductCardProps {
  id: number | string;
  name: string;
  price: number;
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
                ? "fill-amber-400 text-amber-400"
                : star - 0.5 === rounded
                ? "fill-amber-200 text-amber-400"
                : "text-gray-300"
            }
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-500 font-medium">
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
    });
    toast.success("Added to cart", { description: name, duration: 2000 });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Please sign in to save items to your wishlist");
      navigate(`/auth?redirect=/wishlist`);
      return;
    }
    toggle(String(id));
  };

  // Calculate if product is new (within last 30 days)
  const isNew = (Date.now() - new Date(createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;

  // Format price (e.g. 65000 -> 65K, 10000 -> 10K)
  const formatPrice = (p: number) => {
    if (p >= 1000 && p % 1000 === 0) return `${p / 1000}K`;
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
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
      onMouseEnter={() => !isMobile && setIsHovering(true)}
      onMouseLeave={() => !isMobile && setIsHovering(false)}
      className="h-full"
    >
      <Link
        to={`/product/${id}`}
        className="card block h-full group bg-white border border-gray-100 rounded-[20px] overflow-hidden hover:shadow-xl hover:border-gray-200 transition-all duration-300 flex flex-col relative"
      >
        {/* ── img-wrap ── */}
        <div
          className={`img-wrap relative w-full aspect-square overflow-hidden`}
          onClick={handleMobileTap}
        >
          {/* Condition badges — top left */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 items-start">
            {freeDelivery && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a5138] text-white text-[10px] font-extrabold rounded-full tracking-wide shadow-sm">
                <Truck size={12} strokeWidth={2.5} /> Free delivery
              </span>
            )}
            {(condition === "refurbished" || condition === "like_new") && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#2b4162] text-white text-[10px] font-extrabold rounded-full tracking-wide shadow-sm">
                <RefreshCcw size={12} strokeWidth={2.5} /> Refurbished
              </span>
            )}
            {(condition === "thrifted" || condition === "good" || condition === "fair") && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#5b3671] text-white text-[10px] font-extrabold rounded-full tracking-wide shadow-sm">
                <Recycle size={12} strokeWidth={2.5} /> Thrifted
              </span>
            )}
          </div>

          {/* "New" badge — top right area, alongside video indicator */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10 items-end">
            {isNew && (
              <span className="badge px-2 py-0.5 bg-[#c2841d] text-white text-[10px] font-bold rounded-full shadow-sm">
                New
              </span>
            )}
            {videoUrl && (
              <span className="flex items-center justify-center w-7 h-7 bg-white/80 backdrop-blur text-gray-900 rounded-full shadow-sm">
                <Play size={12} strokeWidth={2.5} className="ml-0.5" />
              </span>
            )}
          </div>

          {/* Wishlist button */}
          <button
            className={`wishlist absolute bottom-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 backdrop-blur shadow-sm transition-all duration-200 hover:scale-110 hover:bg-white ${wished ? "text-rose-500" : "text-gray-400 hover:text-rose-400"}`}
            onClick={handleWishlist}
            aria-label="Add to wishlist"
          >
            <Heart size={15} strokeWidth={2} className={wished ? "fill-rose-500" : ""} />
          </button>

          <LazyLoadImage
            src={image}
            alt={name}
            effect="blur"
            className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${(isHovering || isPlaying) && videoUrl ? "opacity-0" : "opacity-100"}`}
            wrapperClassName="w-full h-full"
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

          {videoUrl && isMobile && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
                <Play strokeWidth={2} size={24} className="text-white fill-white" />
              </div>
            </div>
          )}
        </div>

        {/* ── body ── */}
        <div className="body p-3.5 flex flex-col flex-grow gap-1">
          {/* Brand */}
          <span className="brand text-[10px] font-extrabold text-gray-500 uppercase tracking-widest block truncate">
            {brand || "\u00A0"}
          </span>

          {/* Product Name */}
          <p className="name text-[14px] sm:text-[15px] font-bold text-gray-900 leading-tight line-clamp-1">
            {name}
          </p>

          {/* Description */}
          {description && (
            <p className="desc text-[11px] text-gray-400 leading-snug line-clamp-2">
              {description}
            </p>
          )}

          {/* Star Rating */}
          <StarDisplay value={averageRating} count={reviewCount} />

          {/* Footer: price + add button */}
          <div className="footer mt-auto pt-2 flex items-center justify-between gap-2">
            <span className="price text-base sm:text-[18px] font-extrabold text-[#c2841d] leading-none">
              KES {formatPrice(price)}
            </span>
            <button
              onClick={handleAddToCart}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 active:scale-95 transition-all text-xs font-bold shadow-sm"
            >
              Add
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
