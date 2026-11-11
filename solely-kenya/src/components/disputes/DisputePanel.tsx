import { useState } from "react";
import { AlertTriangle, CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { DisputeChat } from "@/components/disputes/DisputeChat";
import {
  formatDue, ksh, offerText, orderAction, problemLabel, timerOf, useDispute,
  type DisputeOffer, type OrderActionName, type OrderTimer,
} from "@/lib/orderFlow";

interface Props {
  orderId: string;
  role: "buyer" | "vendor";
  storeName?: string;
  timers?: OrderTimer[];
  /** Order items, for naming missing items and capping partial refunds. */
  items?: { id: string; product_name: string; quantity: number }[];
  subtotal?: number;
  onChanged?: () => void;
}

/**
 * The one place an order's problem is shown and handled, for both sides.
 * Each stage shows a single sentence about what's happening and only the
 * buttons that make sense right now; the chat stays folded away until
 * someone wants it.
 */
export function DisputePanel({ orderId, role, storeName = "The seller", timers, items = [], subtotal = 0, onChanged }: Props) {
  const { dispute, reload } = useDispute(orderId);
  const [busy, setBusy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [noteFor, setNoteFor] = useState<null | { action: OrderActionName; title: string; params?: Record<string, unknown>; placeholder: string; required?: boolean }>(null);
  const [note, setNote] = useState("");

  if (!dispute) return null;

  const run = async (action: OrderActionName, params: Record<string, unknown> = {}, success?: string) => {
    setBusy(action);
    try {
      await orderAction(action, orderId, params);
      if (success) toast.success(success);
      await reload();
      onChanged?.();
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const due = (kind: Parameters<typeof timerOf>[1]) => {
    const t = timerOf(timers, kind);
    return t ? formatDue(t.due_at) : null;
  };

  const otherParty = role === "buyer" ? storeName : "The buyer";
  const pendingFromOther = dispute.offers.find((o) => o.status === "pending" && o.made_by !== role);
  const pendingFromMe = dispute.offers.find((o) => o.status === "pending" && o.made_by === role);
  const missingNames = items.filter((i) => dispute.missing_item_ids?.includes(i.id)).map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
  const resolved = dispute.stage === "resolved";

  // ── What's happening, in one sentence ────────────────────────────────────
  let status: string;
  const actions: React.ReactNode[] = [];
  const btn = (key: string, label: string, onClick: () => void, variant: "default" | "outline" = "default") => (
    <Button key={key} size="sm" variant={variant} className="h-9" disabled={!!busy} onClick={onClick}>
      {busy === key ? "Working..." : label}
    </Button>
  );

  switch (dispute.stage) {
    case "negotiating": {
      const by = due("vendor_response");
      if (role === "vendor") {
        status = pendingFromMe
          ? `You offered: ${offerText(pendingFromMe)}. Waiting for the buyer.`
          : `The buyer says: "${dispute.description ?? problemLabel(dispute.dispute_type)}". Offer a fix${by ? ` by ${by}` : ""}, or they're refunded in full. You cover any delivery costs.`;
        actions.push(btn("make_offer", pendingFromMe ? "Change offer" : "Offer a fix", () => setOfferOpen(true), pendingFromMe ? "outline" : "default"));
      } else {
        status = pendingFromOther
          ? `${storeName} has made an offer.`
          : `We've asked ${storeName} to offer a fix.${by ? ` If they don't respond by ${by}, you're refunded in full.` : ""}`;
      }
      break;
    }
    case "awaiting_fix": {
      const by = due("fix");
      const what = dispute.dispute_type === "missing_items" ? `the missing items (${missingNames || "see the report"})`
        : dispute.dispute_type === "wrong_order" ? "the correct order" : "a replacement";
      if (role === "vendor") {
        status = `Send ${what}${by ? ` by ${by}` : ""}, at your cost. ${dispute.dispute_type === "wrong_order" ? "Collect the other package too." : ""}`;
        actions.push(btn("fix_sent", "I've sent it", () => run("fix_sent", {}, "The buyer has been told it's on the way.")));
      } else {
        status = `${storeName} is sending ${what}${by ? ` by ${by}` : ""}.`;
        if (dispute.dispute_type === "wrong_order") {
          actions.push(btn("refund_now", "Refund me instead", () => run("refund_now", {}, "Refund on its way."), "outline"));
        }
      }
      break;
    }
    case "fix_sent":
      if (role === "buyer") {
        status = `${storeName} says it's on the way. When it arrives, is everything right now?`;
        actions.push(btn("fix_result", "Yes, all good", () => run("fix_result", { ok: true }, "Thanks! The order is complete.")));
        actions.push(btn("fix_bad", "Still not right", () => { setNote(""); setNoteFor({ action: "fix_result", params: { ok: false }, title: "What's still wrong?", placeholder: "e.g. Still the wrong size", required: true }); }, "outline"));
      } else {
        status = "Waiting for the buyer to confirm it's sorted. If they don't reply, you're paid automatically.";
      }
      break;
    case "awaiting_return":
      if (role === "buyer") {
        status = `${storeName} will send someone to collect the item. Tap below once you've handed it over.`;
        actions.push(btn("handed_back", "I've handed it back", () => { setNote(""); setNoteFor({ action: "handed_back", title: "Handed it back", placeholder: "Optional: who collected it, and when", required: false }); }));
      } else {
        status = "Collect the item from the buyer, at your cost. The buyer is refunded once you have it.";
        actions.push(btn("confirm_return", "I got it back", () => run("confirm_return", {}, "The buyer is being refunded.")));
      }
      break;
    case "return_handed": {
      const by = due("return_confirm");
      if (role === "buyer") {
        status = `Waiting for ${storeName} to confirm.${by ? ` You'll be refunded by ${by} at the latest.` : ""}`;
      } else {
        status = `The buyer says they handed the item back.${by ? ` Confirm by ${by}, or they're refunded automatically.` : ""}`;
        actions.push(btn("confirm_return", "I got it back", () => run("confirm_return", {}, "The buyer is being refunded.")));
        actions.push(btn("reject_return", "I didn't get it", () => { setNote(""); setNoteFor({ action: "reject_return", title: "You didn't get it back?", placeholder: "Tell Solely what happened", required: true }); }, "outline"));
      }
      break;
    }
    case "buyer_choice":
      if (role === "buyer") {
        status = `${storeName} didn't send the missing items in time. What would you like?`;
        actions.push(btn("missing_refund", "Refund the missing items", () => run("missing_choice", { choice: "refund" }, "Refund on its way.")));
        actions.push(btn("missing_keep", "Keep the order as is", () => run("missing_choice", { choice: "accept" }, "Done. The order is complete."), "outline"));
      } else {
        status = "The missing items weren't sent in time. Waiting for the buyer to choose a refund for them or keep the order as is.";
      }
      break;
    case "with_admin":
      status = "Solely is reviewing this. We'll contact you, usually within one working day. The money stays held until it's decided.";
      break;
    default:
      status = dispute.resolution_notes || "This problem has been sorted.";
  }

  const canEscalate = ["negotiating", "awaiting_fix", "fix_sent", "awaiting_return", "return_handed"].includes(dispute.stage);
  const appealHours = 48;
  const canAppeal = resolved && !dispute.resolved_by && !dispute.appeal_requested_at && dispute.resolved_at
    && Date.now() - new Date(dispute.resolved_at).getTime() < appealHours * 3600_000;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${resolved ? "border-border bg-muted/30" : dispute.stage === "with_admin" ? "border-primary/30 bg-primary-soft" : "border-destructive/30 bg-destructive-soft"}`}>
      <div className="flex items-start gap-2.5">
        {resolved ? <CheckCircle2 size={18} className="text-success mt-0.5 shrink-0" />
          : dispute.stage === "with_admin" ? <ShieldCheck size={18} className="text-primary-strong mt-0.5 shrink-0" />
            : <AlertTriangle size={18} className="text-destructive mt-0.5 shrink-0" />}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{resolved ? "Problem sorted" : `Problem: ${problemLabel(dispute.dispute_type)}`}</p>
          <p className="text-sm text-foreground/80">{status}</p>
        </div>
      </div>

      {pendingFromOther && !resolved && (
        <OfferCard offer={pendingFromOther} from={otherParty} busy={!!busy}
          onAccept={() => run("respond_offer", { offerId: pendingFromOther.id, accept: true }, "Agreed.")}
          onDecline={() => run("respond_offer", { offerId: pendingFromOther.id, accept: false }, "Declined. You can wait for another offer or ask Solely to decide.")} />
      )}

      {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions}</div>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" onClick={() => setChatOpen((v) => !v)}>
          <MessageSquare size={13} /> {chatOpen ? "Hide messages" : "Messages"}
        </button>
        {canEscalate && (
          <button className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline" disabled={!!busy}
            onClick={() => { setNote(""); setNoteFor({ action: "escalate", title: "Ask Solely to decide", placeholder: "Optional: anything Solely should know", required: false }); }}>
            Ask Solely to decide
          </button>
        )}
        {canAppeal && (
          <button className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => { setNote(""); setNoteFor({ action: "appeal", title: "Ask Solely to review this decision", placeholder: "Why do you disagree?", required: true }); }}>
            Disagree? Ask Solely to review
          </button>
        )}
      </div>

      {chatOpen && <DisputeChat disputeId={dispute.id} currentUserRole={role} />}

      {role === "vendor" && (
        <MakeOfferDialog open={offerOpen} onOpenChange={setOfferOpen} maxPartial={subtotal}
          onSubmit={async (params) => { if (await run("make_offer", params, "Offer sent to the buyer.")) setOfferOpen(false); }} />
      )}

      <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{noteFor?.title}</DialogTitle>
            {noteFor?.action === "escalate" && <DialogDescription>Solely's team will look at what both of you said and decide. The money stays held until then.</DialogDescription>}
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={noteFor?.placeholder} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteFor(null)}>Cancel</Button>
            <Button disabled={!!busy || (noteFor?.required && note.trim().length < 3)}
              onClick={async () => {
                if (!noteFor) return;
                if (await run(noteFor.action, { ...(noteFor.params ?? {}), note: note.trim() }, "Sent.")) setNoteFor(null);
              }}>
              {busy ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferCard({ offer, from, busy, onAccept, onDecline }: {
  offer: DisputeOffer; from: string; busy: boolean; onAccept: () => void; onDecline: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-xs text-muted-foreground">{from} offers</p>
      <p className="text-sm font-semibold">{offerText(offer)}</p>
      {offer.note && <p className="text-xs text-muted-foreground">"{offer.note}"</p>}
      <div className="flex gap-2">
        <Button size="sm" className="h-8" disabled={busy} onClick={onAccept}>Accept</Button>
        <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={onDecline}>Decline</Button>
      </div>
    </div>
  );
}

const OFFER_CHOICES = [
  { kind: "partial_refund", title: "Give some money back", hint: "The buyer keeps the item" },
  { kind: "replacement", title: "Send a replacement", hint: "You collect the item and send the right one" },
  { kind: "refund_with_return", title: "Full refund", hint: "You collect the item first" },
] as const;

function MakeOfferDialog({ open, onOpenChange, maxPartial, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; maxPartial: number;
  onSubmit: (params: Record<string, unknown>) => void;
}) {
  const [kind, setKind] = useState<(typeof OFFER_CHOICES)[number]["kind"]>("replacement");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const amountOk = kind !== "partial_refund" || (Number(amount) > 0 && Number(amount) < maxPartial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Offer a fix</DialogTitle>
          <DialogDescription>Pick what you'll do. Any delivery costs are yours.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {OFFER_CHOICES.map((c) => (
            <button key={c.kind} type="button" onClick={() => setKind(c.kind)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${kind === c.kind ? "border-primary bg-primary-soft" : "border-border hover:bg-muted/50"}`}>
              <p className="text-sm font-medium">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.hint}</p>
            </button>
          ))}
          {kind === "partial_refund" && (
            <div className="space-y-1 pt-1">
              <Input type="number" inputMode="numeric" placeholder="Amount in KES" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Less than {ksh(maxPartial)}. For the full price, choose "Full refund".</p>
            </div>
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional message to the buyer" rows={2} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!amountOk} onClick={() => onSubmit({ kind, amount: kind === "partial_refund" ? Number(amount) : undefined, note: note.trim() })}>
            Send offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
