import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Shield, ArrowLeft, Bell, BellOff, X, ChevronLeft, ChevronRight, Share2, Copy, BarChart2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VendorRating } from "@/components/VendorRating";
import { ProductReviews } from "@/components/ProductReviews";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { SEO } from "@/components/SEO";
import { trackProductView, trackCartAddition } from "@/lib/userInterests";
import { ShoeSizeChart } from "@/components/ShoeSizeChart";
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import ProductCard from "@/components/ProductCard";
import { PriceCompareModal } from "@/components/PriceCompareModal";
import {
  WhatsappShareButton,
  FacebookShareButton,
  TwitterShareButton,
  WhatsappIcon,
  FacebookIcon,
  XIcon,
} from 'react-share';
// Swiper
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Navigation, Thumbs } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';

// Condition labels for display - with footwear and accessory-specific descriptions
const conditionLabels: Record<string, { label: string; color: string; footwearDesc: string; accessoryDesc: string }> = {
  new:         { label: "New",          color: "bg-emerald-500", footwearDesc: "Brand new, never worn",        accessoryDesc: "Sealed, never used" },
  thrifted:    { label: "Thrifted",     color: "bg-purple-500",  footwearDesc: "Pre-owned, honestly described", accessoryDesc: "Pre-owned, good condition" },
  refurbished: { label: "Refurbished",  color: "bg-blue-500",   footwearDesc: "Tested & fully working",        accessoryDesc: "Tested & fully working" },
  // Legacy fallbacks for older listings
  like_new:    { label: "Refurbished",  color: "bg-blue-500",   footwearDesc: "Used once or twice, no wear",   accessoryDesc: "Tested & fully working" },
  good:        { label: "Thrifted",     color: "bg-purple-500", footwearDesc: "Pre-owned, honestly described", accessoryDesc: "Pre-owned, good condition" },
  fair:        { label: "Thrifted",     color: "bg-purple-500", footwearDesc: "Pre-owned, honestly described", accessoryDesc: "Pre-owned, good condition" },
};



// Helper to get condition description based on category
const getConditionDescription = (condition: string, category: string): string => {
  const isAccessory = category?.toLowerCase() === 'accessories';
  const conditionInfo = conditionLabels[condition] || conditionLabels.new;
  return isAccessory ? conditionInfo.accessoryDesc : conditionInfo.footwearDesc;
};

const Product = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [product, setProduct] = useState<any>(null);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState({ count: 0, average: 0 }); // Added review stats state
  const [loading, setLoading] = useState(true);
  const [priceAlertActive, setPriceAlertActive] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const [videoAspect, setVideoAspect] = useState<"portrait" | "landscape" | "square">("square");
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const { addItem, items } = useCart();

  // Scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    if (product) {
      fetchSimilarProducts();
    }
  }, [product?.id]); // Refetch similar when main product id changes

  const fetchProduct = async () => {
    try {
      // Fetch product
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("status", "active")
        .single();

      if (productError) throw productError;

      if (!productData) {
        toast.error("Product not found");
        return;
      }

      setProduct(productData);

      // Track for personalization
      trackProductView(productData.category, productData.brand);

      // Fetch vendor profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", productData.vendor_id)
        .single();

      setVendorProfile(profileData);

      // Fetch reviews stats
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("rating")
        .eq("product_id", id);

      if (reviewsData) {
        const count = reviewsData.length;
        const average = count > 0
          ? reviewsData.reduce((acc, curr) => acc + curr.rating, 0) / count
          : 0;
        setReviewStats({ count, average });
      }

      // Increment product views
      await supabase
        .from("product_views")
        .insert({ product_id: id });

    } catch (error) {
      console.error("Error fetching product:", error);
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const fetchSimilarProducts = async () => {
    if (!product) return;
    try {
      setSimilarLoading(true);

      let similarData: any[] = [];

      // 1. Try finding same brand first
      if (product.brand) {
        const { data: brandData, error: brandError } = await supabase
          .from("products")
          .select("*")
          .eq("status", "active")
          .neq("id", product.id)
          .eq("brand", product.brand)
          .limit(10);

        if (!brandError && brandData) {
          similarData = brandData;
        }
      }

      // 2. If we found fewer than 4 items, try backfilling with the same category
      if (similarData.length < 4 && product.category) {
        let query = supabase
          .from("products")
          .select("*")
          .eq("status", "active")
          .neq("id", product.id)
          .eq("category", product.category)
          .limit(10 - similarData.length);

        // If we already have some items, exclude them so we don't get duplicates
        if (similarData.length > 0) {
          const existingIds = similarData.map(p => p.id);
          query = query.not("id", "in", `(${existingIds.join(',')})`);
        }

        const { data: categoryData, error: categoryError } = await query;

        if (!categoryError && categoryData) {
          similarData = [...similarData, ...categoryData];
        }
      }

      // 3. If still nothing found, exit
      if (similarData.length === 0) {
        setSimilarProducts([]);
        return;
      }

      // Fetch reviews for the similar products to show stars
      const productIds = similarData.map(p => p.id);
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("product_id, rating")
        .in("product_id", productIds);

      const stats: Record<string, { sum: number; count: number }> = {};
      (reviewsData || []).forEach(r => {
        if (!stats[r.product_id]) stats[r.product_id] = { sum: 0, count: 0 };
        stats[r.product_id].sum += r.rating;
        stats[r.product_id].count += 1;
      });

      const processed = similarData.map(p => {
        const pStats = stats[p.id];
        return {
          ...p,
          averageRating: pStats ? pStats.sum / pStats.count : null,
          reviewCount: pStats ? pStats.count : 0,
        };
      });

      setSimilarProducts(processed);
    } catch (err) {
      console.error("Error fetching similar products:", err);
    } finally {
      setSimilarLoading(false);
    }
  };

  // Check if user has active price alert
  useEffect(() => {
    const checkPriceAlert = async () => {
      if (!user || !id) return;
      try {
        const { data } = await supabase
          .from("price_alerts")
          .select("id")
          .eq("user_id", user.id)
          .eq("product_id", id)
          .eq("is_active", true)
          .maybeSingle();

        setPriceAlertActive(!!data);
      } catch (error) {
        console.error("Error checking price alert:", error);
      }
    };
    checkPriceAlert();
  }, [user, id]);


  // Only require size if it's NOT an accessory/electronics and sizes exist
  const isNonSizedCategory = ['accessories', 'electronics', 'phones'].includes(product?.category);
  const requireSizeSelection = !isNonSizedCategory && product?.sizes && product.sizes.length > 0 && product.sizes[0] !== "";

  // Only require color if colors exist
  const requireColorSelection = product?.colors && product.colors.length > 0 && product.colors[0] !== "";

  const ensureColorSelected = () => {
    if (requireColorSelection && !selectedColor) {
      toast.error("Please select a color");
      return false;
    }
    return true;
  };

  const ensureSizeSelected = () => {
    if (requireSizeSelection && !selectedSize) {
      toast.error("Please select a size first");
      return false;
    }
    return true;
  };

  const addProductToCart = (showToast = true) => {
    if (!user) {
      toast.error("Please login to add items to your cart");
      navigate("/auth");
      return false;
    }
    if (!product) return false;
    if (product.stock === 0) {
      toast.error("This product is currently out of stock");
      return false;
    }
    if (!ensureSizeSelected()) return false;
    if (!ensureColorSelected()) return false;

    addItem(
      {
        productId: product.id,
        vendorId: product.vendor_id,
        name: product.name,
        priceKsh: product.price_ksh,
        imageUrl: product.images?.[0] || null,
        size: selectedSize,
        availableSizes: product.sizes || [],
        color: selectedColor,
        availableColors: product.colors || [],
      },
      1
    );
    // Track for personalization
    trackCartAddition(product.category, product.brand);
    if (showToast) {
      toast.success("Added to cart");
    }
    return true;
  };

  const handleAddToCart = () => {
    addProductToCart(true);
  };

  const handleBuyNow = () => {
    if (!product) return;

    // Check if item is already in cart
    const existingItem = items.find(item => item.productId === product.id);

    if (existingItem) {
      navigate("/checkout");
    } else {
      const added = addProductToCart(false);
      if (added) {
        navigate("/checkout");
      }
    }
  };

  if (loading) {
    return <SneakerLoader message="Loading product..." />;
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Product not found</p>
        <Button asChild>
          <Link to="/shop">Back to Shop</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-8 pb-36 md:pb-8 overflow-x-hidden">
      {product && (
        <SEO
          title={product.name}
          description={product.description || `Buy ${product.name} online in Kenya for KES ${product.price_ksh.toLocaleString()}. ${product.brand ? `Brand: ${product.brand}.` : ''} Escrow-protected payment. Verified seller.`}
          image={product.images?.[0]}
          type="product"
          price={product.price_ksh}
          canonical={`https://solelymarketplace.com/product/${product.id}`}
          product={{
            name: product.name,
            price: product.price_ksh,
            currency: "KES",
            condition: product.condition || "new",
            availability: product.stock > 0 ? "InStock" : "OutOfStock",
            images: product.images || [],
            brand: product.brand,
            sku: product.id,
            description: product.description,
            reviewCount: reviewStats.count,
            ratingValue: reviewStats.average
          }}
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Shop", url: "/shop" },
            { name: product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : "Shoes", url: product.category ? `/shop?category=${product.category}` : "/shop" },
            { name: product.name, url: `/product/${product.id}` }
          ]}
        />
      )}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Minimalist Header/Breadcrumb */}
        <div className="mb-4 sm:mb-6">
          <Link to="/shop" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm">
            <ArrowLeft size={16} strokeWidth={1.5}  />
            Back to Shop
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
          <div className="space-y-4">
            {/* Mobile Gallery - with PhotoView for zoom and swipe */}
            <div className="md:hidden">
              <PhotoProvider>
                {/* Main Image Card - Clickable to open lightbox */}
                <div className="aspect-square overflow-hidden rounded-4xl shadow-sm bg-muted relative">
                  {selectedImage === -1 && product.video_url ? (
                    <video
                      src={product.video_url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      autoPlay
                      controls
                    />
                  ) : (
                    <PhotoView src={product.images?.[selectedImage === -1 ? 0 : selectedImage] || "/placeholder.svg"}>
                      <img
                        src={product.images?.[selectedImage === -1 ? 0 : selectedImage] || "/placeholder.svg"}
                        alt={product.name}
                        className="w-full h-full object-cover cursor-pointer"
                      />
                    </PhotoView>
                  )}
                </div>

                {/* Hidden PhotoViews for all other images to enable swiping */}
                {product.images?.slice(1).map((image: string, index: number) => (
                  <PhotoView key={index} src={image}>
                    <span style={{ display: 'none' }} />
                  </PhotoView>
                ))}
              </PhotoProvider>

              {/* Swiper Thumbnail Carousel */}
              <div className="mt-4">
                <Swiper
                  spaceBetween={12}
                  slidesPerView="auto"
                  freeMode={true}
                  watchSlidesProgress={true}
                  modules={[FreeMode, Navigation, Thumbs]}
                  className="w-full !px-1"
                >
                  {/* Video thumbnail */}
                  {product.video_url && (
                    <SwiperSlide className="!w-20 !h-20">
                      <button
                        onClick={() => setSelectedImage(-1)}
                        className={`w-full h-full overflow-hidden rounded-2xl shadow-sm transition-all ${selectedImage === -1 ? "ring-2 ring-primary ring-offset-2" : ""
                          }`}
                      >
                        <div className="relative w-full h-full">
                          <img
                            src={product.images?.[0] || "/placeholder.svg"}
                            alt="Video preview"
                            className="w-full h-full object-cover opacity-80"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="bg-purple-500 rounded-full p-1">
                              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </button>
                    </SwiperSlide>
                  )}
                  {/* Image thumbnails */}
                  {product.images?.map((image: string, index: number) => (
                    <SwiperSlide key={index} className="!w-20 !h-20">
                      <button
                        onClick={() => setSelectedImage(index)}
                        className={`w-full h-full overflow-hidden rounded-2xl shadow-sm transition-all ${selectedImage === index ? "ring-2 ring-primary ring-offset-2" : ""
                          }`}
                      >
                        <img
                          src={image}
                          alt={`Product view ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            </div>

            {/* Desktop: Original clickable gallery */}
            <div className="hidden md:block">
              <div className={`overflow-hidden rounded-xl border-2 border-border bg-muted relative ${selectedImage === -1 && product.video_url
                ? videoAspect === "portrait"
                  ? "aspect-[9/16] max-h-[600px] mx-auto"
                  : videoAspect === "landscape"
                    ? "aspect-video"
                    : "aspect-square"
                : "aspect-square"
                }`}>
                {/* Show video if selected (index -1) and video exists */}
                {selectedImage === -1 && product.video_url ? (
                  <video
                    src={product.video_url}
                    className="w-full h-full object-contain bg-black"
                    muted
                    loop
                    playsInline
                    autoPlay
                    controls={false}
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      const ratio = video.videoWidth / video.videoHeight;
                      if (ratio < 0.8) setVideoAspect("portrait");
                      else if (ratio > 1.2) setVideoAspect("landscape");
                      else setVideoAspect("square");
                    }}
                  />
                ) : (
                  <img
                    src={product.images?.[selectedImage === -1 ? 0 : selectedImage] || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    fetchPriority="high"
                  />
                )}
              </div>
              {/* Thumbnails including video */}
              <div className="grid grid-cols-5 gap-2 mt-4">
                {/* Video thumbnail */}
                {product.video_url && (
                  <button
                    onClick={() => setSelectedImage(-1)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition-all relative ${selectedImage === -1 ? "border-primary shadow-hover" : "border-border hover:border-primary/50"
                      }`}
                  >
                    <img
                      src={product.images?.[0] || "/placeholder.svg"}
                      alt="Video preview"
                      className="w-full h-full object-cover opacity-80"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="bg-purple-500 rounded-full p-1.5">
                        <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </button>
                )}
                {/* Image thumbnails */}
                {product.images?.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(index)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition-all ${selectedImage === index ? "border-primary shadow-hover" : "border-border hover:border-primary/50"
                      }`}
                  >
                    <img
                      src={image}
                      alt={`Product view ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              {product.brand && <Badge className="mb-2">{product.brand}</Badge>}
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">{product.name}</h1>
                {/* Share Button */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-full"
                    onClick={() => setShowShareMenu(!showShareMenu)}
                  >
                    <Share2 size={16} strokeWidth={1.5}  />
                  </Button>

                  {/* Share Menu Popup */}
                  {showShareMenu && (
                    <div className="absolute right-0 top-12 z-50 bg-card border border-border rounded-xl shadow-lg p-4 min-w-[240px] animate-in fade-in zoom-in-95 duration-200">
                      <p className="text-sm font-medium mb-4 text-center">Share this product</p>

                      <div className="flex items-center justify-center gap-4 mb-4">
                        <WhatsappShareButton
                          url={window.location.href}
                          title={`Check out ${product.name} on Sole-ly! KES ${product.price_ksh.toLocaleString()}`}
                          className="hover:scale-110 transition-transform"
                        >
                          <WhatsappIcon size={40} round />
                        </WhatsappShareButton>
                        <FacebookShareButton
                          url={window.location.href}
                          hashtag="#Solely"
                          className="hover:scale-110 transition-transform"
                        >
                          <FacebookIcon size={40} round />
                        </FacebookShareButton>
                        <TwitterShareButton
                          url={window.location.href}
                          title={`Check out ${product.name} on Sole-ly!`}
                          hashtags={["Solely", "SolelyKenya"]}
                          className="hover:scale-110 transition-transform"
                        >
                          <XIcon size={40} round />
                        </TwitterShareButton>

                      </div>

                      <div className="space-y-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-2"
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            toast.success("Link copied to clipboard!");
                            setShowShareMenu(false);
                          }}
                        >
                          <Copy size={16} strokeWidth={1.5} className=" mr-2" />
                          Copy Link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-auto py-2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowShareMenu(false)}
                        >
                          <X size={16} strokeWidth={1.5} className=" mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-4 sm:mb-6">KES {product.price_ksh.toLocaleString()}</p>
              <div className="flex flex-wrap gap-2">
                {product.stock > 0 ? (
                  <Badge variant="default">In Stock ({product.stock} available)</Badge>
                ) : (
                  <Badge variant="secondary">Out of Stock</Badge>
                )}
                {product.free_delivery && (
                  <Badge className="bg-gradient-to-r from-emerald-400 to-green-600 hover:from-emerald-500 hover:to-green-700 text-white border-none shadow-md shadow-green-500/30 px-3 py-1 uppercase tracking-wider font-bold">
                    🚚 Free Delivery
                  </Badge>
                )}
              </div>
            </div>

            {/* Condition Display */}
            {product.condition && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <span className={`w-3 h-3 rounded-full ${conditionLabels[product.condition]?.color || conditionLabels.new.color}`}></span>
                <div>
                  <span className="font-medium">
                    {conditionLabels[product.condition]?.label || "New"}
                  </span>
                  <span className="text-muted-foreground text-sm ml-2">
                    - {getConditionDescription(product.condition, product.category)}
                  </span>
                </div>
              </div>
            )}
            {product.condition_notes && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                Seller note: {product.condition_notes}
              </p>
            )}

            {product.description && (
              <div className="border-t border-border pt-6">
                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* Size Selection */}
            {requireSizeSelection && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">
                    {product.category === "electronics" || product.category === "phones"
                      ? "Select Storage / Variant"
                      : product.category === "beauty"
                      ? "Select Volume"
                      : product.category === "shoes"
                      ? "Select Size (EU)"
                      : "Select Size"}
                  </label>
                  {product.category === "shoes" && <ShoeSizeChart selectedSize={selectedSize} availableSizes={product.sizes} />}
                </div>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Choose your ${product.category === "electronics" || product.category === "phones" ? "variant" : "size"}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {product.sizes.map((size: string) => (
                      <SelectItem key={size} value={size}>
                        {product.category === "shoes" ? `EU ${size}` : size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedSize && (
                  <p className="text-xs text-muted-foreground">Please make a selection to continue</p>
                )}
              </div>
            )}

            {/* Color Selection */}
            {requireColorSelection && (
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">Select Color</label>
                </div>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a color" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.colors.map((color: string) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedColor && (
                  <p className="text-xs text-muted-foreground">Please select a color to continue</p>
                )}
              </div>
            )}

            {/* Features */}
            {product.key_features && product.key_features.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Key Features:</h3>
                <ul className="space-y-2">
                  {product.key_features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-1">•</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="space-y-3 pt-6">
              <Button
                size="lg"
                className="w-full min-h-[48px]"
                onClick={handleAddToCart}
                disabled={product.stock === 0}
              >
                Add to Cart
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full min-h-[48px]"
                onClick={handleBuyNow}
                disabled={product.stock === 0}
              >
                Buy Now
              </Button>

              {/* Compare Prices Button */}
              <Button
                size="lg"
                variant="outline"
                className="w-full min-h-[48px] border-primary/40 text-primary hover:bg-primary/5"
                onClick={() => setShowCompareModal(true)}
              >
                <BarChart2 size={16} strokeWidth={1.5} className=" mr-2" />
                Compare Prices
              </Button>

              {/* Price Alert Button */}
              <Button
                size="lg"
                variant="ghost"
                className={`w-full min-h-[48px] ${priceAlertActive ? 'text-primary' : 'text-muted-foreground'}`}
                onClick={async () => {
                  if (!user) {
                    toast.info("Please sign in to set price alerts");
                    navigate("/auth?redirect=/product/" + id);
                    return;
                  }
                  setAlertLoading(true);
                  try {
                    if (priceAlertActive) {
                      // Remove alert
                      await supabase
                        .from("price_alerts")
                        .delete()
                        .eq("user_id", user.id)
                        .eq("product_id", id);
                      setPriceAlertActive(false);
                      toast.success("Price alert removed");
                    } else {
                      // Add alert
                      await supabase
                        .from("price_alerts")
                        .upsert({
                          user_id: user.id,
                          product_id: id,
                          original_price: product.price_ksh,
                          is_active: true,
                        });
                      setPriceAlertActive(true);
                      toast.success("You'll be notified when the price drops!");
                    }
                  } catch (error: any) {
                    toast.error("Failed to set price alert");
                  } finally {
                    setAlertLoading(false);
                  }
                }}
                disabled={alertLoading}
              >
                {priceAlertActive ? (
                  <><BellOff size={16} strokeWidth={1.5} className=" mr-2" /> Remove Price Alert</>
                ) : (
                  <><Bell size={16} strokeWidth={1.5} className=" mr-2" /> Notify me on price drop</>
                )}
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border">
              <div className="flex items-center gap-3">
                <Shield strokeWidth={1.5} className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Escrow Protected</p>
                  <p className="text-xs text-muted-foreground">Payment held until delivery</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield strokeWidth={1.5} className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold text-sm">Verified Seller</p>
                  <p className="text-xs text-muted-foreground">
                    {vendorProfile?.store_name || "Trusted seller"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Products Section */}
      {similarProducts.length > 0 && (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 border-t border-border mt-8">
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold">Similar Products</h2>
            <Link to={product?.brand ? `/shop?search=${encodeURIComponent(product.brand)}` : `/shop?category=${product?.category || ''}`} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All <ChevronRight size={16} strokeWidth={1.5}  />
            </Link>
          </div>
          <div className="relative group">
            {similarLoading ? (
              <div className="flex justify-center p-8">
                <SneakerLoader message="Loading..." size="sm" fullScreen={false} />
              </div>
            ) : (
              <Swiper
                modules={[Navigation, FreeMode]}
                spaceBetween={12}
                slidesPerView={2}
                navigation
                freeMode={true}
                breakpoints={{
                  640: { slidesPerView: 2, spaceBetween: 16 },
                  768: { slidesPerView: 3, spaceBetween: 20 },
                  1024: { slidesPerView: 4, spaceBetween: 24 },
                }}
                className="pb-6 !px-1 select-none"
              >
                {similarProducts.map((simProd) => (
                  <SwiperSlide key={simProd.id} className="h-auto py-1">
                    <ProductCard
                      id={simProd.id}
                      name={simProd.name}
                      price={simProd.price_ksh}
                      image={simProd.images?.[0] || "/placeholder.svg"}
                      brand={simProd.brand}
                      averageRating={simProd.averageRating}
                      reviewCount={simProd.reviewCount}
                      createdAt={simProd.created_at}
                      condition={simProd.condition}
                      videoUrl={simProd.video_url}
                      freeDelivery={simProd.free_delivery}
                      category={simProd.category}
                    />
                  </SwiperSlide>
                ))}
              </Swiper>
            )}
          </div>
        </div>
      )}

      {/* Product Reviews Section */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <ProductReviews productId={product.id} />
      </div>

      {/* Vendor Rating Section */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-28 md:pb-12">
        <VendorRating vendorId={product.vendor_id} productId={product.id} />
      </div>


      {/* Price Compare Modal */}
      {product && (
        <PriceCompareModal
          open={showCompareModal}
          onClose={() => setShowCompareModal(false)}
          currentProduct={{
            id: product.id,
            name: product.name,
            price_ksh: product.price_ksh,
            brand: product.brand,
            category: product.category,
            images: product.images ?? [],
          }}
        />
      )}
    </div>
  );
};

export default Product;
