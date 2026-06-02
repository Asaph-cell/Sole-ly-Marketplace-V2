import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Filter, Shield, X } from "lucide-react";
import { ALL_CATEGORIES, getCategoryByKey, getCategoryName } from "@/lib/categories";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { SEO } from "@/components/SEO";

import { saveSearch } from "@/lib/searchHistory";
import { rankByInterests, trackCategoryClick } from "@/lib/userInterests";

// ─── Max price per category ────────────────────────────────────────────────────
const MAX_PRICE_BY_CATEGORY: Record<string, number> = {
  electronics: 500_000,
  home: 200_000,
  sports: 100_000,
  default: 50_000,
};

const getMaxPrice = (cat: string) =>
  MAX_PRICE_BY_CATEGORY[cat] ?? MAX_PRICE_BY_CATEGORY.default;

// ─── Condition badge colours ───────────────────────────────────────────────────
const CONDITION_DOT: Record<string, string> = {
  new:         "bg-emerald-500",
  thrifted:    "bg-purple-500",
  refurbished: "bg-blue-500",
  like_new:    "bg-blue-400", // kept for legacy compat
  good:        "bg-amber-400", // kept for legacy compat
  fair:        "bg-orange-500", // kept for legacy compat
};

const Shop = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery]         = useState("");
  const [products, setProducts]               = useState<any[]>([]);
  const [filteredProducts, setFiltered]       = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [priceRange, setPriceRange]           = useState([0, MAX_PRICE_BY_CATEGORY.default]);
  const [selectedBrand, setSelectedBrand]     = useState("all");
  const [selectedCategory, setSelectedCat]   = useState("all");
  const [selectedSub, setSelectedSub]         = useState("all");
  const [selectedCondition, setSelectedCond] = useState("all");
  const [sortBy, setSortBy]                   = useState("smart");
  const [page, setPage]                       = useState(1);
  const itemsPerPage = 20;

  // Derived data
  const uniqueBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));
  const activeCategoryObj = selectedCategory !== "all" ? getCategoryByKey(selectedCategory) : null;

  // ─── Fetch products ONCE on mount ──────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProducts();
  }, []);

  // ─── Sync filter state from URL params ────────────────────────────────────
  // This runs on every URL change (category nav, sub pills, search).
  // It does NOT re-fetch products — the product list is stable after mount.
  // It does NOT scroll to top — that only happens on mount above.
  useEffect(() => {
    const search   = searchParams.get("search");
    const category = searchParams.get("category") ?? "all";
    const sub      = searchParams.get("sub")      ?? "all";

    if (search) { setSearchQuery(search); saveSearch(search); }
    setSelectedCat(category);
    setSelectedSub(sub);

    // Clamp price ceiling to the new category's max
    const maxP = getMaxPrice(category);
    setPriceRange((prev) => [prev[0], Math.min(prev[1], maxP)]);
    setPage(1);
  }, [searchParams]);

  // ─── Apply filters ─────────────────────────────────────────────────────────
  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, priceRange, selectedBrand, selectedCategory, selectedSub, selectedCondition, sortBy]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active");
      if (error) throw error;

      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("product_id, rating");

      const reviewStats: Record<string, { sum: number; count: number }> = {};
      (reviewsData || []).forEach((r) => {
        if (!reviewStats[r.product_id]) reviewStats[r.product_id] = { sum: 0, count: 0 };
        reviewStats[r.product_id].sum += r.rating;
        reviewStats[r.product_id].count += 1;
      });

      setProducts(
        (productsData || []).map((p) => {
          const s = reviewStats[p.id];
          return { ...p, averageRating: s ? s.sum / s.count : null, reviewCount: s?.count ?? 0 };
        })
      );
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError(err.message || "Failed to load products. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let f = [...products];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    // Price
    f = f.filter((p) => p.price_ksh >= priceRange[0] && p.price_ksh <= priceRange[1]);

    // Brand
    if (selectedBrand !== "all") f = f.filter((p) => p.brand?.toLowerCase() === selectedBrand);

    // Category
    if (selectedCategory !== "all")
      f = f.filter((p) => p.category?.toLowerCase() === selectedCategory.toLowerCase());

    // Subcategory
    if (selectedSub !== "all")
      f = f.filter((p) => p.subcategory?.toLowerCase() === selectedSub.toLowerCase());

    // Condition
    if (selectedCondition !== "all") f = f.filter((p) => p.condition === selectedCondition);

    if (searchQuery.trim()) saveSearch(searchQuery.trim());

    // Sort
    switch (sortBy) {
      case "price-low":  f.sort((a, b) => a.price_ksh - b.price_ksh); break;
      case "price-high": f.sort((a, b) => b.price_ksh - a.price_ksh); break;
      case "newest":     f.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "trusted":    f.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0)); break;
      default:           f = rankByInterests(f);
    }

    setFiltered(f);
    setPage(1);
  };

  const handleCategoryClick = (key: string) => {
    trackCategoryClick(key);
    // Update URL — this triggers the [searchParams] effect which sets state.
    // Sub is explicitly removed from URL so the effect will reset it to "all".
    const p = new URLSearchParams(searchParams);
    if (key === "all") { p.delete("category"); p.delete("sub"); }
    else { p.set("category", key); p.delete("sub"); }
    setSearchParams(p, { replace: true });
  };

  const handleSubClick = (key: string) => {
    // Just update the URL — the [searchParams] effect will sync selectedSub.
    const p = new URLSearchParams(searchParams);
    if (key === "all") p.delete("sub");
    else p.set("sub", key);
    setSearchParams(p, { replace: true });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setPriceRange([0, MAX_PRICE_BY_CATEGORY.default]);
    setSelectedBrand("all");
    setSelectedCat("all");
    setSelectedSub("all");
    setSelectedCond("all");
    setSortBy("smart");
    setPage(1);
    setSearchParams({}, { replace: true });
  };

  // ─── Dynamic heading / SEO ─────────────────────────────────────────────────
  const headingCat  = activeCategoryObj?.name ?? "All Items";
  const headingSub  = selectedSub !== "all" ? getCategoryName(selectedSub) : null;
  const heading     = headingSub ?? headingCat;
  const subHeading  = `${filteredProducts.length} item${filteredProducts.length !== 1 ? "s" : ""} from trusted vendors across Kenya`;

  const seoTitle       = `${heading} for Sale in Kenya | Solely`;
  const seoDescription = `Browse ${filteredProducts.length} ${heading.toLowerCase()} listings with full escrow protection. Verified vendors. Pay only when you're happy.`;
  const seoCanonical   = selectedCategory !== "all"
    ? `https://solelymarketplace.com/shop?category=${selectedCategory}${selectedSub !== "all" ? `&sub=${selectedSub}` : ""}`
    : "https://solelymarketplace.com/shop";

  const activeFilterCount = [
    selectedCategory !== "all",
    selectedSub !== "all",
    selectedBrand !== "all",
    selectedCondition !== "all",
    priceRange[0] > 0 || priceRange[1] < getMaxPrice(selectedCategory),
  ].filter(Boolean).length;

  if (loading) return <SneakerLoader message="Loading products..." />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <X className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Oops! Something went wrong</h2>
        <p className="text-muted-foreground mb-6 max-w-md">{error}</p>
        <Button onClick={fetchProducts} size="lg">
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Shared filter content (used in sidebar + mobile sheet) ───────────────
  const FilterContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={mobile ? "space-y-6 pb-6" : "space-y-6"}>
      {/* Brand */}
      <div>
        <label className="text-sm font-semibold mb-2 block">Brand</label>
        <Select value={selectedBrand} onValueChange={setSelectedBrand}>
          <SelectTrigger className={mobile ? "h-12" : ""}>
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {uniqueBrands.map((b) => (
              <SelectItem key={b} value={b.toLowerCase()}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div>
        <label className="text-sm font-semibold mb-2 block">Category</label>
        <Select value={selectedCategory} onValueChange={handleCategoryClick}>
          <SelectTrigger className={mobile ? "h-12" : ""}>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ALL_CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subcategory — only shown when a category is active */}
      {activeCategoryObj && activeCategoryObj.subcategories.length > 0 && (
        <div>
          <label className="text-sm font-semibold mb-2 block">Subcategory</label>
          <Select value={selectedSub} onValueChange={handleSubClick}>
            <SelectTrigger className={mobile ? "h-12" : ""}>
              <SelectValue placeholder={`All ${activeCategoryObj.name}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {activeCategoryObj.name}</SelectItem>
              {activeCategoryObj.subcategories.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Condition */}
      <div>
        <label className="text-sm font-semibold mb-2 block">Condition</label>
        <Select value={selectedCondition} onValueChange={setSelectedCond}>
          <SelectTrigger className={mobile ? "h-12" : ""}>
            <SelectValue placeholder="All Conditions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Conditions</SelectItem>
            <SelectItem value="new">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${CONDITION_DOT["new"]}`} />
                New
              </div>
            </SelectItem>
            {selectedCategory === "electronics" ? (
              <SelectItem value="refurbished">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${CONDITION_DOT["refurbished"]}`} />
                  Refurbished
                </div>
              </SelectItem>
            ) : selectedCategory !== "all" ? (
              <SelectItem value="thrifted">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${CONDITION_DOT["thrifted"]}`} />
                  Thrifted
                </div>
              </SelectItem>
            ) : (
              // If "All Categories" is selected, show both
              <>
                <SelectItem value="thrifted">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${CONDITION_DOT["thrifted"]}`} />
                    Thrifted
                  </div>
                </SelectItem>
                <SelectItem value="refurbished">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${CONDITION_DOT["refurbished"]}`} />
                    Refurbished
                  </div>
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Price Range */}
      <div>
        <label className="text-sm font-semibold mb-2 block">
          Price: KES {priceRange[0].toLocaleString()} – KES {priceRange[1].toLocaleString()}
        </label>
        <Slider
          min={0}
          max={getMaxPrice(selectedCategory)}
          step={selectedCategory === "electronics" ? 5_000 : 500}
          value={priceRange}
          onValueChange={setPriceRange}
          className="mt-3"
        />
      </div>

      <Button className={`w-full ${mobile ? "h-12" : ""}`} variant="outline" onClick={resetFilters}>
        {activeFilterCount > 0 ? `Clear ${activeFilterCount} Filter${activeFilterCount > 1 ? "s" : ""}` : "Reset Filters"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen py-4 sm:py-8 overflow-x-hidden">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={seoCanonical}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Shop", url: "/shop" },
          ...(activeCategoryObj ? [{ name: activeCategoryObj.name, url: `/shop?category=${selectedCategory}` }] : []),
          ...(selectedSub !== "all" ? [{ name: getCategoryName(selectedSub), url: `/shop?category=${selectedCategory}&sub=${selectedSub}` }] : []),
        ]}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Page Header (compact on mobile) ── */}
        <div className="mb-4 pt-3 sm:pt-2 sm:mb-6">
          <h1 className="text-xl sm:text-3xl font-bold mb-0.5">
            {headingSub ? (
              <>
                <button onClick={() => handleCategoryClick(selectedCategory)} className="text-primary hover:underline">{headingCat}</button>
                <span className="text-muted-foreground font-normal mx-2">›</span>
                {headingSub}
              </>
            ) : heading === "All Items" ? "Shop All Items" : `Shop ${heading}`}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
            <Shield strokeWidth={1.5} className="h-3 w-3 text-primary shrink-0" />
            {filteredProducts.length} items — every order escrow-protected
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">

          {/* ── Sidebar (desktop only) ── */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm sticky top-24">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Filter size={16} strokeWidth={1.5} className=" text-primary" />
                  <h2 className="text-base font-bold">Filters</h2>
                </div>
                {activeFilterCount > 0 && (
                  <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <FilterContent />
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="lg:col-span-3 min-w-0 pb-24 lg:pb-0">

            {/* ── Category pills — single scrollable row, never wraps ── */}
            <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-1 mb-3">
              <button
                onClick={() => handleCategoryClick("all")}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 whitespace-nowrap
                  ${selectedCategory === "all"
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/40"
                  }`}
              >
                All Items
              </button>
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryClick(cat.key)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 whitespace-nowrap
                    ${selectedCategory === cat.key
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border hover:border-foreground/40"
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* ── Subcategory pills — same pattern ── */}
            {activeCategoryObj && (
              <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4">
                <button
                  onClick={() => handleSubClick("all")}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                    ${selectedSub === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                    }`}
                >
                  All {activeCategoryObj.name}
                </button>
                {activeCategoryObj.subcategories.map((sub) => (
                  <button
                    key={sub.key}
                    onClick={() => handleSubClick(sub.key)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all whitespace-nowrap
                      ${selectedSub === sub.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                      }`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )}

            {/* ── Sort + result count row ── */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-xs sm:text-sm text-foreground/70 font-medium shrink-0">
                <span className="font-bold text-foreground">{Math.min(page * itemsPerPage, filteredProducts.length)}</span>
                {" "}/  {" "}
                <span className="font-bold text-foreground">{filteredProducts.length}</span> results
              </p>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] sm:w-[200px] h-9 text-xs sm:text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">✨ For You</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="trusted">Most Trusted</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Product grid ── */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-foreground mb-1">No products found</p>
                <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or search term</p>
                <Button variant="outline" onClick={resetFilters}>Clear Filters</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {filteredProducts.slice(0, page * itemsPerPage).map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    price={product.price_ksh}
                    image={product.images?.[0] || "/placeholder.svg"}
                    brand={product.brand}
                    averageRating={product.averageRating}
                    reviewCount={product.reviewCount}
                    createdAt={product.created_at}
                    condition={product.condition || "new"}
                    videoUrl={product.video_url}
                    freeDelivery={product.free_delivery}
                    category={product.category}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
            {filteredProducts.length > page * itemsPerPage && (
              <div className="flex justify-center mt-8">
                <Button onClick={() => setPage((p) => p + 1)} variant="outline" size="lg">
                  Load More ({filteredProducts.length - page * itemsPerPage} remaining)
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile filter button + sheet ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border px-4 py-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button className="w-full h-11 rounded-xl font-semibold" size="lg">
              <Filter size={16} strokeWidth={1.5} className=" mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-2 bg-white text-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle className="flex items-center gap-2">
                <Filter size={20} strokeWidth={1.5} className=" text-primary" />
                Filters
              </SheetTitle>
            </SheetHeader>
            <FilterContent mobile />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default Shop;
