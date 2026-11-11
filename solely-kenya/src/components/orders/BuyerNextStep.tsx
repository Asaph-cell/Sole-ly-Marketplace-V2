import { useState } from "react";
import { AlertTriangle, Clock, Lock, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { celebrate } from "@/components/Celebration";
import { toast } from "@/lib/toast";
import { DisputePanel } from "@/components/disputes/DisputePanel";
import { ReportProblemDialog } from "@/components/orders/ReportProblemDialog";
import { formatDue, orderAction, timerOf, type OrderTimer, type PackingChecklist } from "@/lib/orderFlow";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
  storeName: string;
  timers?: OrderTimer[];
  checklist?: PackingChecklist;
  hasDispute: boolean;
  onChanged: () => void;
  onConfirmed: () => void;
}

/**
 * The single "what now?" panel on a buyer's order. It shows one thing at a
 * time - the step the order is on - so buyers aren't reading rules for
 * situations they're not in.
 */
export function BuyerNextStep({ order, storeName, timers, checklist, hasDispute, onChanged, onConfirmed }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [objecting, setObjecting] = useState(false);
  const [note, setNote] = useState("");
  const isPickup = order.order_shipping_details?.delivery_type === "pickup";
  const items = (order.order_items ?? []) as { id: string; product_name: string; quantity: number }[];

  const run = async (action: Parameters<typeof orderAction>[0], params: Record<string, unknown> = {}, success?: string) => {
    setBusy(action);
    try {
      await orderAction(action, order.id, params);
      if (success) toast.success(success);
      onChanged();
      return true;
    } catch (e) {
      toast.error(e);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const ship = timerOf(timers, "ship");
  const deliver = timerOf(timers, "deliver");
  const release = timerOf(timers, "release");
  const unavailable = timerOf(timers, "buyer_unavailable");

  const gotItButtons = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button className="h-10" disabled={!!busy} onClick={() => setConfirmOpen(true)}>
        {isPickup ? "I've collected it" : "Yes, I got it"}
      </Button>
      <button className="text-sm text-destructive hover:underline underline-offset-2" onClick={() => setReportOpen(true)}>
        Something wrong?
      </button>
    </div>
  );

  let body: React.ReactNode = null;

  if (order.status === "disputed" || (hasDispute && ["completed", "refunded"].includes(order.status))) {
    body = (
      <DisputePanel orderId={order.id} role="buyer" storeName={storeName} timers={timers}
        items={items} subtotal={Number(order.subtotal_ksh)} onChanged={onChanged} />
    );
  } else if (order.status === "pending_vendor_confirmation") {
    body = <Step icon={<Clock size={18} />} title={`Waiting for ${storeName} to accept`} text="You've paid. Your money is held safely, and you're refunded automatically if they don't accept." />;
  } else if (order.status === "accepted") {
    if (checklist?.buyer_status === "pending") {
      body = (
        <div className="rounded-xl border border-primary/30 bg-primary-soft p-4 space-y-3">
          <div className="flex items-center gap-2"><Package size={18} className="text-primary-strong" /><p className="text-sm font-semibold">Check what's being sent</p></div>
          <ul className="text-sm space-y-0.5">
            {checklist.items.map((l) => (
              <li key={l.order_item_id}>• {l.quantity}× {l.name}{l.size ? `, size ${l.size}` : ""}{l.color ? `, ${l.color}` : ""}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">"{checklist.description}"</p>
          {objecting ? (
            <div className="space-y-2">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What's wrong? e.g. I ordered size 41" autoFocus />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={!!busy || note.trim().length < 3}
                  onClick={async () => { if (await run("respond_checklist", { approve: false, note: note.trim() }, `We've told ${storeName} to hold the package.`)) setObjecting(false); }}>
                  Stop the package
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setObjecting(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" disabled={!!busy} onClick={() => run("respond_checklist", { approve: true }, "Thanks!")}>Looks right</Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => { setNote(""); setObjecting(true); }}>This is wrong</Button>
            </div>
          )}
        </div>
      );
    } else if (checklist?.buyer_status === "objected") {
      body = <Step icon={<AlertTriangle size={18} />} title="Package on hold" text={`You said it isn't right. ${storeName} has been told to fix it before sending. Chat with them or call them if you need to.`} />;
    } else {
      body = <Step icon={<Package size={18} />} title={isPickup ? "Getting it ready for pickup" : `${storeName} is packing your order`}
        text={ship ? `It should be on its way by ${formatDue(ship.due_at)}. If not, you're refunded automatically.` : "We'll let you know when it's on the way."} />;
    }
  } else if (["shipped", "arrived", "delivered"].includes(order.status)) {
    const arrived = order.status !== "shipped";
    body = (
      <div className="space-y-3">
        {unavailable && (
          <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-4 space-y-2">
            <p className="text-sm font-semibold">The rider can't reach you</p>
            <p className="text-sm">Call {storeName}, or tap below so they can try again. If you don't respond by {formatDue(unavailable.due_at)}, the order is cancelled and you're refunded the item price.</p>
            <Button size="sm" disabled={!!busy} onClick={() => run("unavailable_reply", {}, `${storeName} has been told you're available.`)}>I'm available</Button>
          </div>
        )}
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            {arrived ? <Package size={18} className="mt-0.5 shrink-0" /> : <Truck size={18} className="mt-0.5 shrink-0" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{arrived ? (isPickup ? "Ready for pickup" : "Your order has arrived") : "On the way"}</p>
              <p className="text-sm text-muted-foreground">
                {!arrived && (deliver ? `Should reach you by ${formatDue(deliver.due_at)}.` : "It's been sent.")}
                {arrived && (isPickup ? "Collect it, check it, then confirm." : "Check it first, then confirm.")}
                {arrived && release && ` If you don't report a problem, ${storeName} is paid ${formatDue(release.due_at)}.`}
              </p>
            </div>
          </div>
          {arrived && order.delivery_otp && (
            <div className="flex items-center gap-3 rounded-lg bg-card border border-border px-3 py-2">
              <Lock size={16} className="text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Your code. Only share it once you've checked the item.</p>
                <p className="font-mono text-xl font-bold tracking-[0.3em]">{order.delivery_otp}</p>
              </div>
            </div>
          )}
          {gotItButtons}
        </div>
      </div>
    );
  }

  return (
    <>
      {body}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Is everything OK?</AlertDialogTitle>
            <AlertDialogDescription>
              Only confirm once you have the item and it's what you ordered. This pays {storeName}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction disabled={!!busy} onClick={async (e) => {
              e.preventDefault();
              if (await run("confirm_received")) {
                setConfirmOpen(false);
                celebrate({ title: "Order complete", subtitle: `Thanks! ${storeName} has been paid.`, cta: "Rate your order" });
                onConfirmed();
              }
            }}>
              {busy === "confirm_received" ? "Confirming..." : "Yes, pay the seller"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReportProblemDialog open={reportOpen} onOpenChange={setReportOpen} orderId={order.id} items={items}
        onReported={(next) => { toast.success("Problem reported. Your payment is on hold.", { description: next }); onChanged(); }} />
    </>
  );
}

function Step({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
