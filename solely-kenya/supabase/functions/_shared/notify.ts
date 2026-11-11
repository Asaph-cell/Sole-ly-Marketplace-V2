/**
 * One way to tell a buyer or vendor something about an order.
 *
 * Every dispute-system notice goes out by email, plus push and SMS when the
 * moment is urgent. Notification failures are logged, never thrown: a
 * missed email must not undo a refund or a release.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, baseEmailLayout, escapeHtml } from "./email-service.ts";
import { sendSms } from "./sms.ts";

export const SITE_URL = Deno.env.get("SITE_URL") || "https://solelymarketplace.com";

export interface OrderParties {
    orderId: string;
    shortId: string;
    customerId: string | null;
    vendorId: string;
    buyerName: string;
    buyerEmail: string | null;
    buyerPhone: string | null;
    storeName: string;
    vendorEmail: string | null;
    vendorPhone: string | null;
    items: string;
}

export async function loadParties(supabase: SupabaseClient, orderId: string): Promise<OrderParties> {
    const { data: order, error } = await supabase
        .from("orders")
        .select("id, customer_id, vendor_id, order_items(product_name, quantity), order_shipping_details(recipient_name, email, phone)")
        .eq("id", orderId)
        .single();
    if (error || !order) throw new Error(`Order not found: ${orderId}`);

    const shipping = Array.isArray(order.order_shipping_details)
        ? order.order_shipping_details[0]
        : order.order_shipping_details;

    let buyerEmail: string | null = shipping?.email ?? null;
    if (!buyerEmail && order.customer_id) {
        const { data } = await supabase.auth.admin.getUserById(order.customer_id);
        buyerEmail = data?.user?.email ?? null;
    }

    const { data: vendorAuth } = await supabase.auth.admin.getUserById(order.vendor_id);
    const { data: vendor } = await supabase
        .from("profiles")
        .select("store_name, full_name, whatsapp_number")
        .eq("id", order.vendor_id)
        .maybeSingle();

    return {
        orderId: order.id,
        shortId: order.id.slice(0, 8),
        customerId: order.customer_id,
        vendorId: order.vendor_id,
        buyerName: shipping?.recipient_name || "there",
        buyerEmail,
        buyerPhone: shipping?.phone ?? null,
        storeName: vendor?.store_name || vendor?.full_name || "Your seller",
        vendorEmail: vendorAuth?.user?.email ?? null,
        vendorPhone: vendor?.whatsapp_number ?? null,
        items: (order.order_items ?? []).map((i: { quantity: number; product_name: string }) => `${i.quantity}× ${i.product_name}`).join(", "),
    };
}

export interface Notice {
    subject: string;
    /** Headline inside the email; defaults to subject. */
    title?: string;
    /** Plain-text paragraphs; escaped before rendering. */
    lines: string[];
    ctaLabel?: string;
    /** Path on the site, e.g. "/orders/abc". Defaults to the right orders page. */
    ctaPath?: string;
    /** Also send a push notification. */
    push?: boolean;
    /** Also send this SMS text (keep under 160 chars). */
    sms?: string;
}

export async function notify(
    supabase: SupabaseClient,
    p: OrderParties,
    who: "buyer" | "vendor",
    n: Notice,
): Promise<void> {
    const email = who === "buyer" ? p.buyerEmail : p.vendorEmail;
    const userId = who === "buyer" ? p.customerId : p.vendorId;
    const phone = who === "buyer" ? p.buyerPhone : p.vendorPhone;
    const path = n.ctaPath ?? (who === "buyer" ? `/orders/${p.orderId}` : "/vendor/orders");
    const url = `${SITE_URL}${path}`;

    const tasks: Promise<unknown>[] = [];

    if (email) {
        const body = n.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")
            + `<p style="text-align:center;margin-top:28px;"><a href="${url}" class="cta-button">${escapeHtml(n.ctaLabel ?? "Open your order")}</a></p>`;
        tasks.push(
            sendEmail({ to: email, subject: n.subject, html: baseEmailLayout(n.title ?? n.subject, body) })
                .then((r) => { if (!r.success) console.error(`[Notify] Email to ${who} failed:`, r.error); }),
        );
    }

    if (n.push && userId) {
        tasks.push(
            fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                    userId,
                    title: n.title ?? n.subject,
                    body: n.lines[0] ?? "",
                    url: path,
                    tag: `order-${p.orderId}`,
                    orderId: p.orderId,
                }),
            }).catch((err) => console.error(`[Notify] Push to ${who} failed:`, err)),
        );
    }

    if (n.sms) tasks.push(sendSms(phone, n.sms));

    await Promise.allSettled(tasks);
}

/**
 * Posts a message into the buyer-vendor chat the app already has, so order
 * updates (packing checklist, "goods are coming") sit next to the rest of
 * their conversation. Creates the conversation if they've never chatted.
 */
export async function postOrderChat(
    supabase: SupabaseClient,
    p: OrderParties,
    from: "buyer" | "vendor",
    text: string,
    metadata: Record<string, unknown> = {},
): Promise<void> {
    if (!p.customerId) return;
    try {
        let { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("buyer_id", p.customerId)
            .eq("vendor_id", p.vendorId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!conv) {
            const { data: created, error } = await supabase
                .from("conversations")
                .insert({ buyer_id: p.customerId, vendor_id: p.vendorId })
                .select("id")
                .single();
            if (error) throw error;
            conv = created;
        }

        const { error: msgError } = await supabase.from("messages").insert({
            conversation_id: conv!.id,
            sender_id: from === "vendor" ? p.vendorId : p.customerId,
            sender_role: from === "vendor" ? "vendor" : "user",
            message: text,
            message_type: "order_update",
            metadata: { order_id: p.orderId, ...metadata },
        });
        if (msgError) throw msgError;

        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conv!.id);
    } catch (err) {
        console.error("[Notify] Couldn't post order chat message:", err);
    }
}
