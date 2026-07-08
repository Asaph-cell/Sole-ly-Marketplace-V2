// ─── Solely v2 Category System ─────────────────────────────────────────────
// 9 verticals, each with subcategories.
// The `key` is stored in the DB products.category column.

export interface Category {
  name: string;
  key: string;
  icon: string;      // emoji icon for tiles
  subcategories: { name: string; key: string }[];
  kycRequired?: boolean; // true = enhanced KYC needed to list
  coverGradient: string; // Tailwind gradient classes for category tile
}

export const ALL_CATEGORIES: Category[] = [
  {
    name: "Shoes",
    key: "shoes",
    icon: "👟",
    coverGradient: "from-amber-500 to-yellow-400",
    subcategories: [
      { name: "Men's Shoes", key: "mens-shoes" },
      { name: "Women's Shoes", key: "womens-shoes" },
      { name: "Kids' Shoes", key: "kids-shoes" },
      { name: "Sports & Sneakers", key: "sneakers" },
      { name: "Formal", key: "formal-shoes" },
      { name: "Casual", key: "casual-shoes" },
      { name: "Boots", key: "boots" },
      { name: "Open / Sandals", key: "sandals" },
    ],
  },
  {
    name: "Women's Fashion",
    key: "womens-fashion",
    icon: "👗",
    coverGradient: "from-rose-400 to-pink-500",
    subcategories: [
      { name: "Dresses", key: "dresses" },
      { name: "Tops & Blouses", key: "tops" },
      { name: "Trousers & Jeans", key: "womens-trousers" },
      { name: "Skirts", key: "skirts" },
      { name: "Suits & Blazers", key: "womens-suits" },
      { name: "Swimwear", key: "swimwear" },
      { name: "Lingerie", key: "lingerie" },
    ],
  },
  {
    name: "Men's Fashion",
    key: "mens-fashion",
    icon: "👕",
    coverGradient: "from-slate-600 to-slate-500",
    subcategories: [
      { name: "T-Shirts", key: "tshirts" },
      { name: "Shirts", key: "shirts" },
      { name: "Trousers & Jeans", key: "mens-trousers" },
      { name: "Suits & Blazers", key: "mens-suits" },
      { name: "Shorts", key: "shorts" },
      { name: "Hoodies & Sweaters", key: "hoodies" },
      { name: "Activewear", key: "mens-activewear" },
    ],
  },
  {
    name: "Kids & Baby",
    key: "kids",
    icon: "👶",
    coverGradient: "from-sky-400 to-blue-400",
    subcategories: [
      { name: "Baby Clothing", key: "baby-clothing" },
      { name: "Kids Clothing", key: "kids-clothing" },
      { name: "Kids Shoes", key: "kids-shoes" },
      { name: "Toys", key: "toys" },
      { name: "School Supplies", key: "school" },
    ],
  },
  {
    name: "Beauty & Skincare",
    key: "beauty",
    icon: "💄",
    coverGradient: "from-purple-400 to-fuchsia-500",
    subcategories: [
      { name: "Makeup", key: "makeup" },
      { name: "Skincare", key: "skincare" },
      { name: "Haircare", key: "haircare" },
      { name: "Fragrances", key: "fragrances" },
      { name: "Nail Care", key: "nail-care" },
    ],
  },
  {
    name: "Accessories",
    key: "bags",
    icon: "👜",
    coverGradient: "from-amber-700 to-yellow-600",
    subcategories: [
      { name: "Handbags", key: "handbags" },
      { name: "Backpacks", key: "backpacks" },
      { name: "Wallets", key: "wallets" },
      { name: "Belts", key: "belts" },
      { name: "Sunglasses", key: "sunglasses" },
      { name: "Jewellery", key: "jewellery" },
      { name: "Watches", key: "watches" },
    ],
  },
  {
    name: "Sports & Fitness",
    key: "sports",
    icon: "🏋️",
    coverGradient: "from-green-500 to-emerald-500",
    subcategories: [
      { name: "Sportswear", key: "sportswear" },
      { name: "Equipment", key: "sports-equipment" },
      { name: "Supplements", key: "supplements" },
      { name: "Cycling", key: "cycling" },
      { name: "Outdoor Gear", key: "outdoor" },
    ],
  },
  {
    name: "Electronics",
    key: "electronics",
    icon: "📱",
    coverGradient: "from-gray-700 to-gray-600",
    kycRequired: true,
    subcategories: [
      { name: "Phones", key: "phones" },
      { name: "Laptops & Tablets", key: "laptops" },
      { name: "Earbuds & Headphones", key: "audio" },
      { name: "Phone Accessories", key: "phone-accessories" },
      { name: "Gaming", key: "gaming" },
      { name: "Cameras", key: "cameras" },
      { name: "Smart Watches", key: "smartwatches" },
    ],
  },
  {
    name: "Home & Living",
    key: "home",
    icon: "🏠",
    coverGradient: "from-orange-400 to-amber-400",
    subcategories: [
      { name: "Kitchen & Dining", key: "kitchen" },
      { name: "Bedding", key: "bedding" },
      { name: "Décor", key: "decor" },
      { name: "Furniture", key: "furniture" },
      { name: "Cleaning", key: "cleaning" },
    ],
  },
  {
    name: "Health & Wellness",
    key: "health",
    icon: "⚕️",
    coverGradient: "from-teal-400 to-emerald-500",
    subcategories: [
      { name: "Vitamins & Supplements", key: "supplements" },
      { name: "Medical Supplies", key: "medical-supplies" },
      { name: "Wellness & Relaxation", key: "wellness" },
      { name: "Personal Care", key: "personal-care" },
      { name: "Diet & Nutrition", key: "diet" },
    ],
  },
];

// ─── Legacy-compat exports (used by existing Shop/Home code) ─────────────────

export const MAIN_CATEGORIES = ALL_CATEGORIES.slice(0, 6).map((c) => ({
  name: c.name,
  key: c.key,
}));

export const OTHER_CATEGORIES = ALL_CATEGORIES.slice(6).map((c) => ({
  name: c.name,
  key: c.key,
}));

export const CATEGORIES = ALL_CATEGORIES.map((c) => ({
  name: c.name,
  key: c.key,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const getCategoryByKey = (key: string): Category | undefined =>
  ALL_CATEGORIES.find((c) => c.key === key);

export const getCategoryName = (key: string): string => {
  const cat = ALL_CATEGORIES.find(
    (c) =>
      c.key === key ||
      c.subcategories.some((s) => s.key === key)
  );
  if (cat?.key === key) return cat.name;
  const sub = ALL_CATEGORIES.flatMap((c) => c.subcategories).find(
    (s) => s.key === key
  );
  return sub?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
};

export const isKnownCategory = (key: string): boolean =>
  ALL_CATEGORIES.some((c) => c.key === key);

export const isMainCategory = (key: string): boolean =>
  MAIN_CATEGORIES.some((c) => c.key === key);
