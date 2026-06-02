import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Truck, RefreshCcw, Recycle, Play } from "lucide-react";
import { motion } from "framer-motion";
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  image: string;
  brand?: string;
  averageRating?: number | null;
  reviewCount?: number;
  createdAt: string;
  condition?: "new" | "thrifted" | "refurbished" | "like_new" | "good" | "fair";
  videoUrl?: string | null;
  freeDelivery?: boolean | null;
  category?: string;
}

const ProductCard = ({
  id,
  name,
  price,
  image,
  brand,
  createdAt,
  condition = "new",
  videoUrl,
  freeDelivery,
  category,
}: ProductCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Calculate if product is new (within last 30 days)
  const isNew = (Date.now() - new Date(createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000;

  // Format price (e.g. 65000 -> 65K, 10000 -> 10K, else 10 -> 10)
  const formatPrice = (p: number) => {
    if (p >= 1000 && p % 1000 === 0) {
      return `${p / 1000}K`;
    }
    return p.toLocaleString();
  };

  // Determine background color based on category
  const getBgColor = (cat?: string) => {
    if (!cat) return "bg-[#e2e8f0]"; // default slate
    const c = cat.toLowerCase();
    if (c === "womens-fashion" || c === "beauty") return "bg-[#fce7f3]"; // soft pink
    if (c === "electronics" || c === "phones" || c === "laptops") return "bg-[#e2e8f0]"; // soft blue/slate
    if (c === "shoes") return "bg-[#fef3c7]"; // soft amber/beige
    if (c === "bags") return "bg-[#ffedd5]"; // soft orange/beige
    if (c === "sports") return "bg-[#dcfce7]"; // soft green
    return "bg-[#f1f5f9]"; // default slate
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
      onMouseEnter={() => !isMobile && setIsHovering(true)}
      onMouseLeave={() => !isMobile && setIsHovering(false)}
      className="h-full"
    >
      <Link to={`/product/${id}`} className="block h-full group bg-white border border-gray-100 rounded-[20px] overflow-hidden hover:shadow-xl hover:border-gray-200 transition-all duration-300 flex flex-col relative">
        {/* Top Image Container */}
        <div 
          className={`relative w-full aspect-square p-5 flex items-center justify-center ${getBgColor(category)} overflow-hidden`}
          onClick={handleMobileTap}
        >
          {/* Top Left Badges */}
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

          {/* Top Right Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
            {videoUrl && (
              <span className="flex items-center justify-center w-7 h-7 bg-white/80 backdrop-blur text-gray-900 rounded-full shadow-sm">
                <Play size={12} strokeWidth={2.5} className="ml-0.5" />
              </span>
            )}
          </div>

          <LazyLoadImage
            src={image}
            alt={name}
            effect="blur"
            className={`w-full h-full object-contain drop-shadow-md mix-blend-multiply transition-all duration-500 group-hover:scale-105 ${(isHovering || isPlaying) && videoUrl ? "opacity-0" : "opacity-100"}`}
            wrapperClassName="w-full h-full flex items-center justify-center"
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

        {/* Bottom Content Container */}
        <div className="p-4 flex flex-col flex-grow">
          {/* Brand */}
          <div className="mb-0.5">
            <span className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block truncate">
              {brand || "\u00A0"}
            </span>
          </div>

          {/* Product Name */}
          <h3 className="text-[15px] sm:text-[16px] font-bold text-gray-900 leading-tight line-clamp-1 mb-2">
            {name}
          </h3>

          {/* New Listing Badge */}
          <div className="mb-3">
            {isNew ? (
              <span className="inline-flex items-center px-2 py-0.5 bg-[#fef3c7] text-[#b45309] text-[10px] font-bold rounded">
                New
              </span>
            ) : (
              <span className="inline-block opacity-0 text-[10px] py-0.5">Placeholder</span>
            )}
          </div>

          {/* Price & Add Button */}
          <div className="mt-auto flex items-end justify-between">
            <div className="text-lg sm:text-[22px] font-extrabold text-[#c2841d]">
              KES {formatPrice(price)}
            </div>
            
            <button 
              onClick={(e) => {
                // Allows the Link to still trigger, or we can e.preventDefault() to handle cart.
                // For now we just let it act as part of the card (or visually an add button).
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm text-gray-900 font-bold text-xs sm:text-sm"
            >
              <ShoppingCart size={14} strokeWidth={2.5} /> Add
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
