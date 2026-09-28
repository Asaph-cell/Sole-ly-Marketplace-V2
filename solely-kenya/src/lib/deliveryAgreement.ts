import { supabase } from "@/integrations/supabase/client";

// Shared by the in-chat delivery fee bar and the full negotiation page, so a
// proposal or acceptance behaves the same wherever it's made.

// Collecting it yourself has no delivery fee by definition, so the amount
// field is skipped for pickup.
export const PICKUP_METHOD = "Pick Up";

export const DELIVERY_METHODS = [
  "Boda Boda",
  "G4S",
  "Personal Delivery",
  "Matatu/Bus Parcel",
  "Courier Service",
  PICKUP_METHOD,
  "Other",
];

export type AgreementLike = {
  id: string;
  conversation_id: string;
  vendor_id: string;
  buyer_id: string;
  delivery_method: string | null;
};

export const proposeDeliveryFee = async (
  agreement: AgreementLike,
  userId: string,
  fee: number,
  method: string | null,
) => {
  const isPickup = method === PICKUP_METHOD;
  const amount = isPickup ? 0 : fee;
  const isVendor = userId === agreement.vendor_id;

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: agreement.conversation_id,
    sender_id: userId,
    sender_role: isVendor ? "vendor" : "user",
    message: isPickup
      ? "Proposed pick up, no delivery fee"
      : `Proposed delivery fee: KES ${amount.toLocaleString()}${method ? ` via ${method}` : ""}`,
    message_type: "delivery_proposal",
    metadata: { delivery_fee: amount, delivery_method: method || null },
  });
  if (msgErr) throw msgErr;

  const { error } = await supabase
    .from("delivery_agreements")
    .update({
      delivery_fee_ksh: amount,
      delivery_method: method || agreement.delivery_method,
      proposed_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agreement.id);
  if (error) throw error;

  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", agreement.conversation_id);
};

export const acceptDeliveryFee = async (
  agreement: AgreementLike,
  userId: string,
  fee: number,
  method: string | null,
) => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("delivery_agreements")
    .update({
      status: "agreed",
      delivery_fee_ksh: fee,
      delivery_method: method || agreement.delivery_method,
      agreed_at: now,
      updated_at: now,
    })
    .eq("id", agreement.id);
  if (error) throw error;

  const isVendor = userId === agreement.vendor_id;
  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: agreement.conversation_id,
    sender_id: userId,
    sender_role: isVendor ? "vendor" : "user",
    message: `Delivery fee agreed: KES ${fee.toLocaleString()}${method ? ` via ${method}` : ""}`,
    message_type: "delivery_accepted",
    metadata: { delivery_fee: fee, delivery_method: method },
  });
  if (msgErr) throw msgErr;

  await supabase.from("conversations").update({ updated_at: now }).eq("id", agreement.conversation_id);
};
