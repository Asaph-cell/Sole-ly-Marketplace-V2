import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { compressImages } from "@/lib/compressImage";
import { ALL_CATEGORIES } from "@/lib/categories";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Upload, X, ImagePlus,
  Footprints, Shirt, Baby, Sparkles, ShoppingBag,
  Dumbbell, Smartphone, Home, LucideIcon
} from "lucide-react";

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

// ── Condition options — simple 2-choice per group ────────────────────────────
const CONDITIONS_GENERAL = [
  { value: "new",      label: "New",       dot: "bg-emerald-500" },
  { value: "thrifted", label: "Thrifted",  dot: "bg-purple-500" },
];
const CONDITIONS_ELECTRONICS = [
  { value: "new",         label: "Brand New",   dot: "bg-emerald-500" },
  { value: "refurbished", label: "Refurbished",  dot: "bg-blue-500" },
];

// All electronics sub-category keys
const ELEC_SUBS = new Set(["phones","laptops","audio","phone-accessories","gaming","cameras","smartwatches"]);
const isElectronics = (cat: string, sub: string) => cat === "electronics" || ELEC_SUBS.has(sub);

// ── Spec fields — one entry per category / subcategory ───────────────────────
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
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">{label}</label>
    {children}
  </div>
);

const TextInput = ({ value, onChange, placeholder = "" }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
  />
);

const SelectInput = ({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 transition-all appearance-none"
  >
    <option value="">{placeholder || "Select…"}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

// ── Main component ─────────────────────────────────────────────────────────────
const VendorListItem = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1|2|3|4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Core fields
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState("new");
  const [conditionNotes, setConditionNotes] = useState("");
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [keyFeatures, setKeyFeatures] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [specs, setSpecs] = useState<Record<string, string>>({});

  // Images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  const selectedCat = ALL_CATEGORIES.find(c => c.key === category);
  const specFields  = category ? getSpecFields(category, subcategory) : [];
  const isElec      = isElectronics(category, subcategory);
  const conditions  = isElec ? CONDITIONS_ELECTRONICS : CONDITIONS_GENERAL;
  // For electronics the spec fields include Brand/Model — hide the top-level brand input
  const showBrandField = !isElec;

  const setSpec = (key: string, val: string) => setSpecs(prev => ({ ...prev, [key]: val }));


  const handleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 4) { toast.error("Max 4 images"); return; }
    try {
      const compressed = await compressImages(files);
      setImageFiles(prev => [...prev, ...compressed]);
      setImagePreviews(prev => [...prev, ...compressed.map(f => URL.createObjectURL(f))]);
    } catch { toast.error("Failed to process images"); }
  };

  const removeImage = (i: number) => {
    setImageFiles(prev => prev.filter((_, idx) => idx !== i));
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const canNext = () => {
    if (step === 1) return !!category;
    if (step === 2) return true;
    if (step === 3) return !!name && !!price && parseInt(price) > 0 && parseInt(price) <= 300000 && !!stock;
    return true;
  };

  const handleSubmit = async () => {
    if (parseInt(price) > 300000) { toast.error("Price cannot exceed KES 300,000."); return; }
    if (imageFiles.length === 0) { toast.error("Please add at least one image"); return; }
    setSubmitting(true);
    try {
      setUploading(true);
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const ext = file.name.split(".").pop();
        const path = `${user?.id}/${Date.now()}-${Math.random()}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrls.push(publicUrl);
      }
      setUploading(false);

      // Build sizes / colors arrays from specs for backward compat
      const variantRaw = specs.sizes || specs.size || specs.storage || specs.volume || specs.capacity || specs.waist || "";
      const sizesArr = variantRaw.split(",").map(s => s.trim()).filter(Boolean);
      const colorsArr = (specs.colors || "").split(",").map(s => s.trim()).filter(Boolean);

      // Build clean specs object (exclude sizes/colors already stored separately)
      const cleanSpecs: Record<string, string> = {};
      Object.entries(specs).forEach(([k, v]) => {
        if (v && k !== "sizes" && k !== "colors") cleanSpecs[k] = v;
      });

      // Sanitise condition — map form values to DB-allowed values
      // DB constraint: new | like_new | good | fair
      const conditionMap: Record<string, string> = {
        thrifted:    "good",
        refurbished: "like_new",
      };
      const safeCondition = conditionMap[condition] ?? condition;

      // For electronics brand comes from spec fields, not the top-level brand input
      const effectiveBrand = isElec ? (specs.brand || brand || null) : (brand || null);

      // Core insert — only original schema columns that are guaranteed to exist
      const { data: inserted, error: insertErr } = await supabase.from("products").insert({
        vendor_id: user?.id,
        name,
        description,
        price_ksh: parseInt(price),
        stock: parseInt(stock),
        brand: effectiveBrand,
        category,
        condition: safeCondition,
        sizes: sizesArr,
        colors: colorsArr,
        images: imageUrls,
        status: "draft",
      }).select("id").single();


      if (insertErr) throw insertErr;

      // Save newer columns separately — silently skipped if schema cache not yet refreshed
      // This means listing ALWAYS succeeds; these fields save once cache is reloaded
      try {
        const extras: Record<string, any> = {};
        if (subcategory) extras.subcategory = subcategory;
        if (conditionNotes) extras.condition_notes = conditionNotes;
        if (freeDelivery) extras.free_delivery = freeDelivery;
        if (keyFeatures) extras.key_features = keyFeatures.split(",").map(s => s.trim()).filter(Boolean);
        if (videoUrl) extras.video_url = videoUrl;
        if (Object.keys(cleanSpecs).length > 0) extras.specs = cleanSpecs;
        if (Object.keys(extras).length > 0) {
          await supabase.from("products").update(extras).eq("id", inserted.id);
        }
      } catch {
        // Schema cache not yet refreshed — go to Supabase Dashboard → Settings → API → Reload Schema Cache
      }

      await supabase.rpc("publish_product", { product_id_to_publish: inserted.id });
      toast.success("Item listed! It's now live 🎉");
      navigate("/vendor/products");
    } catch (e: any) {
      toast.error(e.message || "Failed to list item");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">Loading…</div>;

  // ── Step indicators ──────────────────────────────────────────────────────
  const steps = ["Category", "Type", "Details", "Photos"];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-xl mx-auto px-4 sm:px-6 py-6">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => step === 1 ? navigate("/vendor/products") : setStep(s => (s - 1) as any)}
              className="h-8 w-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground transition-colors"
            >
              <ChevronLeft size={16} strokeWidth={1.5}  />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">List an Item</h1>
              <p className="text-xs text-muted-foreground">Step {step} of 4 — {steps[step - 1]}</p>
            </div>
          </div>

          {/* Step progress bar */}
          <div className="flex gap-1 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>

          {/* ── STEP 1: Category picker ── */}
          {step === 1 && (
            <div>
              <h2 className="text-base font-semibold mb-4">What are you selling?</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {ALL_CATEGORIES.map(cat => {
                  const meta = CAT_META[cat.key];
                  const Icon = meta?.icon ?? ShoppingBag;
                  const isSelected = category === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => { setCategory(cat.key); setSubcategory(""); setStep(2); }}
                      className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl h-20 w-full transition-all active:scale-95 ${
                        isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:opacity-90"
                      }`}
                      style={{
                        background: meta
                          ? `linear-gradient(135deg, ${meta.from}, ${meta.to})`
                          : "linear-gradient(135deg,#94a3b8,#64748b)",
                      }}
                    >
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
                      <span className="text-[10px] font-bold text-white text-center leading-tight px-1 drop-shadow-sm">
                        {cat.name}
                      </span>
                      {cat.kycRequired && (
                        <span className="absolute top-1.5 right-1.5 text-[8px] font-black px-1 py-0.5 rounded-full bg-white/30 text-white">KYC</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── STEP 2: Subcategory ── */}
          {step === 2 && selectedCat && (() => {
            const meta = CAT_META[selectedCat.key];
            const Icon = meta?.icon ?? ShoppingBag;
            return (
            <div>
              <div className="flex items-center gap-3 mb-5 p-4 rounded-2xl" style={{ background: meta ? `linear-gradient(135deg,${meta.from},${meta.to})` : undefined }}>
                <Icon className="h-6 w-6 text-white shrink-0" strokeWidth={1.5} />
                <h2 className="text-base font-bold text-white">{selectedCat.name}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCat.subcategories.map(sub => (
                  <button
                    key={sub.key}
                    onClick={() => setSubcategory(sub.key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                      subcategory === sub.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:border-primary/50"
                    }`}
                  >
                    {sub.name}
                  </button>
                ))}
                <button
                  onClick={() => setSubcategory("")}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    subcategory === "" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/50"
                  }`}
                >
                  Other / General
                </button>
              </div>

              <button
                onClick={() => setStep(3)}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Continue <ChevronRight size={16} strokeWidth={1.5}  />
              </button>
            </div>
            );
          })()}

          {/* ── STEP 3: Details ── */}
          {step === 3 && (
            <div className="space-y-4">
              <Field label="Item Name *">
                <TextInput value={name} onChange={setName} placeholder={`e.g. ${selectedCat?.name} listing`} />
              </Field>

              <Field label="Description *">
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe your item honestly. Good descriptions attract more buyers."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (KES) *">
                  <TextInput value={price} onChange={setPrice} placeholder="e.g. 3500" />
                  {parseInt(price) > 300000 && (
                    <p className="text-xs text-red-500 font-medium mt-1">Maximum allowed price is 300,000.</p>
                  )}
                </Field>
                <Field label="Stock *">
                  <TextInput value={stock} onChange={setStock} placeholder="1" />
                </Field>
              </div>

              {showBrandField && (
                <Field label="Brand (optional)">
                  <TextInput value={brand} onChange={setBrand} placeholder="e.g. Nike, Samsung, Zara…" />
                </Field>
              )}

              {/* Dynamic spec fields */}
              {specFields.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Specifics</p>
                  {specFields.map(f => (
                    <Field key={f.key} label={f.label}>
                      {f.type === "select" && f.options
                        ? <SelectInput value={specs[f.key] || ""} onChange={v => setSpec(f.key, v)} options={f.options} />
                        : <TextInput value={specs[f.key] || ""} onChange={v => setSpec(f.key, v)} placeholder={f.placeholder || ""} />
                      }
                    </Field>
                  ))}
                </div>
              )}

              {/* Condition — 2 clean pill buttons */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condition *</p>
                <div className="flex gap-2">
                  {conditions.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCondition(c.value)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        condition === c.value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {condition !== "new" && (
                <Field label="Condition Details (Optional)">
                  <textarea
                    value={conditionNotes}
                    onChange={e => setConditionNotes(e.target.value)}
                    placeholder="Describe any wear, scuffs, or defects."
                    rows={2}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                  />
                </Field>
              )}

              <Field label="Key Features (comma-separated)">
                <textarea
                  value={keyFeatures}
                  onChange={e => setKeyFeatures(e.target.value)}
                  placeholder="e.g. 5G, 120Hz display, 5000mAh battery"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                />
              </Field>

              <div className="flex flex-col justify-center space-y-2 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="free_delivery"
                    checked={freeDelivery}
                    onChange={(e) => setFreeDelivery(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="free_delivery" className="font-medium text-sm cursor-pointer">Offers Free Delivery</label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Check this if you are covering the delivery cost for the buyer.
                </p>
              </div>

              <button
                onClick={() => { if (canNext()) setStep(4); else toast.error("Fill in all required fields"); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Continue to Photos <ChevronRight size={16} strokeWidth={1.5}  />
              </button>
            </div>
          )}

          {/* ── STEP 4: Images ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold mb-1">Add Photos</h2>
                <p className="text-xs text-muted-foreground">Up to 4 photos. Clear, well-lit shots sell faster.</p>
              </div>

              {/* Image grid */}
              <div className="grid grid-cols-2 gap-3">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative rounded-2xl overflow-hidden aspect-square bg-muted">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                    >
                      <X size={14} strokeWidth={1.5}  />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Cover</span>
                    )}
                  </div>
                ))}
                {imagePreviews.length < 4 && (
                  <label className="rounded-2xl border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all">
                    <ImagePlus strokeWidth={1.5} className="h-7 w-7 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Add Photo</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
                  </label>
                )}
              </div>

              {user && (
                <div className="mt-4">
                  <VideoUploader
                    vendorId={user.id}
                    videoUrl={videoUrl}
                    onVideoChange={setVideoUrl}
                  />
                </div>
              )}

              {/* Summary card */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Listing Summary</p>
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-sm text-primary font-bold">KES {parseInt(price || "0").toLocaleString()}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{selectedCat?.name}</span>
                  {subcategory && <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{subcategory}</span>}
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{condition.replace("_", " ")}</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || uploading || imageFiles.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {uploading ? (
                  <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading…</>
                ) : submitting ? (
                  <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Listing…</>
                ) : (
                  <><Upload size={16} strokeWidth={1.5}  /> Publish Listing</>
                )}
              </button>
            </div>
          )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default VendorListItem;
