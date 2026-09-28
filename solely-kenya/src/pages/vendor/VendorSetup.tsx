import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Check, Clock, ImagePlus, Loader2, Pencil, ShieldCheck, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { FormSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProgressRing } from "@/components/vendor/StoreSetupCard";
import { getStoreSetup, SetupItem, SetupProfile } from "@/lib/storeSetup";
import { compressImages } from "@/lib/compressImage";
import { toast } from "@/lib/toast";

type Profile = SetupProfile & { vendor_address_line2?: string | null; store_phone?: string | null };

const DOC_TYPES = [
  { value: "national_id", label: "National ID", hint: "Front of your ID, all four corners visible" },
  { value: "business_registration", label: "Business registration", hint: "Your certificate of registration" },
] as const;

const Checklist = ({ items }: { items: SetupItem[] }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
    {items.map((i) => (
      <li key={i.key} className={`inline-flex items-center gap-1.5 ${i.done ? "text-foreground" : "text-muted-foreground"}`}>
        <span className={`grid place-items-center w-4 h-4 rounded-full ${i.done ? "bg-primary text-primary-foreground" : "ring-1 ring-foreground/25"}`}>
          {i.done && <Check size={10} strokeWidth={3} />}
        </span>
        {i.label}
      </li>
    ))}
  </ul>
);

const LevelCard = ({ level, title, unlock, done, children }: {
  level: number; title: string; unlock: string; done: boolean; children: React.ReactNode;
}) => (
  <section className="rounded-3xl bg-card shadow-card p-5 sm:p-7">
    <div className="flex flex-nowrap items-start gap-4">
      <span className={`grid place-items-center w-9 h-9 shrink-0 rounded-full font-display text-lg ${done ? "bg-primary text-primary-foreground" : "bg-sunken text-foreground"}`}>
        {done ? <Check size={16} strokeWidth={2.5} /> : level}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{unlock}</p>
      </div>
    </div>
    <div className="mt-5">{children}</div>
  </section>
);

const VendorSetup = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    store_description: "", vendor_city: "", vendor_county: "", vendor_address_line1: "", vendor_address_line2: "", store_phone: "",
  });
  // A finished profile opens read-only with an Edit button; saving locks it again.
  const [profileLocked, setProfileLocked] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]["value"]>("national_id");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [submittingDoc, setSubmittingDoc] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/auth?redirect=/vendor/setup"); }, [user, loading, navigate]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!data) return;
    setProfile(data as Profile);
    setForm({
      store_description: data.store_description ?? "",
      vendor_city: data.vendor_city ?? "",
      vendor_county: data.vendor_county ?? "",
      vendor_address_line1: data.vendor_address_line1 ?? "",
      vendor_address_line2: (data as Profile).vendor_address_line2 ?? "",
      store_phone: (data as Profile).store_phone ?? "",
    });
    setProfileLocked(getStoreSetup(data as Profile).level2Done);
  };
  useEffect(() => { void load(); }, [user]);

  if (loading || !profile) return <FormSkeleton fields={6} />;

  const setup = getStoreSetup(profile);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const [small] = await compressImages([file]);
      const path = `${user.id}-${Date.now()}.${small.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from("store-logos").upload(path, small);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("store-logos").getPublicUrl(path);
      const { error: saveErr } = await supabase.from("profiles").update({ store_logo_url: publicUrl }).eq("id", user.id);
      if (saveErr) throw saveErr;
      setProfile((p) => ({ ...p!, store_logo_url: publicUrl }));
      toast.success("Logo saved");
    } catch (err: any) {
      toast.error(err);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const clean: Record<string, string | null> = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
      if (clean.store_phone) {
        const digits = clean.store_phone.replace(/\D/g, "");
        if (digits.length < 9 || digits.length > 15) {
          toast.error("Enter a valid phone number, e.g. 0712 345 678");
          setSavingProfile(false);
          return;
        }
        clean.store_phone = digits;
      }
      const { error } = await supabase.from("profiles").update(clean).eq("id", user.id);
      if (error) throw error;
      setProfile((p) => ({ ...p!, ...clean }));
      setForm((f) => ({ ...f, store_phone: clean.store_phone ?? "" }));
      setProfileLocked(true);
      toast.success("Store profile saved");
    } catch (err: any) {
      toast.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const pickDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("That photo is over 8 MB. Try a smaller one."); return; }
    setDocFile(file);
    setDocPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  };

  const submitDoc = async () => {
    if (!docFile || !user) return;
    setSubmittingDoc(true);
    try {
      const upload = docFile.type.startsWith("image/") ? (await compressImages([docFile]))[0] : docFile;
      const path = `${user.id}/${Date.now()}.${upload.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from("vendor-verification").upload(path, upload);
      if (error) throw error;
      const { error: rpcErr } = await (supabase as any).rpc("submit_vendor_verification", {
        document_path: path, document_type: docType,
      });
      if (rpcErr) throw rpcErr;
      setProfile((p) => ({ ...p!, kyc_status: "pending", kyc_reject_reason: null }));
      setDocFile(null); setDocPreview(null);
      toast.success("Sent for review");
    } catch (err: any) {
      toast.error(err);
    } finally {
      setSubmittingDoc(false);
    }
  };

  const profileDirty =
    form.store_description !== (profile.store_description ?? "") ||
    form.vendor_city !== (profile.vendor_city ?? "") ||
    form.vendor_county !== (profile.vendor_county ?? "") ||
    form.vendor_address_line1 !== (profile.vendor_address_line1 ?? "") ||
    form.vendor_address_line2 !== (profile.vendor_address_line2 ?? "") ||
    form.store_phone !== (profile.store_phone ?? "");

  const cancelEdit = () => {
    setForm({
      store_description: profile.store_description ?? "",
      vendor_city: profile.vendor_city ?? "",
      vendor_county: profile.vendor_county ?? "",
      vendor_address_line1: profile.vendor_address_line1 ?? "",
      vendor_address_line2: profile.vendor_address_line2 ?? "",
      store_phone: profile.store_phone ?? "",
    });
    setProfileLocked(true);
  };

  return (
    <div data-layout="designed" className="min-h-screen bg-sunken">
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4">
            <Link to="/vendor/dashboard" className="inline-flex items-center gap-1.5 py-2 -my-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft size={16} /> Dashboard
            </Link>

            {/* Overall meter */}
            <div className="flex flex-nowrap items-center gap-5 pb-2">
              <ProgressRing percent={setup.percent} size={76} />
              <div className="min-w-0">
                <h1 className="font-display text-3xl sm:text-4xl leading-tight">Set up your store</h1>
                <p className="mt-1 text-muted-foreground">
                  You can already list and sell. Each step here helps buyers trust you, and you can stop any time.
                </p>
              </div>
            </div>

            <LevelCard level={1} title="Start selling" unlock="Done. You can list items, take orders and withdraw." done>
              <Checklist items={setup.level1} />
            </LevelCard>

            <LevelCard
              level={2}
              title="Store profile"
              unlock="Unlocks your listing in the Stores directory."
              done={setup.level2Done}
            >
              <Checklist items={setup.level2} />
              {/* Locked fields stay fully legible (no faded "disabled" look) */}
              <div className="mt-6 space-y-5 [&_input:disabled]:opacity-100 [&_textarea:disabled]:opacity-100 [&_input:disabled]:cursor-default [&_textarea:disabled]:cursor-default [&_input:disabled]:bg-sunken/60 [&_textarea:disabled]:bg-sunken/60">
                <div className="flex flex-nowrap items-center gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-sunken grid place-items-center">
                    {profile.store_logo_url
                      ? <img src={profile.store_logo_url} alt="Store logo" className="h-full w-full object-cover" />
                      : <ImagePlus size={22} className="text-foreground/40" />}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 h-11 text-sm font-medium hover:bg-sunken transition-colors">
                    {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {profile.store_logo_url ? "Change logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="sr-only" onChange={uploadLogo} disabled={uploadingLogo} />
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store_description">Short description</Label>
                  <Textarea id="store_description" rows={3} value={form.store_description} onChange={set("store_description")} disabled={profileLocked}
                    placeholder="e.g. Original sneakers and thrifted streetwear in Nairobi CBD." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="vendor_city">City</Label>
                    <Input id="vendor_city" value={form.vendor_city} onChange={set("vendor_city")} placeholder="e.g. Nairobi" disabled={profileLocked} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor_county">County</Label>
                    <Input id="vendor_county" value={form.vendor_county} onChange={set("vendor_county")} placeholder="e.g. Nairobi" disabled={profileLocked} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor_address_line1">Pickup address</Label>
                  <Input id="vendor_address_line1" value={form.vendor_address_line1} onChange={set("vendor_address_line1")} placeholder="e.g. Moi Avenue" disabled={profileLocked} />
                  <Input value={form.vendor_address_line2} onChange={set("vendor_address_line2")} placeholder="Building, shop number (optional)" aria-label="Address details" disabled={profileLocked} />
                  <p className="text-xs text-muted-foreground">Only shown to buyers who choose pickup.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store_phone">Store phone number <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="store_phone" type="tel" inputMode="tel" value={form.store_phone} onChange={set("store_phone")} placeholder="e.g. 0712 345 678" disabled={profileLocked} />
                  <p className="text-xs text-muted-foreground">Shown on your store page with a call button, so shoppers can reach you before they buy.</p>
                </div>
                {profileLocked ? (
                  <Button variant="outline" onClick={() => setProfileLocked(false)} className="h-11 rounded-full px-6 border-foreground/30 active:scale-[0.97]">
                    <Pencil size={16} className="mr-2" /> Edit profile
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={saveProfile} disabled={savingProfile || !profileDirty} className="h-11 rounded-full px-6 active:scale-[0.97]">
                      {savingProfile && <Loader2 size={16} className="mr-2 animate-spin" />}
                      Save profile
                    </Button>
                    {setup.level2Done && (
                      <button type="button" onClick={cancelEdit} className="h-11 px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            </LevelCard>

            <LevelCard
              level={3}
              title="Get verified"
              unlock="Optional. Earns the Verified seller badge on your store and listings."
              done={setup.verification === "approved"}
            >
              {setup.verification === "approved" ? (
                <p className="inline-flex items-center gap-2 font-medium"><BadgeCheck size={18} className="text-[hsl(40_62%_33%)]" /> You're a verified seller.</p>
              ) : setup.verification === "pending" ? (
                <p className="inline-flex items-center gap-2 text-muted-foreground"><Clock size={16} /> In review. We'll let you know once it's checked.</p>
              ) : (
                <div className="space-y-5">
                  {setup.verification === "rejected" && setup.rejectReason && (
                    <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-foreground">
                      <p className="font-medium">We couldn't verify the last document</p>
                      <p className="mt-0.5 text-muted-foreground">{setup.rejectReason}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Document type">
                    {DOC_TYPES.map((t) => (
                      <button key={t.value} type="button" role="radio" aria-checked={docType === t.value}
                        onClick={() => setDocType(t.value)}
                        className={`rounded-2xl border p-3.5 text-left transition-colors ${docType === t.value ? "border-foreground bg-sunken" : "border-border hover:bg-sunken"}`}>
                        <span className="block text-sm font-semibold">{t.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{t.hint}</span>
                      </button>
                    ))}
                  </div>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-center hover:bg-sunken transition-colors">
                    {docPreview
                      ? <img src={docPreview} alt="Selected document" className="max-h-40 rounded-xl object-contain" />
                      : docFile ? <span className="text-sm font-medium">{docFile.name}</span>
                      : <><ImagePlus size={24} className="text-foreground/40" /><span className="text-sm font-medium">Add a photo</span></>}
                    <span className="text-xs text-muted-foreground">Only the Solely team can see this. It's never shown to buyers.</span>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={pickDoc} />
                  </label>
                  <Button onClick={submitDoc} disabled={!docFile || submittingDoc} className="h-11 rounded-full px-6 active:scale-[0.97]">
                    {submittingDoc ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ShieldCheck size={16} className="mr-2" />}
                    Send for review
                  </Button>
                </div>
              )}
            </LevelCard>
          </div>
        </main>
      </div>
    </div>
  );
};

export default VendorSetup;
