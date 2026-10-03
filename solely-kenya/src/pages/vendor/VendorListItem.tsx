import { useEffect, useState } from "react";
import { FormSkeleton } from "@/components/skeletons";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { compressImages } from "@/lib/compressImage";
import { ALL_CATEGORIES } from "@/lib/categories";
import { toast } from "@/lib/toast";
import { celebrate } from "@/components/Celebration";
import { PricingCalculator } from "@/components/vendor/PricingCalculator";
import {
  ChevronLeft, ChevronRight, Upload, X, ImagePlus, Loader2,
  Footprints, Shirt, Baby, Sparkles, ShoppingBag,
  Dumbbell, Smartphone, Home, CheckCircle2, CopyPlus, LucideIcon
} from "lucide-react";
import { aiListingFill, aiListingStatus, type AiListingFields } from "@/lib/aiListing";
import { VideoUploader } from "@/components/VideoUploader";
import { parseSizesInput } from "@/lib/sizes";
import { usePersistentState } from "@/hooks/usePersistentState";

// ── Category icon + gradient map ─────────────────────────────────────────────
const CAT_META: Record<string, { icon: LucideIcon; from: string; to: string; text: string }> = {
  shoes:           { icon: Footprints, from: "#F59E0B", to: "#EAB308", text: "#fff" },
  "womens-fashion":{ icon: Shirt,      from: "#FB7185", to: "#EC4899", text: "#fff" },
  "mens-fashion":  { icon: Shirt,      from: "#475569", to: "#64748B", text: "#fff" },
  kids:            { icon: Baby,       from: "#38BDF8", to: "#60A5FA", text: "#fff" },
  beauty:          { icon: Sparkles,   from: "#A78BFA", to: "#D946EF", text: "#fff" },
  bags:            { icon: ShoppingBag,from: "#B45309", to: "#CA8A04", text: "#fff" },
  sports:          { icon: Dumbbell,   from: "#10B981", to: "#059669", text: "#fff" },
  electronics:     { icon: Smartphone, from: "#374151", to: "#4B5563", text: "#fff" },
  home:            { icon: Home,       from: "#FB923C", to: "#FBBF24", text: "#fff" },
};

// ── Condition options, simple 2-choice per group ────────────────────────────
const CONDITIONS_GENERAL = [
  { value: "new",      label: "New",       dot: "bg-success" },
  { value: "thrifted", label: "Thrifted",  dot: "bg-foreground" },
];
const CONDITIONS_ELECTRONICS = [
  { value: "new",         label: "Brand New",   dot: "bg-success" },
  { value: "refurbished", label: "Refurbished",  dot: "bg-foreground" },
];

// All electronics sub-category keys
const ELEC_SUBS = new Set(["phones","laptops","audio","phone-accessories","gaming","cameras","smartwatches"]);
const isElectronics = (cat: string, sub: string) => cat === "electronics" || ELEC_SUBS.has(sub);

// ── Spec fields, one entry per category / subcategory ───────────────────────
type SpecField = { key: string; label: string; type: "text"|"select"; options?: string[]; placeholder?: string };

const SPEC_FIELDS: Record<string, SpecField[]> = {
  // Shoes
  shoes: [
    { key:"gender",   label:"Gender",               type:"select", options:["Men","Women","Kids","Unisex"] },
    { key:"sizes",    label:"Sizes (EU, comma-sep)", type:"text",   placeholder:"e.g. 39, 40, 41, 42, 43" },
    { key:"colors",   label:"Colors",               type:"text",   placeholder:"e.g. Black, White, Brown" },
    { key:"material", label:"Upper Material",        type:"select", options:["Leather","Suede","Mesh","Canvas","Synthetic","Other"] },
  ],
  "mens-shoes":   [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"40, 41, 42, 43, 44" }, { key:"colors", label:"Colors", type:"text", placeholder:"Black, Brown" }],
  "womens-shoes": [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"36, 37, 38, 39, 40" }, { key:"colors", label:"Colors", type:"text", placeholder:"Nude, Black, White" }],
  "kids-shoes":   [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"25, 26, 27, 28" }, { key:"gender", label:"Gender", type:"select", options:["Boys","Girls","Unisex"] }],
  sneakers:       [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"40, 41, 42, 43" }, { key:"colors", label:"Colors / Colorway", type:"text", placeholder:"e.g. Triple White, Bred" }],
  "formal-shoes": [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"40, 41, 42, 43" }, { key:"gender", label:"Gender", type:"select", options:["Men","Women"] }],
  boots:          [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"38, 39, 40, 41" }, { key:"shaft",  label:"Shaft Height", type:"select", options:["Ankle","Mid-Calf","Knee-High"] }],
  sandals:        [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"36, 37, 38, 39" }, { key:"gender", label:"Gender", type:"select", options:["Men","Women","Kids","Unisex"] }],
  "casual-shoes": [{ key:"sizes", label:"EU Sizes (comma-sep)", type:"text", placeholder:"38, 39, 40, 41, 42" }, { key:"colors", label:"Colors", type:"text", placeholder:"e.g. White, Navy" }],

  // Women's Fashion
  "womens-fashion": [
    { key:"size",     label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L, XL" },
    { key:"colors",   label:"Colors",   type:"text",   placeholder:"e.g. Black, Navy, Floral" },
    { key:"material", label:"Material", type:"text",   placeholder:"e.g. Cotton, Polyester, Silk" },
  ],
  dresses:          [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"length", label:"Length", type:"select", options:["Mini","Midi","Maxi"] }, { key:"colors", label:"Colors", type:"text" }],
  tops:             [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"colors", label:"Colors", type:"text" }],
  skirts:           [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"length", label:"Length", type:"select", options:["Mini","Midi","Maxi"] }],
  swimwear:         [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"colors", label:"Colors", type:"text" }],
  lingerie:         [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"colors", label:"Colors", type:"text" }],
  "womens-suits":   [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"colors", label:"Color", type:"text" }],
  "womens-trousers":[{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"cut", label:"Cut", type:"select", options:["Skinny","Slim","Straight","Wide Leg","Bootcut"] }],

  // Men's Fashion
  "mens-fashion": [
    { key:"size",     label:"Size (comma-sep)", type:"text", placeholder:"e.g. M, L, XL" },
    { key:"colors",   label:"Colors",   type:"text",   placeholder:"e.g. White, Black, Grey" },
    { key:"material", label:"Material", type:"text",   placeholder:"e.g. Cotton, Denim, Fleece" },
  ],
  tshirts:          [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. M, L, XL" }, { key:"colors", label:"Colors", type:"text" }],
  shirts:           [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. M, L, XL" }, { key:"collar", label:"Collar", type:"select", options:["Button-Down","Mandarin","Polo","Other"] }],
  shorts:           [{ key:"waist", label:"Waist Size (comma-sep)", type:"text", placeholder:"e.g. 30, 32, 34" }, { key:"colors", label:"Colors", type:"text" }],
  hoodies:          [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. M, L, XL" }, { key:"colors", label:"Colors", type:"text" }],
  "mens-suits":     [{ key:"size", label:"Suit Size", type:"text", placeholder:"e.g. 40R, 42L" }, { key:"colors", label:"Color", type:"text" }],
  "mens-trousers":  [{ key:"waist", label:"Waist (inches, comma-sep)", type:"text", placeholder:"30, 32, 34, 36" }, { key:"length", label:"Leg Length", type:"select", options:["28\"","30\"","32\"","34\""] }],
  "mens-activewear":[{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. M, L, XL" }, { key:"sport", label:"Sport / Use", type:"text", placeholder:"e.g. Running, Gym" }],

  // Kids & Baby
  kids: [
    { key:"age_range", label:"Age Range",      type:"select", options:["0–6m","6–12m","1–2yr","3–5yr","6–9yr","10–12yr","13+yr"] },
    { key:"gender",    label:"Gender",         type:"select", options:["Boys","Girls","Unisex"] },
    { key:"size",      label:"Size / EU Shoe (comma-sep)", type:"text",   placeholder:"e.g. M, L or 28, 29" },
  ],
  "baby-clothing": [{ key:"age",    label:"Age",           type:"select", options:["Newborn","0–3m","3–6m","6–12m","12–18m","18–24m"] }, { key:"gender", label:"Gender", type:"select", options:["Boys","Girls","Unisex"] }],
  "kids-clothing": [{ key:"age",    label:"Age / Size",    type:"select", options:["2–3yr","4–5yr","6–7yr","8–9yr","10–11yr","12–13yr"] }, { key:"gender", label:"Gender", type:"select", options:["Boys","Girls","Unisex"] }],
  toys:            [{ key:"age",    label:"Recommended Age", type:"text", placeholder:"e.g. 3–6 years" }, { key:"type", label:"Toy Type", type:"text", placeholder:"e.g. Board game, Action figure" }],
  school:          [{ key:"grade", label:"Grade Level",    type:"text", placeholder:"e.g. Grade 4, Form 2" }],

  // Beauty & Skincare
  beauty: [
    { key:"volume",    label:"Size / Volume (comma-sep)", type:"text", placeholder:"e.g. 50ml, 100ml" },
    { key:"skin_type", label:"Skin Type",      type:"select", options:["All Skin Types","Dry","Oily","Combination","Sensitive"] },
    { key:"authentic", label:"Authenticity",   type:"select", options:["100% Authentic","Inspired / Dupe"] },
  ],
  makeup:      [{ key:"volume", label:"Size / Weight", type:"text", placeholder:"e.g. 30ml, 5g" }, { key:"shade", label:"Shade (if applicable)", type:"text", placeholder:"e.g. 02 Natural Beige" }, { key:"authentic", label:"Authenticity", type:"select", options:["100% Authentic","Inspired / Dupe"] }],
  skincare:    [{ key:"volume", label:"Volume / Weight (comma-sep)", type:"text", placeholder:"e.g. 50ml, 100ml" }, { key:"skin_type", label:"Skin Type", type:"select", options:["All Skin Types","Dry","Oily","Combination","Sensitive"] }, { key:"authentic", label:"Authenticity", type:"select", options:["100% Authentic","Inspired / Dupe"] }],
  haircare:    [{ key:"volume", label:"Volume / Weight", type:"text", placeholder:"e.g. 250ml" }, { key:"hair_type", label:"Hair Type", type:"select", options:["All Hair Types","Natural / 4C","Relaxed","Wavy","Straight"] }],
  fragrances:  [{ key:"volume", label:"Volume (ml, comma-sep)", type:"text", placeholder:"e.g. 50ml, 100ml" }, { key:"type", label:"Type", type:"select", options:["EDP","EDT","Cologne","Body Mist","Oil"] }, { key:"authentic", label:"Authenticity", type:"select", options:["100% Authentic","Inspired / Dupe"] }],
  "nail-care": [{ key:"volume", label:"Size", type:"text", placeholder:"e.g. 15ml" }, { key:"colors", label:"Shade / Color", type:"text", placeholder:"e.g. Nude Pink, Red" }],

  // Bags & Accessories
  bags: [
    { key:"material", label:"Material", type:"select", options:["Genuine Leather","Faux Leather","Canvas","Fabric","Suede","Other"] },
    { key:"colors",   label:"Colors",   type:"text",   placeholder:"e.g. Black, Tan, Beige" },
    { key:"size",     label:"Size (comma-sep)", type:"text", placeholder:"e.g. Small, Medium, Large" },
  ],
  handbags:   [{ key:"material", label:"Material", type:"select", options:["Genuine Leather","Faux Leather","Canvas","Other"] }, { key:"colors", label:"Colors", type:"text" }, { key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. Small, Medium" }],
  backpacks:  [{ key:"material", label:"Material", type:"select", options:["Nylon","Canvas","Leather","Faux Leather","Other"] }, { key:"capacity", label:"Capacity (L, comma-sep)", type:"text", placeholder:"e.g. 20L, 35L" }],
  wallets:    [{ key:"material", label:"Material", type:"select", options:["Genuine Leather","Faux Leather","Canvas","Fabric"] }, { key:"colors", label:"Colors", type:"text" }],
  belts:      [{ key:"size", label:"Size", type:"text", placeholder:"e.g. 32\", 34\" or S / M / L" }, { key:"material", label:"Material", type:"select", options:["Genuine Leather","Faux Leather","Fabric","Chain"] }],
  sunglasses: [{ key:"frame", label:"Frame Shape", type:"select", options:["Round","Square","Aviator","Wayfarer","Cat-Eye","Oversized"] }, { key:"uv", label:"UV Protection", type:"select", options:["UV400","Polarized","Fashion Only"] }],
  jewellery:  [{ key:"material", label:"Material", type:"select", options:["Gold Plated","Silver","Sterling Silver","Rose Gold","Stainless Steel","Other"] }, { key:"type", label:"Type", type:"select", options:["Necklace","Bracelet","Earrings","Ring","Anklet","Set"] }],
  watches:    [{ key:"gender", label:"Gender", type:"select", options:["Men","Women","Unisex"] }, { key:"movement", label:"Movement", type:"select", options:["Quartz","Automatic","Smart","Solar","Other"] }, { key:"case_size", label:"Case Size (mm)", type:"text", placeholder:"e.g. 40mm" }],

  // Sports & Fitness
  sports: [
    { key:"sport",  label:"Sport / Use",   type:"text", placeholder:"e.g. Running, Football, Yoga" },
    { key:"size",   label:"Size / Weight (comma-sep)", type:"text", placeholder:"e.g. M, L, 5kg" },
    { key:"colors", label:"Colors",        type:"text", placeholder:"e.g. Black, Red" },
  ],
  sportswear:         [{ key:"size", label:"Size (comma-sep)", type:"text", placeholder:"e.g. S, M, L" }, { key:"sport", label:"Sport", type:"text", placeholder:"e.g. Running, Football" }, { key:"gender", label:"Gender", type:"select", options:["Men","Women","Unisex"] }],
  "sports-equipment": [{ key:"sport", label:"Sport", type:"text", placeholder:"e.g. Football, Basketball, Tennis" }, { key:"size", label:"Size / Weight (if applicable)", type:"text" }],
  supplements:        [{ key:"weight", label:"Weight / Servings", type:"text", placeholder:"e.g. 1kg, 30 servings" }, { key:"flavor", label:"Flavor", type:"text", placeholder:"e.g. Chocolate, Vanilla" }, { key:"authentic", label:"Authenticity", type:"select", options:["100% Authentic","Local Brand"] }],
  cycling:            [{ key:"type", label:"Bike Type", type:"select", options:["Road","Mountain","Hybrid","BMX","Kids","E-Bike","Accessory"] }, { key:"size", label:"Frame Size", type:"text", placeholder:"e.g. 26\", Medium" }],
  outdoor:            [{ key:"type", label:"Gear Type", type:"text", placeholder:"e.g. Tent, Hiking Boots, Backpack" }, { key:"size", label:"Size (if applicable)", type:"text" }],

  // Electronics (parent)
  electronics: [
    { key:"model",   label:"Model",   type:"text",   placeholder:"e.g. Galaxy S24" },
    { key:"storage", label:"Storage (comma-sep)", type:"text", placeholder:"e.g. 64GB, 128GB" },
    { key:"colors",  label:"Color",   type:"text",   placeholder:"e.g. Black, Silver" },
  ],
  // Electronics subcategories
  phones: [
    { key:"model",       label:"Model",          type:"text",   placeholder:"e.g. Samsung Galaxy S24 Ultra" },
    { key:"year",        label:"Year",           type:"select", options:["2025","2024","2023","2022","2021","2020","2019","Older"] },
    { key:"storage",     label:"Storage (comma-sep)", type:"text", placeholder:"e.g. 128GB, 256GB" },
    { key:"ram",         label:"RAM",            type:"select", options:["2GB","3GB","4GB","6GB","8GB","12GB","16GB"] },
    { key:"colors",      label:"Color (comma-sep)", type:"text", placeholder:"e.g. Phantom Black" },
    { key:"network",     label:"Network",        type:"select", options:["4G LTE","5G","3G / 2G"] },
    { key:"accessories", label:"In the Box",     type:"text",   placeholder:"e.g. Charger, Case, Original box" },
  ],
  laptops: [
    { key:"model",     label:"Model",       type:"text",   placeholder:"e.g. MacBook Air M2" },
    { key:"year",      label:"Year",        type:"select", options:["2025","2024","2023","2022","2021","2020","Older"] },
    { key:"processor", label:"Processor",   type:"text",   placeholder:"e.g. Intel Core i7, Apple M2, Ryzen 5" },
    { key:"ram",       label:"RAM",         type:"select", options:["4GB","8GB","16GB","32GB","64GB"] },
    { key:"storage",   label:"Storage (comma-sep)", type:"text", placeholder:"e.g. 256GB, 512GB" },
    { key:"screen",    label:"Screen Size", type:"select", options:["11\"","13\"","14\"","15.6\"","16\"","17\""] },
    { key:"colors",    label:"Color",       type:"text",   placeholder:"e.g. Space Grey, Silver" },
  ],
  audio: [
    { key:"model",        label:"Model",        type:"text",   placeholder:"e.g. AirPods Pro 2" },
    { key:"type",         label:"Type",         type:"select", options:["Earbuds","Over-Ear","On-Ear","IEM","Speaker"] },
    { key:"connectivity", label:"Connectivity", type:"select", options:["Wired","Wireless / Bluetooth","Both"] },
    { key:"colors",       label:"Color",        type:"text",   placeholder:"e.g. White, Black" },
  ],
  cameras: [
    { key:"model",       label:"Model",                type:"text",   placeholder:"e.g. Canon EOS R50" },
    { key:"type",        label:"Camera Type",          type:"select", options:["DSLR","Mirrorless","Point & Shoot","Action Cam","Drone","Security"] },
    { key:"megapixels",  label:"Megapixels",           type:"text",   placeholder:"e.g. 24MP" },
    { key:"accessories", label:"Accessories included", type:"text",   placeholder:"e.g. Lens, Bag, Charger" },
  ],
  gaming: [
    { key:"platform", label:"Platform",    type:"select", options:["PlayStation 5","PlayStation 4","Xbox Series X/S","Xbox One","Nintendo Switch","PC","Other"] },
    { key:"type",     label:"Item Type",   type:"select", options:["Console","Game / Title","Controller","Headset","Accessory","Bundle"] },
    { key:"model",    label:"Title / Model", type:"text", placeholder:"e.g. FIFA 25, DualSense White" },
  ],
  smartwatches: [
    { key:"model",         label:"Model",           type:"text",   placeholder:"e.g. Apple Watch Series 9" },
    { key:"compatibility", label:"Compatible With", type:"select", options:["iOS Only","Android Only","Both"] },
    { key:"size",          label:"Case Size",       type:"select", options:["40mm","41mm","44mm","45mm","49mm","Other"] },
    { key:"colors",        label:"Color / Band",    type:"text",   placeholder:"e.g. Midnight, Starlight" },
  ],
  "phone-accessories": [
    { key:"type",            label:"Accessory Type",  type:"select", options:["Case / Cover","Screen Protector","Charger","Cable","Power Bank","Earphones","Other"] },
    { key:"compatible_with", label:"Compatible With", type:"text",   placeholder:"e.g. Samsung S24, iPhone 15" },
    { key:"colors",          label:"Color",           type:"text",   placeholder:"e.g. Clear, Black, Blue" },
  ],

  // Home & Living
  home: [
    { key:"material",   label:"Material",              type:"text", placeholder:"e.g. Ceramic, Wood, Stainless Steel" },
    { key:"colors",     label:"Color",                 type:"text", placeholder:"e.g. White, Beige, Black" },
    { key:"dimensions", label:"Dimensions (optional)", type:"text", placeholder:"e.g. 30×20×10 cm" },
  ],
  kitchen:   [{ key:"material", label:"Material", type:"select", options:["Stainless Steel","Ceramic","Non-Stick","Cast Iron","Plastic","Wood","Glass"] }, { key:"capacity", label:"Capacity (optional)", type:"text", placeholder:"e.g. 2L, 5-piece set" }],
  bedding:   [{ key:"size", label:"Bed Size", type:"select", options:["Single","Twin","Double","Queen","King"] }, { key:"material", label:"Material", type:"select", options:["Cotton","Microfibre","Flannel","Silk","Bamboo"] }],
  decor:     [{ key:"material", label:"Material", type:"text", placeholder:"e.g. Wood, Metal, Fabric" }, { key:"colors", label:"Colors", type:"text" }, { key:"dimensions", label:"Dimensions (optional)", type:"text" }],
  furniture: [{ key:"material", label:"Material", type:"select", options:["Wood","Metal","Fabric","Leather","Glass","Plastic","Rattan"] }, { key:"dimensions", label:"Dimensions", type:"text", placeholder:"e.g. 120×60×75 cm" }, { key:"colors", label:"Color", type:"text" }],
  cleaning:  [{ key:"volume", label:"Volume / Quantity", type:"text", placeholder:"e.g. 1L, 5-pack" }, { key:"type", label:"Type", type:"text", placeholder:"e.g. Floor cleaner, Detergent" }],
};

const getSpecFields = (category: string, subcategory: string): SpecField[] => {
  if (subcategory && SPEC_FIELDS[subcategory]) return SPEC_FIELDS[subcategory];
  if (SPEC_FIELDS[category]) return SPEC_FIELDS[category];
  return [{ key:"colors", label:"Colors / Variants (optional)", type:"text", placeholder:"e.g. Black, White, Red" }];
};

// ── Tiny input/select components ──────────────────────────────────────────────
const Field = ({ label, children, ai, action }: { label: string; children: React.ReactNode; ai?: boolean; action?: React.ReactNode }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-medium text-foreground">
        {label}
        {ai && <span className="ml-1.5 align-middle text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary" title="Suggested by AI. Check it.">AI</span>}
      </label>
      {action}
    </div>
    {children}
  </div>
);

const TextInput = ({ value, onChange, placeholder = "" }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition"
  />
);

const SelectInput = ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 transition appearance-none"
  >
    <option value="">{placeholder || "Select…"}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

// ── Draft shape ────────────────────────────────────────────────────────────────
// One object per in-progress listing. It's kept in localStorage for an instant
// restore and mirrored to the seller's account (product_drafts) so a listing
// started on a phone can be finished on a laptop. Photos upload the moment
// they're picked, so the draft only ever holds URLs.
type Draft = {
  step: 1 | 2 | 3;
  images: string[];
  category: string;
  subcategory: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  brand: string;
  condition: string;
  conditionNotes: string;
  freeDelivery: boolean;
  keyFeatures: string;
  videoUrl: string | null;
  specs: Record<string, string>;
  updatedAt: number;
};

const EMPTY_DRAFT: Draft = {
  step: 1, images: [], category: "", subcategory: "", name: "", description: "", price: "", stock: "1",
  brand: "", condition: "new", conditionNotes: "", freeDelivery: false, keyFeatures: "", videoUrl: null,
  specs: {}, updatedAt: 0,
};

const hasContent = (d: Draft) => d.images.length > 0 || !!d.category || !!d.name || !!d.price;
const MAX_PHOTOS = 4;
const MAX_PRICE = 300000;

// ── Listing strength ──────────────────────────────────────────────────────────
// Only photos, category, name and price are required. Everything else raises
// the score, and the top tip names the most valuable thing still missing.
const listingStrength = (d: Draft, specFields: SpecField[]) => {
  const photoPts = [0, 15, 22, 27, 30][Math.min(d.images.length, 4)];
  const filledSpecs = specFields.filter((f) => (d.specs[f.key] || "").trim()).length;
  // Detail-type points only count once there is a category to describe.
  const specPts = !d.category ? 0 : specFields.length ? Math.round((12 * filledSpecs) / specFields.length) : 12;
  const descLen = d.description.trim().length;
  const priceOk = parseInt(d.price) > 0 && parseInt(d.price) <= MAX_PRICE;

  const parts = [
    { pts: photoPts, max: 30, tip: d.images.length === 0 ? "Add photos of the item" : `Add ${Math.max(3 - d.images.length, 1)} more photo${3 - d.images.length > 1 ? "s" : ""}: buyers want to see every angle` },
    { pts: d.category ? 8 : 0, max: 8, tip: "Pick a category" },
    { pts: d.subcategory ? 4 : 0, max: 4, tip: "Choose a type so it shows up in the right filter" },
    { pts: d.name.trim().length >= 10 ? 8 : d.name.trim() ? 4 : 0, max: 8, tip: "Give it a fuller name, like brand, model and colour" },
    { pts: priceOk ? 8 : 0, max: 8, tip: "Add a price" },
    { pts: descLen >= 60 ? 14 : descLen >= 20 ? 7 : 0, max: 14, tip: "Describe it in a sentence or two: fit, flaws, what's included" },
    { pts: specPts, max: 12, tip: "Fill in sizes and details so buyers can filter for it" },
    { pts: d.brand.trim() || d.specs.brand || d.specs.model ? 4 : 0, max: 4, tip: "Add the brand" },
    { pts: d.category && (d.condition === "new" || d.conditionNotes.trim().length >= 10) ? 4 : 0, max: 4, tip: "Note any wear or marks so there are no surprises" },
    { pts: d.videoUrl ? 4 : 0, max: 4, tip: "Add a short video" },
    { pts: d.keyFeatures.trim() ? 4 : 0, max: 4, tip: "List a few key features" },
  ];
  const percent = parts.reduce((s, p) => s + p.pts, 0);
  const next = parts
    .filter((p) => p.pts < p.max)
    .sort((a, b) => (b.max - b.pts) - (a.max - a.pts))[0];
  return { percent, tip: next?.tip ?? null };
};

const storagePathFromUrl = (url: string) => url.split("/product-images/")[1] ?? null;

// ── "List another like this" ───────────────────────────────────────────────────
// A new draft that keeps everything about an existing item except its photos
// and video: a seller listing the same shoe in another size or colour only
// adds new photos and changes what differs.
const VARIANT_KEYS = ["sizes", "size", "storage", "volume", "capacity", "waist"];
const CONDITION_FROM_DB: Record<string, string> = { good: "thrifted", fair: "thrifted", like_new: "refurbished" };

/** A saved product row, as a fresh draft at the photos step. */
const draftFromProduct = (p: any): Draft => {
  const category: string = p.category ?? "";
  const subcategory: string = p.subcategory ?? "";
  const fields = category ? getSpecFields(category, subcategory) : [];
  const elec = isElectronics(category, subcategory);

  const specs: Record<string, string> = { ...(p.specs ?? {}) };
  const sizes = Array.isArray(p.sizes) ? p.sizes.filter(Boolean).join(", ") : "";
  // Sizes live under a different spec key per category (sizes, storage, volume...).
  if (sizes) specs[fields.find((f) => VARIANT_KEYS.includes(f.key))?.key ?? "sizes"] = sizes;
  const colors = Array.isArray(p.colors) ? p.colors.filter(Boolean).join(", ") : "";
  if (colors) specs.colors = colors;
  if (elec && p.brand && !specs.brand) specs.brand = p.brand;

  let condition: string = CONDITION_FROM_DB[p.condition] ?? p.condition ?? "new";
  // Each group offers two conditions; map the stored one onto its own.
  if (!elec && condition === "refurbished") condition = "thrifted";
  if (elec && condition === "thrifted") condition = "refurbished";

  return {
    ...EMPTY_DRAFT,
    step: 1,
    category,
    subcategory,
    name: p.name ?? "",
    description: p.description ?? "",
    price: p.price_ksh ? String(Math.round(p.price_ksh)) : "",
    stock: String(p.stock ?? 1),
    brand: elec ? "" : p.brand ?? "",
    condition,
    conditionNotes: p.condition_notes ?? "",
    freeDelivery: !!p.free_delivery,
    keyFeatures: Array.isArray(p.key_features) ? p.key_features.join(", ") : "",
    specs,
    updatedAt: Date.now(),
  };
};

/** A draft that was just published, as the starting point for the next one. */
const templateOf = (d: Draft): Draft => ({ ...d, images: [], videoUrl: null, step: 1, updatedAt: Date.now() });

/** What AI help may fill in for an item: only blanks, unless the seller asked for a new description. */
const planAiFill = (d: Draft, f: AiListingFields, mode: "all" | "description") => {
  const patch: Partial<Draft> = {};
  const filled: string[] = [];

  if (mode === "description") {
    if (f.description) { patch.description = f.description; filled.push("description"); }
    if (!d.keyFeatures.trim() && f.key_features.length) { patch.keyFeatures = f.key_features.join(", "); filled.push("features"); }
    return { patch, filled };
  }

  if (!d.category && f.category) {
    patch.category = f.category;
    patch.subcategory = f.subcategory;
  } else if (d.category === f.category && !d.subcategory && f.subcategory) {
    patch.subcategory = f.subcategory;
  }
  const category = patch.category ?? d.category;
  const subcategory = patch.subcategory ?? d.subcategory;
  const elec = isElectronics(category, subcategory);

  if (!d.name.trim() && f.name) { patch.name = f.name; filled.push("name"); }
  if (!d.description.trim() && f.description) { patch.description = f.description; filled.push("description"); }
  if (!d.keyFeatures.trim() && f.key_features.length) { patch.keyFeatures = f.key_features.join(", "); filled.push("features"); }

  const specs = { ...d.specs };
  if (f.brand) {
    if (elec) { if (!specs.brand) { specs.brand = f.brand; filled.push("brand"); } }
    else if (!d.brand.trim()) { patch.brand = f.brand; filled.push("brand"); }
  }
  if (f.colors.length && category && getSpecFields(category, subcategory).some((s) => s.key === "colors") && !specs.colors) {
    specs.colors = f.colors.join(", ");
    filled.push("colours");
  }
  if (specs.brand !== d.specs.brand || specs.colors !== d.specs.colors) patch.specs = specs;

  // "New" is the default, so only a clear used/refurbished reading changes it.
  const allowed = elec ? ["refurbished"] : ["thrifted"];
  if (d.condition === "new" && allowed.includes(f.condition)) { patch.condition = f.condition; filled.push("condition"); }

  patch.step = 3;
  return { patch, filled };
};

// ── Main component ─────────────────────────────────────────────────────────────
// userId comes from the page wrapper, which waits for auth. useAuth() isn't
// shared state, so reading it here would start as "no user", mount the draft
// under the wrong key, and wipe the real draft when the id arrived.
const VendorListItem = ({ userId }: { userId: string }) => {
  const navigate = useNavigate();
  const location = useLocation();
  // Set when a seller came here from "List another like this" on a product.
  const cloneFrom = (location.state as { cloneFrom?: any } | null)?.cloneFrom;
  const [draft, setDraft, { clear: clearLocalDraft }] = usePersistentState<Draft>(`list-item-draft:${userId}`, EMPTY_DRAFT);
  const [serverChecked, setServerChecked] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "offline">("idle");
  const [showRestored, setShowRestored] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // The item just listed. While set, the page says so instead of showing the form again.
  const [done, setDone] = useState<{ id: string; name: string; image: string; template: Draft } | null>(null);
  // Name of the item a new draft was copied from.
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  // AI help: null until the server says whether it is on and under budget.
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFilled, setAiFilled] = useState<string[]>([]);
  const [aiUnsure, setAiUnsure] = useState<string[]>([]);

  // Update helper: every change stamps the draft so the newer copy wins.
  const update = (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDraft((d) => ({ ...d, ...(typeof patch === "function" ? patch(d) : patch), updatedAt: Date.now() }));

  // Editing a field an AI suggestion filled makes it the seller's own again.
  const own = (key: string) => setAiFilled((l) => (l.includes(key) ? l.filter((k) => k !== key) : l));

  useEffect(() => {
    let live = true;
    aiListingStatus().then((ok) => live && setAiAvailable(ok));
    return () => { live = false; };
  }, []);

  // On open, take whichever copy is newer: this device's or the account's.
  useEffect(() => {
    // Coming from "List another like this": start from that item, and drop the
    // router state so a refresh doesn't copy it again.
    if (cloneFrom) {
      setDraft(draftFromProduct(cloneFrom));
      setCopiedFrom(cloneFrom.name ?? "your item");
      setServerChecked(true);
      navigate(location.pathname, { replace: true, state: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("product_drafts").select("data").eq("vendor_id", userId).maybeSingle();
      if (cancelled) return;
      const remote = data?.data as Draft | undefined;
      if (remote && hasContent(remote) && (remote.updatedAt ?? 0) > (draft.updatedAt ?? 0)) {
        setDraft({ ...EMPTY_DRAFT, ...remote });
        setShowRestored(true);
      } else if (hasContent(draft)) {
        setShowRestored(true);
      }
      setServerChecked(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Mirror to the account a moment after the seller stops typing.
  useEffect(() => {
    if (!serverChecked || !draft.updatedAt) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const { error } = await (supabase as any).from("product_drafts").upsert({
        vendor_id: userId, data: draft, updated_at: new Date().toISOString(),
      });
      setSaveState(error ? "offline" : "saved");
    }, 1200);
    return () => clearTimeout(t);
  }, [draft, serverChecked, userId]);

  const selectedCat = ALL_CATEGORIES.find((c) => c.key === draft.category);
  const specFields = draft.category ? getSpecFields(draft.category, draft.subcategory) : [];
  const isElec = isElectronics(draft.category, draft.subcategory);
  const conditions = isElec ? CONDITIONS_ELECTRONICS : CONDITIONS_GENERAL;
  const showBrandField = !isElec;
  const strength = listingStrength(draft, specFields);

  const priceNum = parseInt(draft.price);
  const priceOk = priceNum > 0 && priceNum <= MAX_PRICE;
  const stockOk = parseInt(draft.stock) > 0;
  const canPublish = draft.images.length > 0 && !!draft.category && !!draft.name.trim() && priceOk && stockOk && uploadingCount === 0;

  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const room = MAX_PHOTOS - draft.images.length - uploadingCount;
    if (files.length > room) toast.error(`You can add ${room} more photo${room === 1 ? "" : "s"}`);
    const batch = files.slice(0, Math.max(room, 0));
    if (!batch.length) return;
    setUploadingCount((n) => n + batch.length);
    try {
      const compressed = await compressImages(batch);
      for (const file of compressed) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file);
        setUploadingCount((n) => n - 1);
        if (error) { toast.error(error); continue; }
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
        update((d) => ({ images: [...d.images, publicUrl].slice(0, MAX_PHOTOS) }));
      }
    } catch {
      setUploadingCount(0);
      toast.error("Couldn't process those photos. Try again.");
    }
  };

  const removeImage = (url: string) => {
    update((d) => ({ images: d.images.filter((u) => u !== url) }));
    const path = storagePathFromUrl(url);
    if (path) void supabase.storage.from("product-images").remove([path]);
  };

  const makeCover = (url: string) => update((d) => ({ images: [url, ...d.images.filter((u) => u !== url)] }));

  const resetDraft = async (removePhotos: boolean) => {
    if (removePhotos) {
      const paths = draft.images.map(storagePathFromUrl).filter(Boolean) as string[];
      if (paths.length) void supabase.storage.from("product-images").remove(paths);
    }
    await (supabase as any).from("product_drafts").delete().eq("vendor_id", userId);
    // clear() wipes this device's copy right now. Setting EMPTY_DRAFT alone is
    // not enough: the browser copy is only cleared on a short delay, and
    // leaving the page right after publishing cancelled it, so the next visit
    // greeted a seller who had already listed with "we kept your unfinished
    // listing".
    clearLocalDraft();
    setShowRestored(false);
    setAiFilled([]);
    setAiUnsure([]);
  };

  /** Ask AI to read the photos. "all" fills blanks across the form; "description" writes a fresh description. */
  const runAi = async (mode: "all" | "description") => {
    if (aiBusy || !draft.images.length) return;
    setAiBusy(true);
    const result = await aiListingFill(draft.images, draft.name.trim());
    setAiBusy(false);
    if (result.ok === false) {
      if (result.unavailable) setAiAvailable(false);
      toast.error(result.message);
      return;
    }
    // Nothing readable in the photos (no category and no name): say so rather than jump ahead with a blank form.
    if (mode === "all" && !result.fields.category && !result.fields.name) {
      toast.error("AI couldn't tell what this is from the photos. Fill in the details yourself.");
      return;
    }
    const { patch, filled } = planAiFill(draft, result.fields, mode);
    update(patch);
    setAiFilled((l) => Array.from(new Set([...l, ...filled])));
    setAiUnsure(result.fields.uncertain);
  };

  /** Start the next listing from the one just published (same details, new photos). */
  const startAnotherLikeThis = () => {
    if (!done) return;
    setDraft(done.template);
    setCopiedFrom(done.name);
    setDone(null);
  };

  const startFresh = () => {
    clearLocalDraft();
    setCopiedFrom(null);
    setDone(null);
  };

  const handleSubmit = async () => {
    if (!canPublish) return;
    setSubmitting(true);
    try {
      // Photos are uploaded once per listing, so a product that already uses
      // this cover photo is this same listing. Don't list it twice: a seller
      // who wasn't sure the first tap worked shouldn't end up with a duplicate.
      const { data: existing } = await supabase
        .from("products").select("id, status").eq("vendor_id", userId).contains("images", [draft.images[0]]).limit(1).maybeSingle();
      if (existing) {
        if (existing.status === "draft") await supabase.rpc("publish_product", { product_id_to_publish: existing.id });
        await resetDraft(false);
        setDone({ id: existing.id, name: draft.name.trim(), image: draft.images[0], template: templateOf(draft) });
        toast.success("This item is already listed");
        return;
      }

      const { specs, condition } = draft;
      const variantRaw = specs.sizes || specs.size || specs.storage || specs.volume || specs.capacity || specs.waist || "";
      const sizesArr = parseSizesInput(variantRaw); // "38-45" becomes 38, 39 … 45
      const colorsArr = (specs.colors || "").split(",").map((s) => s.trim()).filter(Boolean);
      const cleanSpecs: Record<string, string> = {};
      Object.entries(specs).forEach(([k, v]) => { if (v && k !== "sizes" && k !== "colors") cleanSpecs[k] = v; });
      // DB constraint: new | like_new | good | fair
      const safeCondition = ({ thrifted: "good", refurbished: "like_new" } as Record<string, string>)[condition] ?? condition;
      const effectiveBrand = isElec ? (specs.brand || draft.brand || null) : (draft.brand || null);

      const { data: inserted, error: insertErr } = await supabase.from("products").insert({
        vendor_id: userId,
        name: draft.name.trim(),
        description: draft.description.trim(),
        price_ksh: priceNum,
        stock: parseInt(draft.stock),
        brand: effectiveBrand,
        category: draft.category,
        condition: safeCondition,
        sizes: sizesArr,
        colors: colorsArr,
        images: draft.images,
        status: "draft",
      }).select("id").single();
      if (insertErr) throw insertErr;

      // Newer columns saved separately so listing still succeeds if the schema cache lags.
      try {
        const extras: Record<string, any> = {};
        if (draft.subcategory) extras.subcategory = draft.subcategory;
        if (draft.conditionNotes) extras.condition_notes = draft.conditionNotes;
        if (draft.freeDelivery) extras.free_delivery = true;
        if (draft.keyFeatures) extras.key_features = draft.keyFeatures.split(",").map((s) => s.trim()).filter(Boolean);
        if (draft.videoUrl) extras.video_url = draft.videoUrl;
        if (Object.keys(cleanSpecs).length) extras.specs = cleanSpecs;
        if (Object.keys(extras).length) await supabase.from("products").update(extras).eq("id", inserted.id);
      } catch { /* schema cache not refreshed yet */ }

      const { error: publishErr } = await supabase.rpc("publish_product", { product_id_to_publish: inserted.id });
      // The product row exists either way, so the local draft is done with.
      const justListed = { name: draft.name.trim(), image: draft.images[0], template: templateOf(draft) };
      await resetDraft(false);
      if (publishErr) {
        toast.error("Saved, but not live yet", { description: "Open it in My Products and tap Publish." });
        navigate("/vendor/products");
        return;
      }

      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", userId);
      if (count === 1) {
        celebrate({
          title: "You're live",
          subtitle: "Your first item is in the shop. Share your store link so buyers can find it.",
          cta: "Done",
        });
      } else {
        toast.success("Item listed", { description: `Listing strength ${strength.percent}%` });
      }
      // Stay on a clear "you're live" screen, with the next step one tap away.
      setDone({ id: inserted.id, ...justListed });
    } catch (e: any) {
      toast.error(e, { retry: handleSubmit, description: "Your listing is still saved as a draft." });
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = ["Photos", "What is it?", "Details"];
  const goBack = () => (draft.step === 1 ? navigate("/vendor/products") : update({ step: (draft.step - 1) as Draft["step"] }));

  // Listed. Say so plainly, and make the next listing one tap away.
  if (done) {
    return (
      <div data-layout="designed" className="min-h-screen bg-sunken">
        <div className="flex">
          <VendorSidebar />
          <main className="flex-1 min-w-0">
            <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
              <div className="rounded-3xl bg-card p-6 sm:p-8 shadow-card text-center space-y-6 animate-fade-in">
                <div className="mx-auto h-16 w-16 rounded-full bg-success/15 text-success flex items-center justify-center">
                  <CheckCircle2 size={34} strokeWidth={1.75} />
                </div>
                <div className="space-y-1.5">
                  <h1 className="font-display text-2xl leading-tight">You've listed it</h1>
                  <p className="text-sm text-muted-foreground">It's live in the shop. Nothing more to do for this one.</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-sunken p-3 text-left">
                  <img src={done.image} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />
                  <p className="font-medium text-sm leading-snug line-clamp-2">{done.name}</p>
                </div>
                <div className="space-y-2.5">
                  <button onClick={startAnotherLikeThis}
                    className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover transition-colors active:scale-[0.98]">
                    <CopyPlus size={16} strokeWidth={2} /> List another like this
                  </button>
                  <p className="text-xs text-muted-foreground">Keeps the details. You add new photos and change what differs, like size or colour.</p>
                  <button onClick={startFresh}
                    className="w-full h-12 rounded-full border border-border bg-card font-semibold text-sm hover:border-foreground/40 transition-colors">
                    List something different
                  </button>
                  <button onClick={() => navigate("/vendor/products")} className="w-full h-10 text-sm font-medium text-muted-foreground hover:text-foreground">
                    View my products
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div data-layout="designed" className="min-h-screen bg-sunken">
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 pb-28">

          {/* Header */}
          <div className="flex flex-nowrap items-center gap-3 mb-4">
            <button onClick={goBack} aria-label="Back"
              className="h-11 w-11 shrink-0 rounded-full bg-card hover:bg-background flex items-center justify-center text-muted-foreground transition-colors">
              <ChevronLeft size={18} strokeWidth={1.75} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl leading-tight">List an item</h1>
              <p className="text-xs text-muted-foreground">
                Step {draft.step} of 3 · {STEPS[draft.step - 1]}
                <span className="mx-1.5">·</span>
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved to your account" : saveState === "offline" ? "Saved on this device" : "Drafts save automatically"}
              </p>
            </div>
          </div>

          {/* Listing strength meter */}
          <div className="mb-5 rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">Listing strength</p>
              <p className="font-display text-2xl tabular-nums leading-none">{strength.percent}%</p>
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-foreground/10 overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${strength.percent}%` }} />
            </div>
            {strength.tip && <p className="mt-2 text-xs text-muted-foreground">Next: {strength.tip}</p>}
          </div>

          {showRestored && (
            <div className="mb-4 flex flex-nowrap items-center gap-3 rounded-2xl border border-primary/25 bg-cream px-4 py-3 text-sm animate-fade-in">
              <span className="flex-1">Welcome back. We kept your unfinished listing.</span>
              <button onClick={() => resetDraft(true)} className="py-2 -my-2 text-xs font-semibold text-muted-foreground hover:text-foreground underline underline-offset-2">
                Start over
              </button>
              <button onClick={() => setShowRestored(false)} className="py-2 -my-2 text-xs font-semibold">OK</button>
            </div>
          )}

          {copiedFrom && (
            <div className="mb-4 flex flex-nowrap items-center gap-3 rounded-2xl border border-primary/25 bg-cream px-4 py-3 text-sm animate-fade-in">
              <CopyPlus size={16} className="shrink-0 text-primary" aria-hidden="true" />
              <span className="flex-1 min-w-0">Started from <strong className="font-semibold">{copiedFrom}</strong>. Add new photos, then change what's different.</span>
              <button onClick={() => setCopiedFrom(null)} className="py-2 -my-2 text-xs font-semibold">OK</button>
            </div>
          )}

          {/* ── STEP 1: Photos ── */}
          {draft.step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-sans text-base font-semibold tracking-normal">Start with photos</h2>
                <p className="text-sm text-muted-foreground">Up to 4. The first one is the cover. Daylight shots look best.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {draft.images.map((src, i) => (
                  <div key={src} className="relative rounded-2xl overflow-hidden aspect-square bg-card">
                    <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(src)} aria-label={`Remove photo ${i + 1}`}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <X size={15} strokeWidth={2} />
                    </button>
                    {i === 0 ? (
                      <span className="absolute bottom-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Cover</span>
                    ) : (
                      <button onClick={() => makeCover(src)} className="absolute bottom-2 left-2 text-[11px] font-medium px-2 py-1 rounded-full bg-black/55 text-white">
                        Make cover
                      </button>
                    )}
                  </div>
                ))}
                {Array.from({ length: uploadingCount }).map((_, i) => (
                  <div key={`up-${i}`} className="rounded-2xl aspect-square bg-card grid place-items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ))}
                {draft.images.length + uploadingCount < MAX_PHOTOS && (
                  <label className="rounded-2xl border-2 border-dashed border-foreground/20 bg-card/50 aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/60 hover:bg-card transition">
                    <ImagePlus strokeWidth={1.5} className="h-7 w-7 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-medium">{draft.images.length ? "Add another" : "Add photos"}</span>
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={handleImages} />
                  </label>
                )}
              </div>

              <VideoUploader vendorId={userId} videoUrl={draft.videoUrl} onVideoChange={(v: string | null) => update({ videoUrl: v })} />

              {/* Only shown while AI help is on and under budget. Once it isn't, the seller just fills the details in. */}
              {aiAvailable && draft.images.length > 0 && uploadingCount === 0 && (
                <button type="button" onClick={() => runAi("all")} disabled={aiBusy}
                  className="w-full flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-left transition hover:bg-primary/10 disabled:opacity-80 active:scale-[0.99]">
                  <span className="h-10 w-10 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                    {aiBusy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} strokeWidth={1.75} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{aiBusy ? "Looking at your photos…" : "Fill in the details for me"}</span>
                    <span className="block text-xs text-muted-foreground">AI reads your photos and suggests the type, name and description. You check it before you publish.</span>
                  </span>
                </button>
              )}

              <button
                onClick={() => update({ step: 2 })}
                disabled={!draft.images.length || uploadingCount > 0}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors active:scale-[0.98]"
              >
                {uploadingCount > 0 ? "Uploading…" : draft.images.length ? "Continue" : "Add at least one photo"}
                {draft.images.length > 0 && uploadingCount === 0 && <ChevronRight size={16} strokeWidth={2} />}
              </button>
            </div>
          )}

          {/* ── STEP 2: Category + type ── */}
          {draft.step === 2 && (
            <div className="space-y-5">
              <h2 className="font-sans text-base font-semibold tracking-normal">What are you selling?</h2>
              <div className="grid grid-cols-3 gap-2.5">
                {ALL_CATEGORIES.map((cat) => {
                  const meta = CAT_META[cat.key];
                  const Icon = meta?.icon ?? ShoppingBag;
                  const isSelected = draft.category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => update({ category: cat.key, subcategory: "" })}
                      aria-pressed={isSelected}
                      className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl h-20 w-full transition active:scale-95 ${isSelected ? "ring-2 ring-foreground ring-offset-2 ring-offset-sunken" : "hover:opacity-90"}`}
                      style={{ background: meta ? `linear-gradient(135deg, ${meta.from}, ${meta.to})` : "linear-gradient(135deg,#94a3b8,#64748b)" }}
                    >
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                      <span className="text-[11px] font-semibold text-white text-center leading-tight px-1 drop-shadow-sm">{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {selectedCat && (
                <div className="animate-fade-in">
                  <p className="text-sm font-medium mb-2.5">Type <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex flex-wrap gap-2">
                    {[...selectedCat.subcategories, { key: "", name: "Other / General" }].map((sub) => (
                      <button
                        key={sub.key || "general"}
                        onClick={() => update({ subcategory: sub.key })}
                        aria-pressed={draft.subcategory === sub.key}
                        className={`px-4 h-10 rounded-full text-sm font-medium border transition ${draft.subcategory === sub.key ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:border-foreground/40"}`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => update({ step: 3 })}
                disabled={!draft.category}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors active:scale-[0.98]"
              >
                {draft.category ? <>Continue <ChevronRight size={16} strokeWidth={2} /></> : "Pick a category"}
              </button>
            </div>
          )}

          {/* ── STEP 3: Details ── */}
          {draft.step === 3 && (
            <div className="space-y-4">
              {aiFilled.length > 0 && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm space-y-1 animate-fade-in">
                  <p className="font-semibold flex items-center gap-2"><Sparkles size={15} className="text-primary" aria-hidden="true" /> AI filled in the {aiFilled.slice(0, 4).join(", ")} from your photos</p>
                  <p className="text-muted-foreground">
                    It can get things wrong, so read each one before you publish.
                    {aiUnsure.length > 0 && <> It wasn't sure about the <strong className="font-semibold text-foreground">{aiUnsure.join(", ")}</strong>, so check that most.</>}
                    {" "}Add the price and how many you have.
                  </p>
                </div>
              )}

              <div className="rounded-2xl bg-card p-4 sm:p-5 shadow-card space-y-4">
                <p className="text-sm font-semibold">The essentials</p>
                <Field label="Item name" ai={aiFilled.includes("name")}>
                  <TextInput value={draft.name} onChange={(v) => { own("name"); update({ name: v }); }} placeholder={`e.g. ${selectedCat?.name ?? "Item"} in black, size 42`} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price (KES)">
                    <TextInput value={draft.price} onChange={(v) => update({ price: v.replace(/[^\d]/g, "") })} placeholder="e.g. 3500" />
                    {priceNum > MAX_PRICE && <p className="text-xs text-destructive font-medium mt-1">The maximum price is KES 300,000.</p>}
                  </Field>
                  <Field label="In stock">
                    <TextInput value={draft.stock} onChange={(v) => update({ stock: v.replace(/[^\d]/g, "") })} placeholder="1" />
                  </Field>
                </div>
                <PricingCalculator price={parseFloat(draft.price)} />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Condition</p>
                  <div className="flex gap-2">
                    {conditions.map((c) => (
                      <button key={c.value} type="button" onClick={() => update({ condition: c.value })} aria-pressed={draft.condition === c.value}
                        className={`flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-semibold transition ${draft.condition === c.value ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40"}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-card p-4 sm:p-5 shadow-card space-y-4">
                <div>
                  <p className="text-sm font-semibold">Make it stronger</p>
                  <p className="text-xs text-muted-foreground">Optional. Each one raises your listing strength.</p>
                </div>
                <Field label="Description" ai={aiFilled.includes("description")}
                  action={aiAvailable && draft.images.length > 0 ? (
                    <button type="button" onClick={() => runAi("description")} disabled={aiBusy}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60">
                      {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      {draft.description.trim() ? "Rewrite with AI" : "Write with AI"}
                    </button>
                  ) : undefined}>
                  <textarea value={draft.description} onChange={(e) => { own("description"); update({ description: e.target.value }); }} rows={3}
                    placeholder="Fit, flaws, what's included. Honest details mean fewer returns."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition resize-none" />
                </Field>
                {showBrandField && (
                  <Field label="Brand" ai={aiFilled.includes("brand")}>
                    <TextInput value={draft.brand} onChange={(v) => { own("brand"); update({ brand: v }); }} placeholder="e.g. Nike, Samsung, Zara" />
                  </Field>
                )}
                {specFields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    {f.type === "select" && f.options
                      ? <SelectInput value={draft.specs[f.key] || ""} onChange={(v) => update((d) => ({ specs: { ...d.specs, [f.key]: v } }))} options={f.options} />
                      : <TextInput value={draft.specs[f.key] || ""} onChange={(v) => update((d) => ({ specs: { ...d.specs, [f.key]: v } }))} placeholder={f.placeholder || ""} />}
                  </Field>
                ))}
                {draft.condition !== "new" && (
                  <Field label="Wear or marks">
                    <textarea value={draft.conditionNotes} onChange={(e) => update({ conditionNotes: e.target.value })} rows={2}
                      placeholder="e.g. Light creasing on the toe, no stains"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition resize-none" />
                  </Field>
                )}
                <Field label="Key features (comma-separated)" ai={aiFilled.includes("features")}>
                  <TextInput value={draft.keyFeatures} onChange={(v) => { own("features"); update({ keyFeatures: v }); }} placeholder="e.g. Waterproof, padded collar, original box" />
                </Field>
                <label className="flex items-start gap-3 cursor-pointer rounded-xl bg-sunken p-3.5">
                  <input type="checkbox" checked={draft.freeDelivery} onChange={(e) => update({ freeDelivery: e.target.checked })} className="mt-0.5 h-4 w-4 rounded" />
                  <span className="text-sm">
                    <span className="font-medium">I'll cover delivery</span>
                    <span className="block text-xs text-muted-foreground">Shows a "Free delivery" label on the listing.</span>
                  </span>
                </label>
              </div>
            </div>
          )}
          </div>

          {/* Sticky publish bar on the details step */}
          {draft.step === 3 && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pl-4 pr-[5.5rem] sm:pr-4 py-3 lg:pl-64">
              {/* Right padding on phones keeps Publish clear of the floating chat button */}
              <div className="max-w-xl mx-auto flex flex-nowrap items-center gap-3">
                <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {canPublish ? "Ready to publish. You can edit it any time." : !draft.name.trim() ? "Add a name to publish" : !priceOk ? "Add a price to publish" : !stockOk ? "Add how many you have" : "Finish the essentials to publish"}
                </div>
                <button onClick={handleSubmit} disabled={!canPublish || submitting}
                  className="shrink-0 inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors active:scale-[0.98]">
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Publishing…</> : <><Upload size={16} strokeWidth={2} /> Publish</>}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Waits for auth, then mounts the form keyed to the signed-in seller so their
// draft is read under the right key from the very first render.
const VendorListItemPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);
  if (loading || !user) return <FormSkeleton fields={6} />;
  return <VendorListItem key={user.id} userId={user.id} />;
};

export default VendorListItemPage;
