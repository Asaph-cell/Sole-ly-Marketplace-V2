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

// ── Condition options by category group ─────────────────────────────────────
const CONDITIONS_GENERAL = [
  { value: "new",      label: "Brand New",    desc: "Sealed / never used",           dot: "bg-emerald-500" },
  { value: "like_new", label: "Like New",     desc: "Used once or twice, no wear",   dot: "bg-blue-500" },
  { value: "good",     label: "Good",         desc: "Light use, minor wear",         dot: "bg-amber-400" },
  { value: "fair",     label: "Fair",         desc: "Visible wear, fully functional",dot: "bg-orange-500" },
  { value: "thrifted", label: "Thrifted",     desc: "Pre-owned, honestly described", dot: "bg-purple-500" },
];
const CONDITIONS_ELECTRONICS = [
  { value: "new",         label: "Brand New",    desc: "Sealed in box",                   dot: "bg-emerald-500" },
  { value: "refurbished", label: "Refurbished",  desc: "Tested & restored to full working",dot: "bg-blue-500" },
  { value: "good",        label: "Good",         desc: "Light use, no damage",            dot: "bg-amber-400" },
  { value: "fair",        label: "Fair",         desc: "Works perfectly, visible wear",   dot: "bg-orange-500" },
];

// ── Dynamic spec fields by category ─────────────────────────────────────────
type SpecField = { key: string; label: string; type: "text"|"select"|"multi"; options?: string[] };

const SPEC_FIELDS: Record<string, SpecField[]> = {
  shoes: [
    { key:"gender",    label:"Gender",    type:"select",  options:["Men","Women","Kids","Unisex"] },
    { key:"sizes",     label:"Sizes (EU, comma-sep)", type:"text" },
    { key:"colors",    label:"Colors (comma-sep)",    type:"text" },
  ],
  "womens-fashion": [
    { key:"size",      label:"Size",      type:"select",  options:["XS","S","M","L","XL","XXL","One Size"] },
    { key:"colors",    label:"Colors (comma-sep)",    type:"text" },
    { key:"material",  label:"Material",  type:"text" },
  ],
  "mens-fashion": [
    { key:"size",      label:"Size",      type:"select",  options:["XS","S","M","L","XL","XXL","One Size"] },
    { key:"colors",    label:"Colors (comma-sep)",    type:"text" },
    { key:"material",  label:"Material",  type:"text" },
  ],
  kids: [
    { key:"age_range", label:"Age Range", type:"select",  options:["0-12m","1-2yr","3-5yr","6-9yr","10-12yr","13+yr"] },
    { key:"size",      label:"Size / EU Shoe", type:"text" },
    { key:"gender",    label:"Gender",    type:"select",  options:["Boys","Girls","Unisex"] },
  ],
  beauty: [
    { key:"volume",    label:"Size / Volume (ml or g)", type:"text" },
    { key:"authentic", label:"Authenticity", type:"select", options:["100% Authentic","Inspired / Dupe"] },
  ],
  bags: [
    { key:"material",  label:"Material",  type:"select",  options:["Leather","Faux Leather","Canvas","Fabric","Other"] },
    { key:"colors",    label:"Colors (comma-sep)",    type:"text" },
  ],
  sports: [
    { key:"size",      label:"Size / Weight", type:"text" },
    { key:"sport",     label:"Sport / Use",   type:"text" },
  ],
  home: [
    { key:"material",  label:"Material",  type:"text" },
    { key:"dimensions",label:"Dimensions (optional)", type:"text" },
  ],
  // Electronics subcategories
  phones: [
    { key:"brand",     label:"Brand",     type:"text" },
    { key:"model",     label:"Model",     type:"text" },
    { key:"year",      label:"Year",      type:"select", options:["2025","2024","2023","2022","2021","2020","2019","Older"] },
    { key:"storage",   label:"Storage",   type:"select", options:["16GB","32GB","64GB","128GB","256GB","512GB","1TB"] },
    { key:"ram",       label:"RAM",       type:"select", options:["2GB","3GB","4GB","6GB","8GB","12GB","16GB"] },
    { key:"colors",    label:"Color",     type:"text" },
    { key:"accessories",label:"Accessories included", type:"text" },
  ],
  laptops: [
    { key:"brand",     label:"Brand",     type:"text" },
    { key:"model",     label:"Model",     type:"text" },
    { key:"year",      label:"Year",      type:"select", options:["2025","2024","2023","2022","2021","2020","Older"] },
    { key:"processor", label:"Processor", type:"text" },
    { key:"ram",       label:"RAM",       type:"select", options:["4GB","8GB","16GB","32GB","64GB"] },
    { key:"storage",   label:"Storage",   type:"select", options:["128GB","256GB","512GB","1TB","2TB"] },
    { key:"screen",    label:"Screen Size", type:"select", options:["11\"","13\"","14\"","15.6\"","16\"","17\""] },
  ],
  audio: [
    { key:"brand",     label:"Brand",     type:"text" },
    { key:"model",     label:"Model",     type:"text" },
    { key:"connectivity", label:"Connectivity", type:"select", options:["Wired","Wireless","Both"] },
  ],
  cameras: [
    { key:"brand",     label:"Brand",     type:"text" },
    { key:"model",     label:"Model",     type:"text" },
    { key:"megapixels",label:"Megapixels (optional)", type:"text" },
    { key:"accessories",label:"Accessories included", type:"text" },
  ],
  gaming: [
    { key:"platform",  label:"Platform",  type:"select", options:["PlayStation 5","PlayStation 4","Xbox Series","Xbox One","Nintendo Switch","PC","Other"] },
    { key:"type",      label:"Type",      type:"select", options:["Console","Game / Title","Controller","Accessory"] },
  ],
  smartwatches: [
    { key:"brand",     label:"Brand",     type:"text" },
    { key:"model",     label:"Model",     type:"text" },
    { key:"compatibility", label:"Compatible With", type:"select", options:["iOS","Android","Both"] },
  ],
  "phone-accessories": [
    { key:"compatible_with", label:"Compatible With", type:"text" },
    { key:"colors",    label:"Color", type:"text" },
  ],
};

const getSpecFields = (category: string, subcategory: string): SpecField[] => {
  if (subcategory && SPEC_FIELDS[subcategory]) return SPEC_FIELDS[subcategory];
  if (SPEC_FIELDS[category]) return SPEC_FIELDS[category];
  return [
    { key:"colors", label:"Colors / Variants (optional)", type:"text" },
  ];
};

const isElectronics = (cat: string) => cat === "electronics";

// ── Tiny input/select components ─────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
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
  const [specs, setSpecs] = useState<Record<string, string>>({});

  // Images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  const selectedCat = ALL_CATEGORIES.find(c => c.key === category);
  const specFields = category ? getSpecFields(category, subcategory) : [];
  const conditions = isElectronics(category) ? CONDITIONS_ELECTRONICS : CONDITIONS_GENERAL;

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
    if (step === 3) return !!name && !!price && parseInt(price) > 0 && !!stock;
    return true;
  };

  const handleSubmit = async () => {
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
      const sizesArr = (specs.sizes || specs.size || "").split(",").map(s => s.trim()).filter(Boolean);
      const colorsArr = (specs.colors || "").split(",").map(s => s.trim()).filter(Boolean);

      // Build clean specs object (exclude sizes/colors already stored separately)
      const cleanSpecs: Record<string, string> = {};
      Object.entries(specs).forEach(([k, v]) => {
        if (v && k !== "sizes" && k !== "colors") cleanSpecs[k] = v;
      });

      const { data: inserted, error: insertErr } = await supabase.from("products").insert({
        vendor_id: user?.id,
        name, description,
        price_ksh: parseInt(price),
        stock: parseInt(stock),
        brand: brand || null,
        category, subcategory: subcategory || null,
        condition, condition_notes: conditionNotes || null,
        sizes: sizesArr, colors: colorsArr,
        specs: cleanSpecs,
        images: imageUrls,
        status: "draft",
      }).select("id").single();

      if (insertErr) throw insertErr;

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
              <ChevronLeft className="h-4 w-4" />
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
                Continue <ChevronRight className="h-4 w-4" />
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
                </Field>
                <Field label="Stock *">
                  <TextInput value={stock} onChange={setStock} placeholder="1" />
                </Field>
              </div>

              <Field label="Brand (optional)">
                <TextInput value={brand} onChange={setBrand} placeholder="e.g. Nike, Samsung, Zara…" />
              </Field>

              {/* Dynamic spec fields */}
              {specFields.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item Specifics</p>
                  {specFields.map(f => (
                    <Field key={f.key} label={f.label}>
                      {f.type === "select" && f.options
                        ? <SelectInput value={specs[f.key] || ""} onChange={v => setSpec(f.key, v)} options={f.options} />
                        : <TextInput value={specs[f.key] || ""} onChange={v => setSpec(f.key, v)} />
                      }
                    </Field>
                  ))}
                </div>
              )}

              {/* Condition */}
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Condition *</p>
                <div className="space-y-2">
                  {conditions.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCondition(c.value)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        condition === c.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${c.dot}`} />
                      <div>
                        <p className="text-sm font-semibold">{c.label}</p>
                        <p className="text-xs text-muted-foreground">{c.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {condition !== "new" && (
                  <Field label="Condition notes (optional)">
                    <textarea
                      value={conditionNotes}
                      onChange={e => setConditionNotes(e.target.value)}
                      placeholder="Describe any wear, scratches or defects. Honesty builds trust."
                      rows={2}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 resize-none transition-all"
                    />
                  </Field>
                )}
              </div>

              <button
                onClick={() => { if (canNext()) setStep(4); else toast.error("Fill in all required fields"); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Continue to Photos <ChevronRight className="h-4 w-4" />
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
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Cover</span>
                    )}
                  </div>
                ))}
                {imagePreviews.length < 4 && (
                  <label className="rounded-2xl border-2 border-dashed border-border aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all">
                    <ImagePlus className="h-7 w-7 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Add Photo</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImages} />
                  </label>
                )}
              </div>

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
                  <><Upload className="h-4 w-4" /> Publish Listing</>
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
