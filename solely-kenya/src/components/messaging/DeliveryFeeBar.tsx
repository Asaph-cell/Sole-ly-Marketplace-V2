import { useState } from "react";
import { Link } from "react-router-dom";
import { Truck, Handshake, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { DELIVERY_METHODS, PICKUP_METHOD, proposeDeliveryFee, acceptDeliveryFee } from "@/lib/deliveryAgreement";

export type Agreement = {
  id: string;
  conversation_id: string;
  vendor_id: string;
  buyer_id: string;
  delivery_fee_ksh: number;
  delivery_method: string | null;
  status: string;
  proposed_by: string | null;
};

const feeText = (fee: number, method: string | null) =>
  method === PICKUP_METHOD ? "Pick up, no fee" : `KES ${Number(fee).toLocaleString()}${method ? ` · ${method}` : ""}`;

// Pinned at the top of a delivery conversation: the delivery fee is what the
// chat has to settle, so its state and the next action are always in view.
export const DeliveryFeeBar = ({ agreement, userId }: { agreement: Agreement; userId: string }) => {
  const [proposing, setProposing] = useState(false);
  const [fee, setFee] = useState("");
  const [method, setMethod] = useState("");
  const [busy, setBusy] = useState(false);

  const isVendor = userId === agreement.vendor_id;
  const isBuyer = userId === agreement.buyer_id;
  const agreed = agreement.status === "agreed";
  const hasOffer = !!agreement.proposed_by;
  const offerIsMine = agreement.proposed_by === userId;
  const canAccept = hasOffer && !offerIsMine && agreement.status === "negotiating";
  const detailsUrl = `/delivery-negotiation?agreementId=${agreement.id}`;

  const send = async () => {
    const isPickup = method === PICKUP_METHOD;
    const amount = isPickup ? 0 : parseFloat(fee);
    if (!method) return toast.error("Choose how it will be delivered");
    if (!isPickup && (isNaN(amount) || amount < 0)) return toast.error("Enter the delivery fee");
    setBusy(true);
    try {
      await proposeDeliveryFee(agreement, userId, amount, method);
      setProposing(false); setFee(""); setMethod("");
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    setBusy(true);
    try {
      await acceptDeliveryFee(agreement, userId, agreement.delivery_fee_ksh, agreement.delivery_method);
      toast.success(isBuyer ? "Delivery fee agreed. You can check out now." : "Delivery fee agreed. The buyer can check out.");
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-border bg-cream/70 px-3 py-2.5 sm:px-4">
      <div className="flex flex-nowrap items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${agreed ? "bg-[#1a5138] text-white" : "bg-foreground text-background"}`}>
          {agreed ? <Handshake size={17} /> : <Truck size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {agreed ? "Delivery fee agreed" : agreement.status === "used" ? "Order placed" : agreement.status === "expired" ? "Offer expired" : hasOffer ? (offerIsMine ? "Your offer, waiting for reply" : `Offer from the ${isVendor ? "buyer" : "seller"}`) : "Delivery fee not agreed yet"}
          </p>
          <p className="truncate text-sm font-semibold">
            {hasOffer || agreed ? feeText(agreement.delivery_fee_ksh, agreement.delivery_method) : "Agree it here before checkout"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canAccept && (
            <Button size="sm" onClick={accept} disabled={busy} className="h-9 rounded-full px-4">
              {busy ? <Loader2 size={14} className="animate-spin" /> : "Accept"}
            </Button>
          )}
          {agreement.status === "negotiating" && !proposing && (
            <Button size="sm" variant="outline" onClick={() => setProposing(true)} className="h-9 rounded-full px-3.5 bg-background">
              {hasOffer ? "Counter" : "Propose fee"}
            </Button>
          )}
          {agreed && isBuyer && (
            <Button size="sm" asChild className="h-9 rounded-full px-4">
              <Link to={detailsUrl}>Checkout</Link>
            </Button>
          )}
          <Link to={detailsUrl} aria-label="Delivery details" className="grid h-9 w-7 place-items-center text-foreground/50 hover:text-foreground">
            <ChevronRight size={18} />
          </Link>
        </div>
      </div>

      {proposing && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
            aria-label="Delivery method"
          >
            <option value="">How will it be delivered?</option>
            {DELIVERY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {method !== PICKUP_METHOD && (
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="Fee (KES)"
              aria-label="Delivery fee in KES"
              className="h-10 w-28 rounded-xl border border-border bg-background px-3 text-sm"
            />
          )}
          <Button size="sm" onClick={send} disabled={busy} className="h-10 rounded-full px-4">
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Send offer"}
          </Button>
          <button type="button" onClick={() => setProposing(false)} className="h-10 px-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
