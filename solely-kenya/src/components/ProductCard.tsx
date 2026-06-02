
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "./ui/card";
import { Badge } from "./ui/badge";
import { Star, Play } from "lucide-react";
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
}

const conditionLabels: Record<string, { label: string; color: string }> = {
  new:         { label: "New",         color: "bg-emerald-500" },
  thrifted:    { label: "Thrifted",    color: "bg-purple-500" },
  refurbished: { label: "Refurbished", color: "bg-blue-500" },
  // Legacy
  like_new: { label: "Like New", color: "bg-blue-500" },
  good:     { label: "Thrifted", color: "bg-purple-500" },
  fair:     { label: "Thrifted", color: "bg-purple-500" },
};

const ProductCard = ({
  id,
  name,
  price,
  image,
  brand,
  averageRating,
  reviewCount = 0,
  createdAt,
  condition = "new",
  videoUrl,
  freeDelivery
}: ProductCardProps) => {
  const conditionInfo = conditionLabels[condition] || conditionLabels.new;
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

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 300 }}
      onMouseEnter={() => !isMobile && setIsHovering(true)}
      onMouseLeave={() => !isMobile && setIsHovering(false)}
    >
      <Link to={`/product/${id}`} className="group">
        <Card className="h-full flex flex-col overflow-hidden">
          <CardContent className="p-0 relative -mx-5 -mt-5 mb-4">
            <div
              className="w-full overflow-hidden bg-white relative rounded-t-md"
              onClick={handleMobileTap}
            >
              {/* Image (always visible as base layer) - with blur lazy load */}
              <LazyLoadImage
                src={image}
                alt={`${brand ? brand + ' ' : ''}${name} for Sale in Kenya`}
                effect="blur"
                className={`w-full h-auto object-cover transition-opacity duration-300 ${(isHovering || isPlaying) && videoUrl ? "opacity-0" : "opacity-100"
                  }`}
                wrapperClassName="w-full h-auto block"
              />

              {/* Video (lazy loaded, shown on hover/tap) */}
              {videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${isHovering || isPlaying ? "opacity-100" : "opacity-0"
                    }`}
                  muted
                  loop
                  playsInline
                  preload="none"
                />
              )}

              {/* Play button overlay for mobile */}
              {videoUrl && isMobile && !isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/50 rounded-full p-3">
                    <Play strokeWidth={1.5} size={24} className="text-white fill-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Condition Badge - Top Left */}
            <Badge
              variant="secondary"
              className="absolute top-3 left-3 shadow-sm"
            >
              {conditionInfo.label}
            </Badge>

            {/* Video & Free Delivery Badges - Top Right area */}
            <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
              {freeDelivery && (
                <Badge variant="success" className="shadow-sm">
                  🚚 Free Delivery
                </Badge>
              )}
              {videoUrl && (
                <Badge variant="secondary" className="shadow-sm bg-purple-500/15 text-purple-500">
                  📹 Video
                </Badge>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-1 p-0 flex-grow">
            <span className="text-xs text-muted-foreground uppercase tracking-wide min-h-[1.5em] block">
              {brand || "\u00A0"}
            </span>
            <h3 className="font-semibold text-[clamp(0.9rem,3vw,1.125rem)] group-hover:text-primary transition-colors line-clamp-2 break-words">
              {name}
            </h3>
            <div className="flex items-center gap-1 mb-2">
              {reviewCount > 0 && averageRating ? (
                <>
                  <Star size={16} strokeWidth={1.5} className=" fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({reviewCount})</span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">No reviews yet</span>
              )}
            </div>
            <p className="text-[clamp(1.1rem,3.5vw,1.5rem)] font-bold text-primary mt-auto pt-2">KES {price.toLocaleString()}</p>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
