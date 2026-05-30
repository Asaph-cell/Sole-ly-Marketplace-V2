/**
 * Notify Dispute Filed
 * 
 * Sends email notifications when a NEW dispute is filed.
 * Notifies the Buyer (confirmation), Vendor (alert), and Support team (action required).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, emailTemplates } from "../_shared/email-service.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Support email address
const SUPPORT_EMAIL = "solely.kenya@gmail.com";
const ADMIN_DISPUTES_URL = "https://solelymarketplace.com/admin/disputes";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { disputeId } = body;

        if (!disputeId) {
            return new Response(
                JSON.stringify({ error: "Missing disputeId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Fetch dispute details with order, customer, and vendor info
        const { data: dispute, error: disputeError } = await supabase
            .from("disputes")
            .select(`
                *,
                orders (
                    id,
                    total_ksh,
                    order_items (product_name),
                    order_shipping_details(recipient_name, email)
                ),
                buyer:customer_id (id, email, full_name),
                vendor:vendor_id (id, email, full_name, store_name)
            `)
            .eq("id", disputeId)
            .single();

        if (disputeError || !dispute) {
            return new Response(
                JSON.stringify({ error: "Dispute not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const order = dispute.orders;
        const buyer = dispute.buyer; // Customer profile
        const vendor = dispute.vendor; // Vendor profile

        // Determine emails
        let buyerEmail = order?.order_shipping_details?.email || buyer?.email;
        let vendorEmail = vendor?.email;

        // Use auth admin as fallback if profile emails missing
        if (!buyerEmail && dispute.customer_id) {
            const { data: u } = await supabase.auth.admin.getUserById(dispute.customer_id);
            buyerEmail = u.user?.email;
        }
        if (!vendorEmail && dispute.vendor_id) {
            const { data: u } = await supabase.auth.admin.getUserById(dispute.vendor_id);
            vendorEmail = u.user?.email;
        }

        const buyerName = order?.order_shipping_details?.recipient_name || buyer?.full_name || "Customer";
        const vendorName = vendor?.store_name || vendor?.full_name || "Vendor";
        const orderAmount = order?.total_ksh || 0;
        const buyerEvidenceUrls = dispute.buyer_evidence_urls || [];

        // Format dispute reason for display
        const reasonLabels: Record<string, string> = {
            no_delivery: "Did not receive item",
            wrong_item: "Received wrong item",
            damaged: "Item arrived damaged",
            other: "Other issue",
        };
        const formattedReason = reasonLabels[dispute.reason] || dispute.reason;

        const emailPromises = [];

        // 1. Email Buyer (Confirmation)
        if (buyerEmail) {
            emailPromises.push(sendEmail({
                to: buyerEmail,
                subject: `⚠️ Dispute Submitted - Order #${dispute.order_id.slice(0, 8)}`,
                html: emailTemplates.disputeFiled({
                    userName: buyerName,
                    orderId: dispute.order_id.slice(0, 8),
                    reason: formattedReason,
                    description: dispute.description,
                    isVendor: false
                }),
            }));
        }

        // 2. Email Vendor (Alert)
        if (vendorEmail) {
            emailPromises.push(sendEmail({
                to: vendorEmail,
                subject: `⚠️ ACTION REQUIRED: Dispute Filed on Order #${dispute.order_id.slice(0, 8)}`,
                html: emailTemplates.disputeFiled({
                    userName: vendorName, // addressing the vendor
                    orderId: dispute.order_id.slice(0, 8),
                    reason: formattedReason,
                    description: dispute.description,
                    isVendor: true
                }),
            }));

            // In-app notification for vendor
            await supabase.from("notifications").insert({
                user_id: dispute.vendor_id,
                type: "dispute_filed",
                title: "New Dispute Filed",
                message: `Buyer filed a dispute for Order #${dispute.order_id.slice(0, 8)}. Reason: ${formattedReason}`,
                related_id: disputeId
            }).catch(e => console.error("Vendor notification error", e));
        }

        // 3. Email Support Team (Admin notification with full details)
        emailPromises.push(sendEmail({
            to: SUPPORT_EMAIL,
            subject: `🚨 NEW DISPUTE: Order #${dispute.order_id.slice(0, 8)} - ${formattedReason}`,
            html: emailTemplates.disputeFiledAdmin({
                orderId: dispute.order_id.slice(0, 8),
                buyerName: buyerName,
                buyerEmail: buyerEmail || "Unknown",
                vendorName: vendorName,
                vendorEmail: vendorEmail || "Unknown",
                reason: formattedReason,
                description: dispute.description,
                orderAmount: orderAmount,
                evidenceUrls: buyerEvidenceUrls,
                adminUrl: ADMIN_DISPUTES_URL,
            }),
        }));

        const results = await Promise.all(emailPromises);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Dispute notifications sent (buyer, vendor, and support)",
                results
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

