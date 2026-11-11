import { useState } from "react";
import { AlertTriangle, Check, Clock, ImagePlus, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { celebrate } from "@/components/Celebration";
import { toast } from "@/lib/toast";
import { edgeErrorMessage } from "@/lib/edgeError";
import { supabase } from "@/integrations/supabase/client";
import { uploadEvidence } from "@/lib/disputeEvidence";
import { DisputePanel } from "@/components/disputes/DisputePanel";
import { DeliveryTrackingControl } from "@/components/DeliveryTrackingControl";
import { formatDue, orderAction, timerOf, type OrderActionName, type OrderTimer, type PackingChecklist } from "@/lib/orderFlow";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
  timers?: OrderTimer[];
  checklist?: PackingChecklist;
  hasDispute: boolean;
  onChanged: () => void;
}

const DECLINE_REASONS = [
  ["out_of_stock", "Out of stock"],
  ["wrong_size", "Size not available"],
  ["pricing_error", "Pricing error"],
  ["cannot_deliver", "Can't deliver to that location"],
  ["damaged_item", "Item damaged"],
  ["other", "Other"],
] as const;

/**
 * The seller's single "do this next" panel. Shipping is two short steps
 * (confirm the package, then send it), and everything else - deadlines,
 * reminders, refunds - is handled by Solely in the background.
 */
export function VendorNextStep({ order, timers, checklist, hasDispute, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [updateFor, setUpdateFor] = useState<null | "send_update" | "buyer_unavailable">(null);
  const [message, setMessage] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [method, setMethod] = useState<"self" | "courier">("self");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");

  const isPickup = order.order_shipping_details?.delivery_type === "pickup";
  const items = (order.order_items ?? []) as any[];
  const ship = timerOf(timers, "ship");
  const deliver = timerOf(timers, "deliver");
  const release = timerOf(timers, "release");
  const unavailable = timerOf(timers, "buyer_unavailable");
  const hold = timerOf(timers, "checklist_hold");

  const run = async (action: OrderActionName, params: Record<string, unknown> = {}, success?: string) => {
    setBusy(action);
    try {
      const res = await orderAction(action, order.id, params);
      if (success || res.message) toast.success(res.message ?? success);
      onChanged();
      return res;
    } catch (e) {
      toast.error(e);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const verifyOtp = async () => {
    setBusy("otp");
    try {
      const { data, error } = await supabase.functions.invoke("verify-delivery-otp", { body: { orderId: order.id, otp } });
      if (error) throw new Error(await edgeErrorMessage(error, "We couldn't check that code. Please try again."));
      if (!data?.success) throw new Error(data?.error || "That code doesn't match.");
      setOtpOpen(false);
      setOtp("");
      celebrate({
        title: "Delivery confirmed",
        amount: data.payoutAmount ? `KES ${Number(data.payoutAmount).toLocaleString()}` : undefined,
        subtitle: "The money has been released to your Solely balance.",
        cta: "Nice!",
      });
      onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const submitChecklist = async () => {
    setBusy("submit_checklist");
    try {
      let photoPath: string | undefined;
      if (photo) {
        try { photoPath = await uploadEvidence("tracking", order.id, photo); }
        catch (e) { console.warn("Package photo upload failed:", e); }
      }
      await orderAction("submit_checklist", order.id, { checkedItemIds: ticked, description: description.trim(), photoPath });
      toast.success("Sent to the buyer to check");
      setEditingChecklist(false);
      onChanged();
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(null);
    }
  };

  const startChecklist = () => {
    setTicked([]);
    setDescription(checklist?.description ?? "");
    setPhoto(null);
    setEditingChecklist(true);
  };

  const deadline = (label: string, iso?: string, extensions = 0) => iso && (
    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-strong bg-primary-soft rounded-full px-2.5 py-1">
      <Clock size={12} /> {label} {formatDue(iso)}{extensions > 0 ? " (extended)" : ""}
    </p>
  );

  const smallLink = (label: string, onClick: () => void, danger = false) => (
    <button className={`text-xs underline-offset-2 hover:underline ${danger ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`} onClick={onClick}>
      {label}
    </button>
  );

  let body: React.ReactNode = null;

  if (order.status === "disputed" || (hasDispute && ["completed", "refunded"].includes(order.status))) {
    body = (
      <DisputePanel orderId={order.id} role="vendor" timers={timers}
        items={items} subtotal={Number(order.subtotal_ksh) - Number(order.refunded_ksh ?? 0)} onChanged={onChanged} />
    );
  } else if (order.status === "pending_vendor_confirmation") {
    body = (
      <div className="rounded-xl border border-primary/30 bg-primary-soft p-4 space-y-3">
        <p className="text-sm font-semibold text-primary-strong">New order. The buyer has paid.</p>
        <p className="text-xs text-primary-strong">
          {isPickup ? "Once you accept, get it ready for pickup." : "Once you accept, ship it within about 3 hours (night hours don't count)."}
        </p>
        <div className="flex gap-2">
          <Button className="flex-1 h-10" disabled={!!busy} onClick={() => run("accept", {}, "Order accepted")}>
            {busy === "accept" ? "Accepting..." : "Accept"}
          </Button>
          <Button variant="outline" className="flex-1 h-10 text-destructive border-destructive/30" disabled={!!busy}
            onClick={() => { setDeclineReason(""); setDeclineOpen(true); }}>
            Can't fulfil
          </Button>
        </div>
      </div>
    );
  } else if (order.status === "accepted") {
    const objected = checklist?.buyer_status === "objected";
    const canShip = isPickup || (checklist && !objected);
    const showChecklistForm = !isPickup && (!checklist || editingChecklist);

    body = (
      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{isPickup ? "Get it ready for pickup" : "Pack and send"}</p>
          {deadline("Ship by", ship?.due_at, ship?.extensions)}
        </div>

        {!isPickup && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">1. Confirm what's in the package</p>
            {showChecklistForm ? (
              <div className="space-y-2">
                {items.map((i) => {
                  const snap = (i.product_snapshot ?? {}) as Record<string, string>;
                  const detail = [snap.size && `size ${snap.size}`, i.color || snap.color].filter(Boolean).join(", ");
                  return (
                    <label key={i.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5 cursor-pointer">
                      <Checkbox checked={ticked.includes(i.id)}
                        onCheckedChange={(c) => setTicked((t) => (c ? [...t, i.id] : t.filter((x) => x !== i.id)))} />
                      <span className="text-sm">{i.quantity}× {i.product_name}{detail && <span className="text-muted-foreground"> · {detail}</span>}</span>
                    </label>
                  );
                })}
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe it, e.g. Black AF1, size 42, white box" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <ImagePlus size={14} /> {photo ? photo.name.slice(0, 20) : "Add a photo (optional)"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                  </label>
                  <Button size="sm" disabled={!!busy || ticked.length !== items.length || description.trim().length < 3} onClick={submitChecklist}>
                    {busy === "submit_checklist" ? "Sending..." : "Confirm package"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">The buyer sees this before you ship, so a wrong item can be caught early.</p>
              </div>
            ) : objected ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive-soft p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5"><AlertTriangle size={14} /> The buyer says this isn't right</p>
                {checklist.buyer_note && <p className="text-sm">"{checklist.buyer_note}"</p>}
                <p className="text-xs text-muted-foreground">Fix the package and confirm it again{hold ? `, or ship after ${formatDue(hold.due_at)} if they don't reply` : ""}.</p>
                <Button size="sm" variant="outline" onClick={startChecklist}>Update package</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-success">
                  <Check size={14} />
                  {checklist.buyer_status === "approved" ? "Buyer confirmed the package"
                    : checklist.buyer_status === "timed_out" ? "Buyer didn't reply. OK to ship."
                      : "Sent to the buyer to check"}
                </span>
                {smallLink("Edit", startChecklist)}
              </div>
            )}
          </div>
        )}

        <div className={`space-y-2 ${canShip ? "" : "opacity-50 pointer-events-none"}`}>
          {!isPickup && <p className="text-xs font-medium text-muted-foreground">2. Send it</p>}
          {!isPickup && (
            <div className="grid grid-cols-2 gap-2">
              {(["self", "courier"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className={`rounded-lg border p-2 text-sm transition-colors ${method === m ? "border-primary bg-primary-soft font-medium" : "border-border bg-card"}`}>
                  {m === "self" ? "Me or my rider" : "A courier"}
                </button>
              ))}
            </div>
          )}
          {!isPickup && method === "courier" && (
            <div className="grid grid-cols-2 gap-2">
              <Input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Courier, e.g. G4S" />
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking no. (optional)" />
            </div>
          )}
          <Button className="w-full h-10" disabled={!!busy || !canShip || (method === "courier" && !isPickup && !courier.trim())}
            onClick={() => run("ship", { selfDelivery: method === "self", courier: courier.trim(), tracking: tracking.trim() }, isPickup ? "Buyer told it's ready" : "Marked as shipped")}>
            {busy === "ship" ? "Updating..." : isPickup ? "Mark ready for pickup" : "Mark as shipped"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {!isPickup && smallLink("Running late? Update the buyer", () => { setMessage(""); setUpdateFor("send_update"); })}
          {smallLink("Can't fulfil this order", () => { setDeclineReason(""); setDeclineOpen(true); }, true)}
        </div>
      </div>
    );
  } else if (order.status === "shipped") {
    const self = (order.order_shipping_details?.courier_name ?? "").startsWith("Personal");
    body = (
      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><Truck size={16} /> On the way</p>
          {deadline("Arrive by", deliver?.due_at, deliver?.extensions)}
        </div>
        {unavailable ? (
          <p className="text-sm rounded-lg bg-primary-soft border border-primary/30 p-3">
            Solely is contacting the buyer. Please wait a little longer if you can.
          </p>
        ) : (
          <Button className="w-full h-10" disabled={!!busy} onClick={() => run("arrived", {}, "Buyer asked to confirm")}>
            {busy === "arrived" ? "Updating..." : "Mark as arrived"}
          </Button>
        )}
        {self && <DeliveryTrackingControl orderId={order.id} isCurrentlyTracking={order.order_shipping_details?.delivery_tracking_enabled || false} />}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {smallLink("Send the buyer an update", () => { setMessage(""); setUpdateFor("send_update"); })}
          {!unavailable && smallLink("Buyer not available?", () => { setMessage(""); setUpdateFor("buyer_unavailable"); }, true)}
        </div>
      </div>
    );
  } else if (["arrived", "delivered"].includes(order.status)) {
    body = (
      <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Package size={16} /> {isPickup ? "Ready for pickup" : "Arrived"}</p>
        <p className="text-sm text-muted-foreground">
          Ask the buyer for their 6-digit code to get paid now.
          {release && ` Otherwise you're paid automatically ${formatDue(release.due_at)}, unless they report a problem.`}
        </p>
        <Button className="w-full h-10" onClick={() => { setOtp(""); setOtpOpen(true); }}>Enter buyer's code</Button>
        {!isPickup && !unavailable && (
          <div>{smallLink("Buyer not available?", () => { setMessage(""); setUpdateFor("buyer_unavailable"); }, true)}</div>
        )}
        {unavailable && <p className="text-sm rounded-lg bg-primary-soft border border-primary/30 p-3">Solely is contacting the buyer.</p>}
      </div>
    );
  }

  return (
    <>
      {body}

      {/* Can't fulfil */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Can't fulfil this order?</DialogTitle>
            <DialogDescription>The buyer is refunded KES {Number(order.total_ksh).toLocaleString()} in full straight away.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {DECLINE_REASONS.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setDeclineReason(value)}
                className={`rounded-lg border p-2 text-xs text-left ${declineReason === value ? "border-primary bg-primary-soft font-medium" : "border-border"}`}>
                {label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Keep order</Button>
            <Button variant="destructive" disabled={!declineReason || !!busy}
              onClick={async () => { if (await run("decline", { reason: declineReason }, "Order cancelled. The buyer is being refunded.")) setDeclineOpen(false); }}>
              {busy === "decline" ? "Cancelling..." : "Cancel and refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update the buyer / buyer unavailable */}
      <Dialog open={!!updateFor} onOpenChange={(o) => !o && setUpdateFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{updateFor === "buyer_unavailable" ? "Can't reach the buyer?" : "Update the buyer"}</DialogTitle>
            <DialogDescription>
              {updateFor === "buyer_unavailable"
                ? "We'll alert the buyer and Solely will call them. Please wait a while if you can. If they don't respond, you keep the delivery fee."
                : "Tell them where the order is. This also gives you more time."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
            placeholder={updateFor === "buyer_unavailable" ? "Optional: e.g. Rider is at the gate, phone off" : "e.g. Packing now, it leaves at 2pm"} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateFor(null)}>Cancel</Button>
            <Button disabled={!!busy || (updateFor === "send_update" && message.trim().length < 3)}
              onClick={async () => {
                if (!updateFor) return;
                const res = await run(updateFor, updateFor === "send_update" ? { message: message.trim() } : { note: message.trim() },
                  updateFor === "send_update" ? "Update sent to the buyer" : undefined);
                if (res) setUpdateFor(null);
              }}>
              {busy ? "Sending..." : updateFor === "buyer_unavailable" ? "Report" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Buyer's code */}
      <Dialog open={otpOpen} onOpenChange={setOtpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter the buyer's code</DialogTitle>
            <DialogDescription>Ask for it once they have the item. You're paid straight away.</DialogDescription>
          </DialogHeader>
          <Input type="text" inputMode="numeric" maxLength={6} placeholder="• • • • • •" value={otp} autoFocus
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="text-center text-2xl tracking-[0.5em] font-mono h-14" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpOpen(false)}>Cancel</Button>
            <Button disabled={otp.length !== 6 || busy === "otp"} onClick={verifyOtp}>
              {busy === "otp" ? "Checking..." : "Confirm delivery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
