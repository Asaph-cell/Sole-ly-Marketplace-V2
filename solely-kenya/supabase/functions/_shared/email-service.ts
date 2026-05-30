/**
 * Email Service for Supabase Edge Functions
 * 
 * Uses Resend API for sending emails.
 * 
 * Setup:
 * 1. Create account at https://resend.com
 * 2. Get API key and add to Supabase secrets:
 *    npx supabase secrets set RESEND_API_KEY=re_xxxxx
 * 3. Verify your domain or use onboarding@resend.dev for testing
 */

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Normalize Kenyan phone number to international format (254...)
 * Handles: 07xxx → 2547xxx, +254xxx → 254xxx, 254xxx → 254xxx
 */
function normalizeKenyanPhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters
  let digits = phone.replace(/[^0-9]/g, '');

  // Handle 254 prefix (strip it first to normalize)
  if (digits.startsWith('254')) {
    digits = digits.slice(3);
  }

  // Handle 0 prefix (e.g. 07... or 01...)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Ensure we have a valid length (optional, but good for sanity)
  // Standard kenyan number without prefix is 9 digits (e.g. 712345678)

  // Re-add 254
  return '254' + digits;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set - email not sent");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: options.from || "Solely <notifications@solelymarketplace.com>",
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      return { success: false, error: data.message || "Failed to send email" };
    }

    console.log("Email sent successfully:", data.id);
    return { success: true, id: data.id };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Email templates
export const emailTemplates = {
  vendorNewOrder: (data: {
    businessName: string;
    orderId: string;
    items: string;
    total: number;
    deliveryLocation: string;
    customerName: string;
    dashboardUrl: string;
    googleMapsLink?: string | null;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .maps-button { display: inline-block; background: #10b981; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; border-radius: 6px; margin-top: 15px; }
        .gps-box { background: #d1fae5; border: 2px solid #10b981; padding: 12px; border-radius: 6px; margin-top: 15px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🛒 New Order Received!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.businessName},</p>
          <p>Great news! You have a new order waiting for your confirmation.</p>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
            <p><strong>Total:</strong> KES ${data.total.toLocaleString()}</p>
            <p><strong>Delivery to:</strong> ${data.deliveryLocation}</p>
            <p><strong>Customer:</strong> ${data.customerName}</p>
          </div>
          
          ${data.googleMapsLink ? `
          <div class="gps-box">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #065f46;"><strong>📍 GPS Location Available</strong></p>
            <p style="margin: 0 0 10px 0; font-size: 13px; color: #047857;">The customer pinned their exact delivery location:</p>
            <a href="${data.googleMapsLink}" class="maps-button" style="color: white !important; text-decoration: none;">
              🗺️ Open in Google Maps
            </a>
          </div>
          ` : ''}
          
          <a href="${data.dashboardUrl}" class="cta-button">View Order & Respond</a>
          
          <div class="warning">
            <strong>⏰ Important:</strong> Please respond within 48 hours or the order will be automatically cancelled and refunded.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message from Solely</p>
          <p style="font-size: 11px; color: #9ca3af;">This email cannot be replied to. For support, visit <a href="https://solelymarketplace.com/contact" style="color: #6b7280;">solelymarketplace.com/contact</a></p>
        </div>
      </div>
    </body>
    </html>
  `,

  vendorMissedOrder: (data: {
    businessName: string;
    orderId: string;
    items: string;
    total: number;
    customerName: string;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb; }
        .warning-box { background: #fef2f2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .reputation-box { background: #fffbeb; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .cta-button { display: inline-block; background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 15px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">⚠️ Missed Order Alert</h1>
        </div>
        <div class="content">
          <p>Hi ${data.businessName},</p>
          <p>We're reaching out because you did not respond to an order within the required 48-hour window.</p>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
            <p><strong>Value:</strong> KES ${data.total.toLocaleString()}</p>
            <p><strong>Customer:</strong> ${data.customerName}</p>
          </div>
          
          <div class="warning-box">
            <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>❌ Order Cancelled & Customer Refunded</strong></p>
            <p style="margin: 0;">Because you didn't respond in time, this order has been automatically cancelled and the customer has received a full refund.</p>
          </div>
          
          <div class="reputation-box">
            <p style="margin: 0 0 10px 0;"><strong>⚡ This Affects Your Reputation</strong></p>
            <p style="margin: 0; font-size: 14px;">Missed orders negatively impact your seller rating and may affect your visibility on Solely. Customers trust vendors who respond quickly and reliably.</p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
              <li>Respond to orders within 24 hours for best results</li>
              <li>Enable push notifications to never miss an order</li>
              <li>Check your dashboard regularly</li>
            </ul>
          </div>
          
          <p style="margin-top: 20px;">We understand things happen. If you need to pause your store temporarily, you can do so from your vendor dashboard.</p>
          
          <div style="text-align: center;">
            <a href="https://solelymarketplace.com/vendor/orders" class="cta-button">View Your Dashboard</a>
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message from Solely</p>
          <p>Questions? Contact us at support@solelymarketplace.com</p>
        </div>
      </div>
    </body>
    </html>
  `,

  buyerOrderDeclined: (data: {
    customerName: string;
    orderId: string;
    items: string;
    total: number;
    vendorName: string;
    reason?: string;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .refund-notice { background: #d1fae5; border: 1px solid #10b981; padding: 12px; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Order Update</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>We're sorry to inform you that your order could not be fulfilled by the vendor.</p>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
            <p><strong>Amount:</strong> KES ${data.total.toLocaleString()}</p>
            <p><strong>Vendor:</strong> ${data.vendorName}</p>
            ${data.reason ? `<p><strong>Reason:</strong> ${{
      'out_of_stock': 'Item is out of stock',
      'wrong_size': 'Size not available',
      'pricing_error': 'Pricing error',
      'cannot_deliver': 'Cannot deliver to your location',
      'damaged_item': 'Item is damaged',
      'other': 'Other reason'
    }[data.reason] || data.reason}</p>` : ''}
          </div>
          
          <div class="refund-notice">
            <strong>✅ Refund Initiated:</strong> Your payment of KES ${data.total.toLocaleString()} will be refunded to your original payment method within 3-5 business days.
          </div>
          
          <p style="margin-top: 20px;">We apologize for any inconvenience. Please feel free to explore other products on Solely!</p>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
          <p>If you have questions about your refund, please contact support.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  buyerOrderAutoDeclined: (data: {
    customerName: string;
    orderId: string;
    items: string;
    total: number;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb; }
        .refund-notice { background: #d1fae5; border: 2px solid #10b981; padding: 15px; border-radius: 8px; margin-top: 15px; }
        .security-notice { background: #dbeafe; border: 1px solid #3b82f6; padding: 12px; border-radius: 6px; margin-top: 15px; }
        .cta-button { display: inline-block; background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin-top: 15px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Order Update</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>We're sorry to let you know that the vendor was unable to accept your order within the required 48-hour window.</p>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
            <p><strong>Amount:</strong> KES ${data.total.toLocaleString()}</p>
          </div>
          
          <div class="refund-notice">
            <p style="margin: 0 0 10px 0; font-size: 18px;"><strong>💰 Full Refund Processed</strong></p>
            <p style="margin: 0;">Your payment of <strong>KES ${data.total.toLocaleString()}</strong> has been refunded to your M-Pesa. You should receive it within minutes.</p>
          </div>
          
          <div class="security-notice">
            <p style="margin: 0;"><strong>🔒 Your Money is Safe</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">At Solely, we take your financial security seriously. When a vendor fails to respond, we automatically protect your funds by issuing an immediate refund.</p>
          </div>
          
          <p style="margin-top: 20px;">We've also notified the vendor about this missed order. In the meantime, we encourage you to explore other amazing products from our trusted sellers!</p>
          
          <div style="text-align: center;">
            <a href="https://solelymarketplace.com/shop" class="cta-button">Continue Shopping</a>
          </div>
          
          <p style="margin-top: 25px; font-size: 14px; color: #6b7280;">Thank you for choosing Solely. We're committed to giving you the best shopping experience!</p>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
          <p>Questions? Contact us at support@solelymarketplace.com</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Order Placed Confirmation
  buyerOrderPlaced: (data: {
    customerName: string;
    orderId: string;
    items: string;
    total: number;
    deliveryType: string;
    isPickup?: boolean;
    orderTrackingUrl: string;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .status-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 12px; border-radius: 20px; font-size: 14px; }
        .cta-button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .next-steps { background: #e0f2fe; border: 1px solid #0284c7; padding: 12px; border-radius: 6px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🎉 Order Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Thank you for your order! Your payment has been received and your order is now being processed.</p>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
            <p><strong>Total:</strong> KES ${data.total.toLocaleString()}</p>
            <p><strong>Delivery:</strong> ${data.deliveryType}</p>
            <p><span class="status-badge">⏳ Awaiting Vendor Confirmation</span></p>
          </div>
          
          <div class="next-steps">
            <strong>What happens next?</strong>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Vendor reviews and confirms your order (within 48 hours)</li>
              ${data.isPickup
      ? `<li>Vendor prepares your order for pickup</li>
                   <li>You'll be notified when it's ready to collect</li>
                   <li>Collect your order and confirm pickup</li>`
      : `<li>Vendor ships your order and provides tracking</li>
                   <li>You receive and confirm delivery</li>`
    }
              <li>Payment is released to vendor</li>
            </ol>
          </div>
          
          <a href="${data.orderTrackingUrl}" class="cta-button">Track Your Order</a>
          
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">Your payment is protected by our escrow system. Funds are only released to the vendor after you confirm ${data.isPickup ? 'pickup' : 'delivery'}.</p>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
          <p>Questions? Reply to this email or contact support.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Order Accepted by Vendor
  buyerOrderAccepted: (data: {
    customerName: string;
    orderId: string;
    items: string;
    vendorName: string;
    estimatedDate: string;
    isPickup?: boolean;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .status-badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 6px 12px; border-radius: 20px; font-size: 14px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">✅ Order Accepted!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Great news! <strong>${data.vendorName}</strong> has accepted your order and is ${data.isPickup ? 'preparing it for pickup' : 'preparing it for shipment'}.</p>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
            <p><strong>Vendor:</strong> ${data.vendorName}</p>
            <p><strong>${data.isPickup ? 'Expected ready by' : 'Expected to ship by'}:</strong> ${data.estimatedDate}</p>
            <p><span class="status-badge">📦 ${data.isPickup ? 'Preparing for Pickup' : 'Preparing for Shipment'}</span></p>
          </div>
          
          <p>You'll receive another email ${data.isPickup ? 'when your order is ready for collection' : 'with tracking information once your order ships'}.</p>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Order Shipped with Tracking
  buyerOrderShipped: (data: {
    customerName: string;
    orderId: string;
    items: string;
    vendorName: string;
    courierName: string;
    trackingNumber: string;
    deliveryNotes: string;
    orderTrackingUrl: string;
    deliveryOtp?: string;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .tracking-box { background: #fef3c7; border: 2px dashed #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center; }
        .tracking-number { font-size: 24px; font-weight: bold; color: #92400e; letter-spacing: 2px; }
        .otp-box { background: #dbeafe; border: 3px solid #2563eb; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; }
        .otp-code { font-size: 36px; font-weight: bold; color: #1d4ed8; letter-spacing: 8px; font-family: monospace; }
        .status-badge { display: inline-block; background: #ede9fe; color: #5b21b6; padding: 6px 12px; border-radius: 20px; font-size: 14px; }
        .cta-button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .important-notice { background: #fee2e2; border: 1px solid #dc2626; padding: 12px; border-radius: 6px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🚚 Your Order Is On The Way!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Your order from <strong>${data.vendorName}</strong> is on its way!</p>
          
          ${data.deliveryOtp ? `
          <div class="otp-box">
            <p style="margin: 0 0 10px 0; font-size: 16px; color: #1e40af;"><strong>🔐 Your Delivery Code</strong></p>
            <p class="otp-code">${data.deliveryOtp}</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">
              <strong>Share this code with the vendor when they deliver.</strong><br>
              This confirms you received your order and releases payment.
            </p>
          </div>
          ` : ''}
          
          <div class="tracking-box">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Tracking Number</p>
            <p class="tracking-number">${data.trackingNumber}</p>
            <p style="margin: 0; font-size: 14px;">via <strong>${data.courierName}</strong></p>
          </div>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
            ${data.deliveryNotes ? `<p><strong>Delivery Notes:</strong> ${data.deliveryNotes}</p>` : ''}
            <p><span class="status-badge">🚚 Being Delivered</span></p>
          </div>
          
          <a href="${data.orderTrackingUrl}" class="cta-button">Track Your Order</a>
          
          <div class="important-notice">
            <strong>⚠️ Important:</strong> When the vendor delivers your order, share your 6-digit delivery code with them. This confirms you received your shoes and releases their payment.
          </div>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
          <p>Questions? Reply to this email or contact support.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Pickup Ready Notification
  buyerPickupReady: (data: {
    customerName: string;
    orderId: string;
    items: string;
    vendorName: string;
    vendorAddress: string;
    vendorPhone: string;
    vendorWhatsApp: string;
    deliveryOtp?: string;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .location-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .otp-box { background: #dbeafe; border: 3px solid #2563eb; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; }
        .otp-code { font-size: 36px; font-weight: bold; color: #1d4ed8; letter-spacing: 8px; font-family: monospace; }
        .contact-buttons { display: block; margin-top: 15px; text-align: center; }
        .contact-button { 
          display: inline-block; 
          color: #ffffff !important; 
          padding: 14px 28px; 
          text-decoration: none; 
          border-radius: 8px; 
          text-align: center; 
          font-weight: bold; 
          font-size: 16px;
          margin: 5px;
          min-width: 140px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .whatsapp-btn { background-color: #25D366; border: 1px solid #20bd5a; text-shadow: 0 1px 1px rgba(0,0,0,0.1); }
        .phone-btn { background-color: #2563eb; border: 1px solid #1d4ed8; text-shadow: 0 1px 1px rgba(0,0,0,0.1); }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">📦 Your Order is Ready for Pickup!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Great news! Your order from <strong>${data.vendorName}</strong> is ready for collection.</p>
          
          ${data.deliveryOtp ? `
          <div class="otp-box">
            <p style="margin: 0 0 10px 0; font-size: 16px; color: #1e40af;"><strong>🔐 Your Pickup Code</strong></p>
            <p class="otp-code">${data.deliveryOtp}</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">
              <strong>Show this code to the vendor when you collect your order.</strong><br>
              This confirms you received your shoes and releases payment.
            </p>
          </div>
          ` : ''}
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
          </div>
          
          <div class="location-box">
            <p><strong>📍 Pickup Location:</strong></p>
            <p style="font-size: 16px; margin: 10px 0;">${data.vendorAddress}</p>
          </div>
          
          <p>Please contact the seller to arrange the exact pickup time:</p>
          
          <div class="contact-buttons">
            <a href="https://wa.me/${normalizeKenyanPhone(data.vendorWhatsApp)}" class="contact-button whatsapp-btn" style="color: #ffffff !important; text-decoration: none;">
              💬 WhatsApp
            </a>
            <a href="tel:+${normalizeKenyanPhone(data.vendorPhone)}" class="contact-button phone-btn" style="color: #ffffff !important; text-decoration: none;">
              📞 Call Seller
            </a>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
            <strong>Important:</strong> When you collect your order, show your 6-digit code to the vendor. This confirms you received your shoes and releases their payment.
          </p>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Order Completed - Review Request
  buyerOrderCompleted: (data: {
    customerName: string;
    orderId: string;
    items: string;
    reviewUrl: string;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .cta-button { display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">✅ Order Completed - Thank You!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Your order has been completed successfully! We hope you love your purchase.</p>
          
          <div class="order-details">
            <p><strong>Order #${data.orderId}</strong></p>
            <p><strong>Items:</strong> ${data.items}</p>
          </div>
          
          <p><strong>How was your experience?</strong></p>
          <p>Your feedback helps other buyers make informed decisions and helps vendors improve their service.</p>
          
          <div style="text-align: center;">
            <a href="${data.reviewUrl}" class="cta-button">Leave a Review</a>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">Thank you for shopping with Solely!</p>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Vendor Payment Released
  vendorPaymentReleased: (data: {
    vendorName: string;
    orderId: string;
    payoutAmount: number;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .payment-box { background: #d1fae5; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 15px 0; text-align: center; }
        .amount { font-size: 36px; font-weight: bold; color: #059669; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">💰 Payment Released!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.vendorName},</p>
          <p>Great news! The buyer has confirmed delivery for order #${data.orderId}.</p>
          
          <div class="payment-box">
            <p style="margin: 0 0 10px 0; color: #6b7280;">Funds Released</p>
            <p class="amount">KES ${data.payoutAmount.toLocaleString()}</p>
          </div>
          
          <p>The funds have been released from escrow and will be processed for payout according to your payment schedule.</p>
          <p style="font-size: 14px; color: #6b7280;">Thank you for providing excellent service to your buyers!</p>
        </div>
        <div class="footer">
          <p>This email was sent by Solely</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Dispute Filed
  disputeFiled: (data: {
    userName: string;
    orderId: string;
    reason: string;
    description: string;
    isVendor: boolean;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .dispute-box { background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .info-box { background: #e0f2fe; border: 1px solid #0284c7; padding: 12px; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">⚠️ Dispute Filed</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>${data.isVendor ? 'A buyer has filed a dispute' : 'Your dispute has been submitted'} for order #${data.orderId}.</p>
          
          <div class="dispute-box">
            <p><strong>Reason:</strong> ${data.reason}</p>
            <p><strong>Description:</strong> ${data.description}</p>
          </div>
          
          <div class="info-box">
            <strong>What happens next?</strong>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Solely support team will review the dispute</li>
              <li>${data.isVendor ? 'We may contact you for additional information' : 'The vendor will be notified'}</li>
              <li>Funds are frozen until resolution</li>
              <li>Admin will make a final decision and notify both parties</li>
            </ol>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">Our support team aims to resolve disputes within 3-5 business days.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from Solely</p>
          <p style="font-size: 11px; color: #9ca3af;">This email cannot be replied to. For support, visit <a href="https://solelymarketplace.com/contact" style="color: #6b7280;">solelymarketplace.com/contact</a></p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Dispute Status Update
  disputeStatusUpdate: (data: {
    userName: string;
    orderId: string;
    newStatus: string;
    resolution: string;
    adminNotes?: string;
    isRefund: boolean;
    refundAmount?: number;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${data.isRefund ? '#10b981' : '#3b82f6'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .status-box { background: ${data.isRefund ? '#d1fae5' : '#dbeafe'}; border: 2px solid ${data.isRefund ? '#10b981' : '#3b82f6'}; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">${data.isRefund ? '💰 Dispute Resolved - Refund Issued' : '📋 Dispute Update'}</h1>
        </div>
        <div class="content">
          <p>Hi ${data.userName},</p>
          <p>There's an update on your dispute for order #${data.orderId}.</p>
          
          <div class="status-box">
            <p><strong>Status:</strong> ${data.newStatus}</p>
            <p><strong>Resolution:</strong> ${data.resolution}</p>
            ${data.isRefund && data.refundAmount ? `<p><strong>Refund Amount:</strong> KES ${data.refundAmount.toLocaleString()}</p>` : ''}
            ${data.adminNotes ? `<p><strong>Admin Notes:</strong> ${data.adminNotes}</p>` : ''}
          </div>
          
          ${data.isRefund ? `
          <p style="margin-top: 15px;"><strong>Refund Information:</strong></p>
          <p style="font-size: 14px; color: #6b7280;">Your refund will be processed within 3-5 business days and credited to your original payment method.</p>
          ` : ''}
          
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">Thank you for your patience while we resolved this matter.</p>
        </div>
        <div class="footer">
          <p>This is an automated message from Solely</p>
          <p style="font-size: 11px; color: #9ca3af;">This email cannot be replied to. For support, visit <a href="https://solelymarketplace.com/contact" style="color: #6b7280;">solelymarketplace.com/contact</a></p>
        </div>
      </div>
    </body>
    </html>
  `,

  // NEW: Dispute Filed - Admin/Support Notification
  disputeFiledAdmin: (data: {
    orderId: string;
    buyerName: string;
    buyerEmail: string;
    vendorName: string;
    vendorEmail: string;
    reason: string;
    description: string;
    orderAmount: number;
    evidenceUrls: string[];
    adminUrl: string;
  }) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
        .dispute-box { background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .info-section { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #e5e7eb; }
        .cta-button { display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin-top: 15px; font-weight: bold; }
        .evidence-list { background: #fef3c7; padding: 10px; border-radius: 6px; margin-top: 10px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🚨 New Dispute Filed - Action Required</h1>
        </div>
        <div class="content">
          <p>A new dispute has been filed and requires admin review.</p>
          
          <div class="dispute-box">
            <p><strong>Order ID:</strong> #${data.orderId}</p>
            <p><strong>Order Amount:</strong> KES ${data.orderAmount.toLocaleString()}</p>
            <p><strong>Reason:</strong> ${data.reason}</p>
            <p><strong>Description:</strong> ${data.description}</p>
          </div>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">👤 Buyer Information</h3>
            <p><strong>Name:</strong> ${data.buyerName}</p>
            <p><strong>Email:</strong> <a href="mailto:${data.buyerEmail}">${data.buyerEmail}</a></p>
          </div>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">🏪 Vendor Information</h3>
            <p><strong>Store:</strong> ${data.vendorName}</p>
            <p><strong>Email:</strong> <a href="mailto:${data.vendorEmail}">${data.vendorEmail}</a></p>
          </div>
          
          ${data.evidenceUrls && data.evidenceUrls.length > 0 ? `
          <div class="evidence-list">
            <strong>📎 Buyer Evidence (${data.evidenceUrls.length} file(s)):</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${data.evidenceUrls.map((url, i) => `<li><a href="${url}" target="_blank">Evidence ${i + 1}</a></li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <div style="text-align: center;">
            <a href="${data.adminUrl}" class="cta-button">Review Dispute in Admin Panel</a>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
            Please review this dispute and take appropriate action. The buyer and vendor have been notified.
          </p>
        </div>
        <div class="footer">
          <p>This is an automated notification from Solely Admin System</p>
        </div>
      </div>
    </body>
    </html>
  `,
};


