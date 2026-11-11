/**
 * Client side of the dispute & delivery system (docs/DISPUTE_SYSTEM_SPEC.md).
 *
 * Every order button calls orderAction(), which runs the matching rule on
 * the server (order-action edge function). The hooks below read the
 * order's live clocks, packing checklist and dispute so each screen can
 * show just the one next step.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { edgeErrorMessage } from "@/lib/edgeError";

// The new tables aren't in the generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type OrderActionName =
  | "accept" | "decline" | "submit_checklist" | "ship" | "arrived" | "send_update"
  | "buyer_unavailable" | "make_offer" | "fix_sent" | "confirm_return" | "reject_return"
  | "confirm_received" | "report_problem" | "respond_checklist" | "respond_offer"
  | "handed_back" | "fix_result" | "missing_choice" | "refund_now" | "unavailable_reply"
  | "escalate" | "appeal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function orderAction<T = Record<string, any>>(
  action: OrderActionName,
  orderId: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("order-action", { body: { action, orderId, ...params } });
  if (error) throw new Error(await edgeErrorMessage(error, "Something went wrong. Please try again."));
  if (data && data.success === false) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

// ── Types ──────────────────────────────────────────────────────────────────

export type TimerKind =
  | "ship" | "deliver" | "release" | "checklist_hold" | "vendor_response"
  | "negotiation" | "fix" | "return_confirm" | "buyer_unavailable";

export interface OrderTimer {
  id: string;
  order_id: string;
  kind: TimerKind;
  due_at: string;
  extensions: number;
  meta: Record<string, unknown>;
}

export interface ChecklistLine {
  order_item_id: string;
  name: string;
  quantity: number;
  size: string | null;
  color: string | null;
}

export interface PackingChecklist {
  order_id: string;
  items: ChecklistLine[];
  description: string;
  photo_path: string | null;
  buyer_status: "pending" | "approved" | "objected" | "timed_out";
  buyer_note: string | null;
}

export type DisputeStage =
  | "negotiating" | "awaiting_fix" | "fix_sent" | "awaiting_return"
  | "return_handed" | "buyer_choice" | "with_admin" | "resolved";

export interface DisputeOffer {
  id: string;
  made_by: "vendor" | "buyer";
  kind: "partial_refund" | "replacement" | "refund_with_return";
  amount_ksh: number | null;
  note: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
  created_at: string;
}

export interface DisputeInfo {
  id: string;
  order_id: string;
  dispute_type: string | null;
  description: string | null;
  stage: DisputeStage;
  status: string;
  outcome: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  appeal_requested_at: string | null;
  missing_item_ids: string[] | null;
  offers: DisputeOffer[];
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Live clocks for a set of orders, keyed by order id. Pass the orders
 * array as refreshKey so a reload of the orders also reloads their clocks.
 */
export function useOrderTimers(orderIds: string[], refreshKey?: unknown) {
  const key = [...orderIds].sort().join(",");
  const [timers, setTimers] = useState<Record<string, OrderTimer[]>>({});

  const load = useCallback(async () => {
    if (!orderIds.length) { setTimers({}); return; }
    const { data } = await db
      .from("order_timers")
      .select("id, order_id, kind, due_at, extensions, meta")
      .in("order_id", orderIds)
      .eq("status", "active");
    const grouped: Record<string, OrderTimer[]> = {};
    for (const t of (data ?? []) as OrderTimer[]) (grouped[t.order_id] ??= []).push(t);
    setTimers(grouped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  useEffect(() => { load(); }, [load]);
  return { timers, reload: load };
}

export function timerOf(timers: OrderTimer[] | undefined, kind: TimerKind): OrderTimer | undefined {
  return timers?.find((t) => t.kind === kind);
}

export function usePackingChecklists(orderIds: string[], refreshKey?: unknown) {
  const key = [...orderIds].sort().join(",");
  const [checklists, setChecklists] = useState<Record<string, PackingChecklist>>({});

  const load = useCallback(async () => {
    if (!orderIds.length) { setChecklists({}); return; }
    const { data } = await db.from("order_packing_checklists").select("*").in("order_id", orderIds);
    const byOrder: Record<string, PackingChecklist> = {};
    for (const c of (data ?? []) as PackingChecklist[]) byOrder[c.order_id] = c;
    setChecklists(byOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  useEffect(() => { load(); }, [load]);
  return { checklists, reload: load };
}

export function useDispute(orderId: string | null) {
  const [dispute, setDispute] = useState<DisputeInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderId) { setDispute(null); setLoading(false); return; }
    const { data } = await db
      .from("disputes")
      .select("id, order_id, dispute_type, description, stage, status, outcome, resolution_notes, resolved_at, resolved_by, appeal_requested_at, missing_item_ids, dispute_offers(id, made_by, kind, amount_ksh, note, status, created_at)")
      .eq("order_id", orderId)
      .maybeSingle();
    if (data) {
      const { dispute_offers, ...rest } = data;
      setDispute({
        ...rest,
        offers: ((dispute_offers ?? []) as DisputeOffer[]).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      });
    } else {
      setDispute(null);
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
    if (!orderId) return;
    const channel = supabase
      .channel(`dispute-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes", filter: `order_id=eq.${orderId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "dispute_offers" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, load]);

  return { dispute, loading, reload: load };
}

// ── Formatting ─────────────────────────────────────────────────────────────

/** "today 2:30pm", "tomorrow 9:00am", "Fri 10 Oct, 4:00pm" in Kenya time. */
export function formatDue(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const tz = "Africa/Nairobi";
  const time = d.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz })
    .replace(/\s/g, "").toLowerCase();
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  const tomorrow = new Date(now.getTime() + 24 * 3600_000);
  if (day(d) === day(now)) return `today ${time}`;
  if (day(d) === day(tomorrow)) return `tomorrow ${time}`;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}, ${time}`;
}

export const ksh = (n: number | null | undefined) => `KES ${Math.round(Number(n ?? 0)).toLocaleString()}`;

export const PROBLEM_OPTIONS = [
  { value: "item_not_received", label: "I didn't get it", hint: "The seller says it arrived, but you don't have it" },
  { value: "wrong_item", label: "Wrong item, size or colour", hint: "Not what you ordered" },
  { value: "item_broken", label: "Damaged or not working", hint: "Broken, torn, spoiled or faulty" },
  { value: "not_as_advertised", label: "Not as described", hint: "Different from the listing photos or details" },
  { value: "missing_items", label: "Something's missing", hint: "Part of your order didn't come" },
  { value: "wrong_order", label: "This is someone else's order", hint: "You got another buyer's package" },
  { value: "other", label: "Something else", hint: "Tell us what happened" },
] as const;

export type ProblemCategory = (typeof PROBLEM_OPTIONS)[number]["value"];

export const problemLabel = (category: string | null | undefined) =>
  PROBLEM_OPTIONS.find((o) => o.value === category)?.label ?? "Problem";

export function offerText(o: Pick<DisputeOffer, "kind" | "amount_ksh">): string {
  if (o.kind === "partial_refund") return `${ksh(o.amount_ksh)} back, keep the item`;
  if (o.kind === "replacement") return "A replacement";
  return "Full refund after the item is collected";
}
