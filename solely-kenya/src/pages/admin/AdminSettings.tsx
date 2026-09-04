import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, DollarSign, ToggleLeft, Clock, Save, ShieldCheck, UserPlus, X } from "lucide-react";

type SettingsMap = Record<string, any>;

interface AdminRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface PayoutFeeTier {
  max_ksh?: number;
  fee_ksh: number;
}

const DEFAULT_FEE_SCHEDULE: PayoutFeeTier[] = [
  { max_ksh: 100, fee_ksh: 10 },
  { max_ksh: 1000, fee_ksh: 20 },
  { fee_ksh: 100 },
];

// Every card on this page changes something with real, live consequences
// (money movement, who has admin access, whether the site is up) - a red
// accent throughout is a deliberate, standing "handle with care" cue, not
// an error state. Reuses the same colored-left-border language StatBar
// already uses elsewhere in admin, just in red instead of gold.
//
// "critical" goes further: a solid near-black card (same move as the
// reference dashboard's dramatic dark card for its one truly different
// widget) reserved for the kill switches - maintenance mode and checkout
// disabled affect every visitor on the site the instant they're flipped,
// so this section gets a visually distinct, unmissable treatment instead
// of just another red-bordered card in the list.
function Section({ icon: Icon, title, description, children, tone = "default" }: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: "default" | "critical";
}) {
  if (tone === "critical") {
    return (
      <div
        className="rounded-2xl shadow-hover overflow-hidden p-4 text-white"
        style={{ background: "linear-gradient(160deg, hsl(var(--admin-critical-from)) 0%, hsl(var(--admin-critical-to)) 100%)" }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <Icon size={13} strokeWidth={2} className="text-red-400" />
          </div>
          <p className="text-xs font-semibold text-white">{title}</p>
          <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-red-400 bg-red-500/10 rounded-full px-2 py-0.5">
            Site-wide
          </span>
        </div>
        <p className="text-[11px] text-white/50 mb-4">{description}</p>
        <div className="flex flex-col gap-3.5">{children}</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-destructive/25 bg-card shadow-soft overflow-hidden">
      <div className="border-l-4 border-l-destructive/70 p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Icon size={13} strokeWidth={2} className="text-destructive" />
          </div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">{description}</p>
        <div className="flex flex-col gap-3.5">{children}</div>
      </div>
    </div>
  );
}

function NumberRow({ label, hint, value, onChange, suffix }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs text-foreground">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 px-2.5 py-1.5 rounded-lg border border-input bg-muted text-xs text-right focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
        />
        {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, danger, dark }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; danger?: boolean; dark?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className={cn(
          "text-xs",
          danger && checked ? "text-red-400 font-medium" : dark ? "text-white" : "text-foreground"
        )}>{label}</p>
        {hint && <p className={cn("text-[10px] mt-0.5", dark ? "text-white/45" : "text-muted-foreground")}>{hint}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className={dark ? "border-white/20 data-[state=unchecked]:bg-white/10" : undefined}
      />
    </div>
  );
}

function AdminsSection({ maxAdmins, onMaxAdminsChange }: { maxAdmins: number; onMaxAdminsChange: (v: number) => void }) {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Which admin row is mid-removal, and its own reason field + confirm step.
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeConfirming, setRemoveConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles || []).map((r) => r.user_id);
    if (ids.length === 0) {
      setAdmins([]);
      setLoadingAdmins(false);
      return;
    }
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    setAdmins(profiles || []);
    setLoadingAdmins(false);
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const atCap = admins.length >= maxAdmins;

  const handleGrant = async () => {
    if (!email.trim() || !reason.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-action", {
        body: { action: "promote_to_admin", email: email.trim(), reason: reason.trim() },
      });
      if (error) throw error;
      toast({ title: "Admin added", description: data?.message || `${email} can now access the admin dashboard.` });
      setEmail("");
      setReason("");
      setConfirming(false);
      loadAdmins();
    } catch (e: any) {
      toast({ title: "Failed to add admin", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const startRemoving = (id: string) => {
    setRemovingId(id);
    setRemoveReason("");
    setRemoveConfirming(false);
  };

  const handleRemove = async (a: AdminRow) => {
    if (!a.email || !removeReason.trim()) return;
    setRemoving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-action", {
        body: { action: "revoke_admin", email: a.email, reason: removeReason.trim() },
      });
      if (error) throw error;
      toast({ title: "Admin removed", description: data?.message || `${a.email} no longer has admin access.` });
      setRemovingId(null);
      loadAdmins();
    } catch (e: any) {
      toast({ title: "Failed to remove admin", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Section
      icon={ShieldCheck}
      title="Admins"
      description={`Grant admin access by email — they're notified immediately. ${admins.length}/${maxAdmins} admins.`}
    >
      <div className="flex flex-col divide-y divide-border">
        {loadingAdmins ? (
          <p className="text-xs text-muted-foreground py-1">Loading...</p>
        ) : admins.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">No admins found</p>
        ) : (
          admins.map((a) => (
            <div key={a.id} className="py-2 first:pt-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-primary">
                  {(a.full_name || a.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground truncate">{a.full_name || "Unnamed"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.email}</p>
                </div>
                {removingId !== a.id && (
                  <button
                    onClick={() => startRemoving(a.id)}
                    disabled={admins.length <= 1}
                    title={admins.length <= 1 ? "Can't remove the last admin" : undefined}
                    className="flex-shrink-0 text-[11px] font-medium text-destructive hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                )}
              </div>

              {removingId === a.id && (
                <div className="mt-2 ml-[38px] flex flex-col gap-2">
                  <input
                    value={removeReason}
                    onChange={(e) => { setRemoveReason(e.target.value); setRemoveConfirming(false); }}
                    placeholder="Why are you removing them?"
                    className="px-3 py-2 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
                  />
                  {!removeConfirming ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => removeReason.trim() && setRemoveConfirming(true)}
                        disabled={!removeReason.trim()}
                        className="rounded-md border border-destructive/30 bg-destructive/5 text-destructive px-2.5 py-1 text-[11px] font-medium hover:bg-destructive/15 transition-colors disabled:opacity-50"
                      >
                        Remove admin
                      </button>
                      <button
                        onClick={() => setRemovingId(null)}
                        className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                      <AlertTriangle size={13} strokeWidth={2} className="text-destructive flex-shrink-0" />
                      <span className="text-[11px] text-foreground flex-1">
                        Remove admin access from <strong>{a.email}</strong>?
                      </span>
                      <button
                        onClick={() => handleRemove(a)}
                        disabled={removing}
                        className="flex-shrink-0 rounded-md bg-destructive text-destructive-foreground px-2.5 py-1 text-[11px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-70"
                      >
                        {removing ? "Removing..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setRemoveConfirming(false)}
                        disabled={removing}
                        className="flex-shrink-0 w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        aria-label="Cancel"
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="pt-4 border-t border-border">
        <NumberRow
          label="Maximum admins"
          hint="How many admin slots exist. Lowering it never removes anyone already in."
          value={maxAdmins}
          onChange={onMaxAdminsChange}
        />
      </div>

      <div className="pt-4 border-t border-border flex flex-col gap-3">
        {atCap && (
          <p className="text-[11px] text-muted-foreground">
            At the {maxAdmins}-admin limit — remove one before adding another.
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setConfirming(false); }}
            placeholder="email@example.com"
            disabled={atCap}
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition disabled:opacity-50"
          />
          <input
            value={reason}
            onChange={(e) => { setReason(e.target.value); setConfirming(false); }}
            placeholder="Why are you adding them?"
            disabled={atCap}
            className="flex-1 px-3.5 py-2.5 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition disabled:opacity-50"
          />
        </div>

        {!confirming ? (
          <button
            onClick={() => email.trim() && reason.trim() && setConfirming(true)}
            disabled={atCap || !email.trim() || !reason.trim()}
            className="self-start flex items-center gap-1.5 rounded-lg bg-muted text-foreground px-4 py-2.5 text-xs font-medium hover:bg-muted-foreground/15 transition-colors disabled:opacity-50"
          >
            <UserPlus size={13} strokeWidth={2} />
            Grant admin access
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <AlertTriangle size={13} strokeWidth={2} className="text-primary flex-shrink-0" />
            <span className="text-[11px] text-foreground flex-1">
              Grant full admin access to <strong>{email.trim()}</strong>?
            </span>
            <button
              onClick={handleGrant}
              disabled={submitting}
              className="flex-shrink-0 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-[11px] font-semibold hover:bg-primary-hover transition-colors disabled:opacity-70"
            >
              {submitting ? "Adding..." : "Confirm"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="flex-shrink-0 w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Cancel"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}

const AdminSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [original, setOriginal] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("platform_settings").select("key, value");
    if (!error && data) {
      const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
      setSettings(map);
      setOriginal(map);
    }
    setLoading(false);
  };

  const setField = (key: string, value: any) => setSettings((s) => ({ ...s, [key]: value }));

  const feeSchedule: PayoutFeeTier[] = settings.payout_fee_schedule ?? DEFAULT_FEE_SCHEDULE;
  const setFeeTier = (index: number, patch: Partial<PayoutFeeTier>) => {
    const next = feeSchedule.map((tier, i) => (i === index ? { ...tier, ...patch } : tier));
    setField("payout_fee_schedule", next);
  };

  const changedKeys = Object.keys(settings).filter(
    (k) => JSON.stringify(settings[k]) !== JSON.stringify(original[k])
  );

  const handleSave = async () => {
    if (changedKeys.length === 0) return;
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Explain why you're changing these settings — it's recorded in the audit log.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      for (const key of changedKeys) {
        const { error } = await supabase.functions.invoke("admin-action", {
          body: { action: "update_platform_setting", key, value: settings[key], reason: reason.trim() },
        });
        if (error) throw error;
      }
      toast({ title: "Saved", description: `${changedKeys.length} setting${changedKeys.length === 1 ? "" : "s"} updated.` });
      setOriginal(settings);
      setReason("");
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout pageTitle="Settings">
        <p className="text-xs text-muted-foreground">Loading settings...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout pageTitle="Settings">
      {/* Two hand-balanced columns rather than grid auto-flow: the cards
          are wildly different heights, so auto-placement leaves holes. */}
      <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* Who can get in, and how long the platform waits */}
        <div className="flex flex-col gap-4">
          <AdminsSection
            maxAdmins={settings.max_admins ?? 3}
            onMaxAdminsChange={(v) => setField("max_admins", v)}
          />

          <Section icon={Clock} title="Time windows" description="How long the platform waits before auto-cancelling, auto-disputing, or auto-releasing escrow.">
            <NumberRow
              label="Vendor confirmation deadline"
              hint="Before an unconfirmed order auto-cancels and refunds"
              value={settings.vendor_confirm_hours ?? 48}
              onChange={(v) => setField("vendor_confirm_hours", v)}
              suffix="hours"
            />
            <NumberRow
              label="Undelivered auto-dispute window"
              hint="Before an undelivered order is auto-raised for review"
              value={settings.auto_dispute_days ?? 5}
              onChange={(v) => setField("auto_dispute_days", v)}
              suffix="days"
            />
            <NumberRow
              label="Escrow release backstop"
              hint="Funds normally release the moment the vendor enters the buyer's 6-digit code. This only fires if they never do — delivery orders only, pickup never auto-releases."
              value={settings.pin_release_hours ?? 6}
              onChange={(v) => setField("pin_release_hours", v)}
              suffix="hours"
            />
          </Section>
        </div>

        {/* Money, and the switches that take the site down */}
        <div className="flex flex-col gap-4">

          <Section icon={DollarSign} title="Financial" description="Commission and payout parameters — every order and vendor payout going forward uses these.">
            <NumberRow
              label="Commission rate"
              hint="Percentage taken from each order"
              value={settings.commission_rate_percent ?? 6}
              onChange={(v) => setField("commission_rate_percent", v)}
              suffix="%"
            />
            <NumberRow
              label="Minimum auto-payout"
              hint="Vendor balance threshold before an automatic payout fires"
              value={settings.minimum_auto_payout_ksh ?? 10000}
              onChange={(v) => setField("minimum_auto_payout_ksh", v)}
              suffix="KES"
            />
  
            <div className="pt-1 border-t border-border">
              <p className="text-xs text-foreground mb-2">Payout fee schedule</p>
              <div className="flex flex-col gap-2">
                {feeSchedule.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {tier.max_ksh !== undefined ? (
                      <>
                        <span>Up to</span>
                        <input
                          type="number"
                          value={tier.max_ksh}
                          onChange={(e) => setFeeTier(i, { max_ksh: Number(e.target.value) })}
                          className="w-20 px-2 py-1 rounded-md border border-input bg-muted text-xs text-right focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
                        />
                        <span>KES &rarr; fee</span>
                      </>
                    ) : (
                      <span className="flex-1">Above that &rarr; fee</span>
                    )}
                    <input
                      type="number"
                      value={tier.fee_ksh}
                      onChange={(e) => setFeeTier(i, { fee_ksh: Number(e.target.value) })}
                      className="w-16 px-2 py-1 rounded-md border border-input bg-muted text-xs text-right focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
                    />
                    <span>KES</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
  
          <Section
            icon={ToggleLeft}
            title="Feature flags"
            description="Platform-wide kill switches. Take effect for visitors within a few minutes. You stay exempt from all of these while logged in as admin."
            tone="critical"
          >
            <ToggleRow
              label="Maintenance mode"
              hint="Extreme option — locks out every visitor with a full-page maintenance screen"
              checked={!!settings.maintenance_mode}
              onChange={(v) => setField("maintenance_mode", v)}
              danger
              dark
            />
            <ToggleRow
              label="Checkout disabled"
              hint="Blocks checkout only, rest of the site stays up"
              checked={!!settings.checkout_disabled}
              onChange={(v) => setField("checkout_disabled", v)}
              danger
              dark
            />
  
            <div className="pt-3 border-t border-white/10">
              <ToggleRow
                label="Maintenance banner"
                hint="Gentle option — a dismissible heads-up banner, site stays fully usable"
                checked={!!settings.maintenance_banner_enabled}
                onChange={(v) => setField("maintenance_banner_enabled", v)}
                dark
              />
              {settings.maintenance_banner_enabled && (
                <textarea
                  value={settings.maintenance_banner_message ?? ""}
                  onChange={(e) => setField("maintenance_banner_message", e.target.value)}
                  placeholder="e.g. We're making some updates right now. Everything still works, but you might notice a few changes."
                  rows={2}
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary transition resize-none"
                />
              )}
            </div>
          </Section>

        </div>

        {changedKeys.length > 0 && (
          <div className="lg:col-span-2 sticky bottom-4 rounded-xl border border-primary/30 bg-card shadow-hover p-4">
            <div className="flex items-start gap-2 mb-3 text-[11px] text-muted-foreground">
              <AlertTriangle size={13} strokeWidth={2} className="text-primary flex-shrink-0 mt-0.5" />
              <span>
                {changedKeys.length} unsaved change{changedKeys.length === 1 ? "" : "s"}. A reason is required — it's stored in the admin activity log.
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you making this change?"
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-70"
              >
                {saving ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                ) : (
                  <Save size={13} strokeWidth={2} />
                )}
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;
