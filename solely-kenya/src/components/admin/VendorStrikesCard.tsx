import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Ban, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeAdminAction } from "@/lib/edgeError";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Strike {
  id: string;
  order_id: string | null;
  reason: string;
  notes: string | null;
  created_at: string;
  voided_at: string | null;
}

const REASON_TEXT: Record<string, string> = {
  not_shipped: "Accepted, never shipped",
  not_delivered: "Shipped, never delivered",
  false_buyer_unavailable: "False 'buyer unavailable'",
  admin: "Added by admin",
};

const WINDOW_DAYS = 90;

/**
 * Strikes and suspension for one vendor. 3 active strikes in 90 days
 * suspends the shop automatically; admins can add or remove strikes and
 * suspend or restore by hand. Every action needs a reason for the log.
 */
export function VendorStrikesCard({ vendorId }: { vendorId: string }) {
  const { toast } = useToast();
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [suspendedAt, setSuspendedAt] = useState<string | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      (supabase as any).from("vendor_strikes").select("id, order_id, reason, notes, created_at, voided_at")
        .eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(20),
      (supabase as any).from("profiles").select("suspended_at, suspension_reason").eq("id", vendorId).maybeSingle(),
    ]);
    setStrikes((s ?? []) as Strike[]);
    setSuspendedAt(p?.suspended_at ?? null);
    setSuspensionReason(p?.suspension_reason ?? null);
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string, targetId: string, success: string) => {
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Type a short reason first. It's recorded in the audit log.", variant: "destructive" });
      return;
    }
    setBusy(action + targetId);
    try {
      await invokeAdminAction({ action, targetId, reason: reason.trim() });
      toast({ title: success });
      setReason("");
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const cutoff = Date.now() - WINDOW_DAYS * 24 * 3600_000;
  const active = strikes.filter((s) => !s.voided_at && new Date(s.created_at).getTime() >= cutoff);

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft p-4 mb-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <ShieldAlert size={12} strokeWidth={1.5} /> Strikes & suspension
        </p>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${suspendedAt ? "bg-destructive-soft text-destructive" : active.length ? "bg-primary-soft text-primary-strong" : "bg-success-soft text-success"}`}>
          {suspendedAt ? "Suspended" : `${active.length} of 3 active`}
        </span>
      </div>

      {suspendedAt && (
        <p className="text-xs rounded-lg bg-destructive-soft p-2.5">
          <Ban size={11} className="inline mr-1" />
          Suspended {formatDistanceToNow(new Date(suspendedAt), { addSuffix: true })}{suspensionReason ? `: ${suspensionReason}` : ""}. Listings hidden; open orders continue.
        </p>
      )}

      {strikes.length > 0 && (
        <div className="divide-y divide-border">
          {strikes.map((s) => {
            const expired = new Date(s.created_at).getTime() < cutoff;
            return (
              <div key={s.id} className={`flex items-center justify-between gap-2 py-1.5 text-xs ${s.voided_at || expired ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="text-foreground truncate">
                    {REASON_TEXT[s.reason] ?? s.reason}{s.order_id ? ` · #${s.order_id.slice(0, 8)}` : ""}
                    {s.voided_at ? " · removed" : expired ? " · expired" : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}{s.notes ? ` · ${s.notes}` : ""}</p>
                </div>
                {!s.voided_at && !expired && (
                  <button className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
                    disabled={!!busy} onClick={() => act("void_strike", s.id, "Strike removed")}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="h-8 text-xs" />
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => act("add_strike", vendorId, "Strike added")}>Add strike</Button>
          {suspendedAt ? (
            <Button size="sm" className="h-8 text-xs" disabled={!!busy} onClick={() => act("unsuspend_vendor", vendorId, "Vendor restored")}>Restore shop</Button>
          ) : (
            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={!!busy} onClick={() => act("suspend_vendor", vendorId, "Vendor suspended")}>Suspend</Button>
          )}
        </div>
      </div>
    </div>
  );
}
