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

const baseEmailLayout = (title: string, content: string, titleColor: string = '#1a1a1a') => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      line-height: 1.6; 
      color: #333333; 
      background-color: #f4f5f7; 
      margin: 0; 
      padding: 40px 20px; 
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 600px; 
      margin: 0 auto; 
    }
    .brand-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .brand-header h2 {
      color: #1a1a1a;
      font-weight: 800;
      font-size: 28px;
      margin: 0;
      letter-spacing: -1px;
    }
    .brand-header span {
      color: #d4a327; /* Golden Yellow */
    }
    .container { 
      background: #ffffff; 
      border-radius: 16px; 
      overflow: hidden; 
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
      border: 1px solid #eaeaea;
    }
    .header { 
      padding: 40px 32px 24px; 
      text-align: center; 
      background: linear-gradient(to bottom, #ffffff, #fafafa);
      border-bottom: 1px solid #f0f0f0; 
    }
    .header h1 { 
      margin: 0; 
      font-size: 26px; 
      font-weight: 700; 
      color: ${titleColor}; 
      letter-spacing: -0.5px; 
    }
    .content { 
      padding: 32px; 
    }
    .content p { 
      margin: 0 0 20px; 
      font-size: 16px; 
      color: #4b5563; 
    }
    .order-details { 
      background: #fafafa; 
      padding: 24px; 
      border-radius: 12px; 
      margin: 28px 0; 
      border: 1px solid #f0f0f0; 
    }
    .order-details p { 
      margin: 0 0 12px; 
      font-size: 15px; 
      color: #374151; 
      display: flex;
    }
    .order-details p:last-child { margin: 0; }
    .order-details strong { 
      color: #1a1a1a; 
      font-weight: 600; 
      display: inline-block; 
      width: 120px; 
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button { 
      display: inline-block; 
      background-color: #d4a327; 
      color: #1a1a1a !important; 
      padding: 14px 32px; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: 600; 
      font-size: 16px; 
      box-shadow: 0 4px 6px -1px rgba(212, 163, 39, 0.3);
      transition: all 0.2s ease;
    }
    .alert-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: 4px 8px 8px 4px; margin: 24px 0; }
    .alert-box p { margin: 0; font-size: 15px; color: #92400e; }
    
    .success-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px 20px; border-radius: 4px 8px 8px 4px; margin: 24px 0; }
    .success-box p { margin: 0; font-size: 15px; color: #065f46; }
    
    .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px 20px; border-radius: 4px 8px 8px 4px; margin: 24px 0; }
    .info-box p { margin: 0; font-size: 15px; color: #1e40af; }
    
    .error-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 4px 8px 8px 4px; margin: 24px 0; }
    .error-box p { margin: 0; font-size: 15px; color: #991b1b; }
    
    .footer { 
      text-align: center; 
      padding: 32px; 
      background: #fafafa; 
      border-top: 1px solid #eaeaea; 
    }
    .footer p { 
      margin: 0 0 8px; 
      font-size: 13px; 
      color: #9ca3af; 
    }
    .footer a { 
      color: #6b7280; 
      text-decoration: underline; 
    }
    .status-badge { 
      display: inline-block; 
      background: #1a1a1a; 
      color: #ffffff; 
      padding: 6px 16px; 
      border-radius: 20px; 
      font-size: 14px; 
      font-weight: 600; 
      margin-top: 12px; 
      letter-spacing: 0.5px;
    }
    .otp-code { 
      font-size: 36px; 
      font-weight: 800; 
      color: #1a1a1a; 
      letter-spacing: 8px; 
      font-family: 'SFMono-Regular', Consolas, monospace; 
      text-align: center; 
      margin: 24px 0; 
      background: #f4f5f7;
      padding: 16px;
      border-radius: 12px;
      border: 1px dashed #d1d5db;
    }
    .tracking-number { 
      font-size: 22px; 
      font-weight: 700; 
      color: #d4a327; 
      text-align: center; 
      margin: 12px 0; 
      font-family: 'SFMono-Regular', Consolas, monospace; 
    }
    .divider { 
      height: 1px; 
      background: #eaeaea; 
      margin: 32px 0; 
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="brand-header">
      <h2>Sole<span>-ly</span></h2>
    </div>
    <div class="container">
      <div class="header">
        <h1>${title}</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>This is an automated message from Sole-ly</p>
        <p>Do not reply to this email. For support, visit <a href="https://solelymarketplace.com/contact">solelymarketplace.com/contact</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const emailTemplates = {
  vendorDeliveryInquiry: (data: {
    buyerName: string;
    productNames: string;
    city: string;
    negotiationUrl: string;
  }) => baseEmailLayout('New Delivery Inquiry', `
    <p>Hi,</p>
    <p><strong>${data.buyerName}</strong> is interested in buying <strong>${data.productNames}</strong>.</p>
    
    <div class="info-box">
      <p>They need delivery to <strong>${data.city}</strong> and want to discuss the delivery fee with you.</p>
    </div>

    <div class="cta-container">
      <a href="${data.negotiationUrl}" class="cta-button">Open Chat & Propose Fee</a>
    </div>

    <p>Please reply as soon as possible to secure the sale.</p>
  `),
  vendorWelcome: (data: {
    businessName: string;
    dashboardUrl: string;
  }) => baseEmailLayout('Welcome to Sole-ly!', `
    <p>Hi ${data.businessName},</p>
    <p>Welcome to <strong>Sole-ly</strong>! We are thrilled to have you join our marketplace.</p>
    
    <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0;">
      <h3 style="margin-top: 0;">Next Steps to Success:</h3>
      <ol style="margin-bottom: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;"><strong>Add your products:</strong> Start listing your inventory so buyers can find them.</li>
        <li style="margin-bottom: 8px;"><strong>Complete your profile:</strong> Ensure your store information and WhatsApp number are up to date.</li>
        <li><strong>Share your store link:</strong> Promote your Sole-ly store on your social media to drive traffic directly to your products.</li>
      </ol>
    </div>

    <p>If you have any questions or need help setting up, feel free to reply to this email.</p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.dashboardUrl}" class="cta-button">Go to Dashboard</a>
    </div>
  `),

  vendorNewOrder: (data: {
    businessName: string;
    orderId: string;
    items: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    deliveryLocation: string;
    customerName: string;
    dashboardUrl: string;
    googleMapsLink?: string | null;
  }) => baseEmailLayout('New Order Received', `
    <p>Hi ${data.businessName},</p>
    <p>Great news! You have a new order waiting for your confirmation.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      <p><strong>Subtotal:</strong> KES ${data.subtotal.toLocaleString()}</p>
      <p><strong>Delivery Fee:</strong> KES ${data.deliveryFee.toLocaleString()}</p>
      <p><strong>Total:</strong> KES ${data.total.toLocaleString()}</p>
      <p><strong>Delivery:</strong> ${data.deliveryLocation}</p>
      <p><strong>Customer:</strong> ${data.customerName}</p>
    </div>
    
    ${data.googleMapsLink ? `
    <div class="info-box">
      <p><strong>📍 GPS Location Available</strong></p>
      <p>The customer pinned their exact delivery location:</p>
      <a href="${data.googleMapsLink}" style="color: #1e40af; font-weight: bold;">Open in Google Maps &rarr;</a>
    </div>
    ` : ''}
    
    <div style="margin-top: 32px;">
      <a href="${data.dashboardUrl}" class="cta-button">View Order & Respond</a>
    </div>
    
    <div class="alert-box">
      <p><strong>Important:</strong> Please respond within 48 hours or the order will be automatically cancelled and refunded.</p>
    </div>
  `),

  vendorMissedOrder: (data: {
    businessName: string;
    orderId: string;
    items: string;
    total: number;
    customerName: string;
  }) => baseEmailLayout('Missed Order Alert', `
    <p>Hi ${data.businessName},</p>
    <p>We're reaching out because you did not respond to an order within the required 48-hour window.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      <p><strong>Value:</strong> KES ${data.total.toLocaleString()}</p>
      <p><strong>Customer:</strong> ${data.customerName}</p>
    </div>
    
    <div class="error-box">
      <p><strong>Order Cancelled & Refunded</strong></p>
      <p>Because you didn't respond in time, this order has been automatically cancelled and the customer has received a full refund.</p>
    </div>
    
    <div class="alert-box">
      <p><strong>This Affects Your Reputation</strong></p>
      <p>Missed orders negatively impact your seller rating. Customers trust vendors who respond quickly. We recommend checking your dashboard regularly.</p>
    </div>
    
    <div style="margin-top: 32px;">
      <a href="https://solelymarketplace.com/vendor/orders" class="cta-button">View Your Dashboard</a>
    </div>
  `, '#991b1b'),

  buyerOrderDeclined: (data: {
    customerName: string;
    orderId: string;
    items: string;
    total: number;
    vendorName: string;
    reason?: string;
  }) => baseEmailLayout('Order Update', `
    <p>Hi ${data.customerName},</p>
    <p>We're sorry to inform you that your order could not be fulfilled by the vendor.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
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
    
    <div class="success-box">
      <p><strong>Refund Initiated</strong></p>
      <p>Your payment of KES ${data.total.toLocaleString()} will be refunded to your original payment method within 3-5 business days.</p>
    </div>
    
    <p>We apologize for any inconvenience. Please feel free to explore other products on Solely!</p>
  `),

  buyerOrderAutoDeclined: (data: {
    customerName: string;
    orderId: string;
    items: string;
    total: number;
  }) => baseEmailLayout('Order Update', `
    <p>Hi ${data.customerName},</p>
    <p>We're sorry to let you know that the vendor was unable to accept your order within the required 48-hour window.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      <p><strong>Amount:</strong> KES ${data.total.toLocaleString()}</p>
    </div>
    
    <div class="success-box">
      <p><strong>Full Refund Processed</strong></p>
      <p>Your payment of KES ${data.total.toLocaleString()} has been refunded to your M-Pesa. You should receive it within minutes.</p>
    </div>
    
    <div class="info-box">
      <p><strong>Your Money is Safe</strong></p>
      <p>At Solely, we take your financial security seriously. When a vendor fails to respond, we automatically protect your funds by issuing an immediate refund.</p>
    </div>
    
    <div style="margin-top: 32px;">
      <a href="https://solelymarketplace.com/shop" class="cta-button">Continue Shopping</a>
    </div>
  `),

  buyerOrderPlaced: (data: {
    customerName: string;
    orderId: string;
    items: string;
    total: number;
    deliveryType: string;
    isPickup?: boolean;
    orderTrackingUrl: string;
  }) => baseEmailLayout('Order Confirmed', `
    <p>Hi ${data.customerName},</p>
    <p>Thank you for your order! Your payment has been received and your order is now being processed.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      <p><strong>Total:</strong> KES ${data.total.toLocaleString()}</p>
      <p><strong>Delivery:</strong> ${data.deliveryType}</p>
      <p><span class="status-badge">Awaiting Vendor Confirmation</span></p>
    </div>
    
    <div class="info-box">
      <p><strong>What happens next?</strong></p>
      <ol style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; color: #1e40af;">
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
    
    <div style="margin-top: 32px;">
      <a href="${data.orderTrackingUrl}" class="cta-button">Track Your Order</a>
    </div>
    
    <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">Your payment is protected by our escrow system. Funds are only released to the vendor after you confirm ${data.isPickup ? 'pickup' : 'delivery'}.</p>
  `),

  buyerOrderAccepted: (data: {
    customerName: string;
    orderId: string;
    items: string;
    vendorName: string;
    estimatedDate: string;
    isPickup?: boolean;
  }) => baseEmailLayout('Order Accepted', `
    <p>Hi ${data.customerName},</p>
    <p>Great news! <strong>${data.vendorName}</strong> has accepted your order and is ${data.isPickup ? 'preparing it for pickup' : 'preparing it for shipment'}.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      <p><strong>Vendor:</strong> ${data.vendorName}</p>
      <p><strong>${data.isPickup ? 'Expected ready by' : 'Expected to ship by'}:</strong> ${data.estimatedDate}</p>
      <p><span class="status-badge">${data.isPickup ? 'Preparing for Pickup' : 'Preparing for Shipment'}</span></p>
    </div>
    
    <p>You'll receive another email ${data.isPickup ? 'when your order is ready for collection' : 'with tracking information once your order ships'}.</p>
  `),

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
  }) => baseEmailLayout('Order Shipped', `
    <p>Hi ${data.customerName},</p>
    <p>Your order from <strong>${data.vendorName}</strong> is on its way!</p>
    
    ${data.deliveryOtp ? `
    <div class="info-box" style="text-align: center;">
      <p><strong>Your Delivery Code</strong></p>
      <p class="otp-code">${data.deliveryOtp}</p>
      <p>Share this code with the vendor when they deliver. This confirms you received your order and releases payment.</p>
    </div>
    ` : ''}
    
    <div class="alert-box" style="text-align: center;">
      <p>Tracking Number (via ${data.courierName})</p>
      <p class="tracking-number">${data.trackingNumber}</p>
    </div>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      ${data.deliveryNotes ? `<p><strong>Notes:</strong> ${data.deliveryNotes}</p>` : ''}
      <p><span class="status-badge">Being Delivered</span></p>
    </div>
    
    <div style="margin-top: 32px;">
      <a href="${data.orderTrackingUrl}" class="cta-button">Track Your Order</a>
    </div>
  `),

  buyerPickupReady: (data: {
    customerName: string;
    orderId: string;
    items: string;
    vendorName: string;
    vendorAddress: string;
    vendorPhone: string;
    vendorWhatsApp: string;
    deliveryOtp?: string;
  }) => baseEmailLayout('Ready for Pickup', `
    <p>Hi ${data.customerName},</p>
    <p>Great news! Your order from <strong>${data.vendorName}</strong> is ready for collection.</p>
    
    ${data.deliveryOtp ? `
    <div class="info-box" style="text-align: center;">
      <p><strong>Your Pickup Code</strong></p>
      <p class="otp-code">${data.deliveryOtp}</p>
      <p>Show this code to the vendor when you collect your order. This confirms you received your items and releases payment.</p>
    </div>
    ` : ''}
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      <p><strong>Location:</strong> ${data.vendorAddress}</p>
    </div>
    
    <p>Please contact the seller to arrange the exact pickup time:</p>
    
    <div style="display: flex; gap: 10px; margin-top: 16px;">
      <a href="https://wa.me/${normalizeKenyanPhone(data.vendorWhatsApp)}" class="cta-button" style="background: #25D366; color: #fff !important; flex: 1;">WhatsApp</a>
      <a href="tel:+${normalizeKenyanPhone(data.vendorPhone)}" class="cta-button" style="background: #e5e7eb; color: #111827 !important; flex: 1;">Call Seller</a>
    </div>
  `),

  buyerOrderCompleted: (data: {
    customerName: string;
    orderId: string;
    items: string;
    reviewUrl: string;
  }) => baseEmailLayout('Order Completed', `
    <p>Hi ${data.customerName},</p>
    <p>Your order has been completed successfully! We hope you love your purchase.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
    </div>
    
    <div class="info-box">
      <p><strong>How was your experience?</strong></p>
      <p>Your feedback helps other buyers make informed decisions and helps vendors improve their service.</p>
    </div>
    
    <div style="margin-top: 32px;">
      <a href="${data.reviewUrl}" class="cta-button">Leave a Review</a>
    </div>
  `),

  vendorPaymentReleased: (data: {
    vendorName: string;
    orderId: string;
    payoutAmount: number;
  }) => baseEmailLayout('Payment Released', `
    <p>Hi ${data.vendorName},</p>
    <p>Great news! The buyer has confirmed delivery for order #${data.orderId}.</p>
    
    <div class="success-box" style="text-align: center;">
      <p>Funds Released</p>
      <p style="font-size: 32px; font-weight: 700; color: #065f46; margin: 8px 0;">KES ${data.payoutAmount.toLocaleString()}</p>
    </div>
    
    <p>The funds have been released from escrow and will be processed for payout according to your payment schedule.</p>
    <p>Thank you for providing excellent service to your buyers!</p>
  `),

  disputeFiled: (data: {
    userName: string;
    orderId: string;
    reason: string;
    description: string;
    isVendor: boolean;
  }) => baseEmailLayout('Dispute Filed', `
    <p>Hi ${data.userName},</p>
    <p>${data.isVendor ? 'A buyer has filed a dispute' : 'Your dispute has been submitted'} for order #${data.orderId}.</p>
    
    <div class="error-box">
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p style="margin-top: 8px;"><strong>Description:</strong> ${data.description}</p>
    </div>
    
    <div class="info-box">
      <p><strong>What happens next?</strong></p>
      <ol style="margin: 8px 0 0; padding-left: 20px; font-size: 14px; color: #1e40af;">
        <li>Solely support team will review the dispute</li>
        <li>${data.isVendor ? 'We may contact you for additional information' : 'The vendor will be notified'}</li>
        <li>Funds are frozen until resolution</li>
        <li>Admin will make a final decision and notify both parties</li>
      </ol>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">Our support team aims to resolve disputes within 3-5 business days.</p>
  `, '#991b1b'),

  disputeStatusUpdate: (data: {
    userName: string;
    orderId: string;
    newStatus: string;
    resolution: string;
    adminNotes?: string;
    isRefund: boolean;
    refundAmount?: number;
  }) => baseEmailLayout(data.isRefund ? 'Dispute Resolved' : 'Dispute Update', `
    <p>Hi ${data.userName},</p>
    <p>There's an update on your dispute for order #${data.orderId}.</p>
    
    <div class="${data.isRefund ? 'success-box' : 'info-box'}">
      <p><strong>Status:</strong> ${data.newStatus}</p>
      <p style="margin-top: 8px;"><strong>Resolution:</strong> ${data.resolution}</p>
      ${data.isRefund && data.refundAmount ? `<p style="margin-top: 8px;"><strong>Refund Amount:</strong> KES ${data.refundAmount.toLocaleString()}</p>` : ''}
      ${data.adminNotes ? `<p style="margin-top: 8px;"><strong>Notes:</strong> ${data.adminNotes}</p>` : ''}
    </div>
    
    ${data.isRefund ? `
    <p><strong>Refund Information:</strong></p>
    <p style="font-size: 14px; color: #6b7280;">Your refund will be processed within 3-5 business days and credited to your original payment method.</p>
    ` : ''}
    
    <p style="font-size: 14px; color: #6b7280;">Thank you for your patience while we resolved this matter.</p>
  `),

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
  }) => baseEmailLayout('Action Required: New Dispute', `
    <p>A new dispute has been filed and requires admin review.</p>
    
    <div class="error-box">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Amount:</strong> KES ${data.orderAmount.toLocaleString()}</p>
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p><strong>Description:</strong> ${data.description}</p>
    </div>
    
    <div class="order-details">
      <p><strong>Buyer:</strong> ${data.buyerName} (<a href="mailto:${data.buyerEmail}">${data.buyerEmail}</a>)</p>
      <div class="divider" style="margin: 12px 0;"></div>
      <p><strong>Vendor:</strong> ${data.vendorName} (<a href="mailto:${data.vendorEmail}">${data.vendorEmail}</a>)</p>
    </div>
    
    ${data.evidenceUrls && data.evidenceUrls.length > 0 ? `
    <div class="alert-box">
      <p><strong>Evidence Files (${data.evidenceUrls.length}):</strong></p>
      <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 14px;">
        ${data.evidenceUrls.map((url, i) => `<li><a href="${url}" target="_blank">Evidence ${i + 1}</a></li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div style="margin-top: 32px;">
      <a href="${data.adminUrl}" class="cta-button" style="background: #991b1b;">Review Dispute in Admin</a>
    </div>
  `, '#991b1b'),

  buyerOrderArrived: (data: {
    customerName: string;
    orderId: string;
    items: string;
    vendorName: string;
    confirmUrl: string;
  }) => baseEmailLayout('Order Arrived', `
    <p>Hi ${data.customerName},</p>
    <p>Great news! Your order from <strong>${data.vendorName}</strong> has arrived.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Items:</strong> ${data.items}</p>
      <p><span class="status-badge" style="background: #ecfdf5; color: #065f46; border-color: #a7f3d0;">Delivered</span></p>
    </div>
    
    <div class="success-box">
      <p><strong>Action Required</strong></p>
      <p style="margin-top: 8px;">Please check your items and confirm delivery to release payment to the vendor.</p>
    </div>
    
    <div style="margin-top: 32px;">
      <a href="${data.confirmUrl}" class="cta-button" style="background: #065f46;">Confirm Delivery</a>
    </div>
  `),

  buyerAutoDisputeDelay: (data: {
    customerName: string;
    orderId: string;
    totalAmount: number;
  }) => baseEmailLayout('Delivery Delay Review', `
    <p>Hi ${data.customerName},</p>
    <p>Your order has not been marked as delivered within our 5-day delivery window.</p>
    
    <div class="order-details">
      <p><strong>Order ID:</strong> #${data.orderId}</p>
      <p><strong>Amount:</strong> KES ${data.totalAmount.toLocaleString()}</p>
    </div>
    
    <div class="info-box">
      <p><strong>Under Review</strong></p>
      <p style="margin-top: 8px;">We have automatically raised this for admin review. Our team will contact the vendor to investigate the delay.</p>
      <p style="margin-top: 8px;">Your payment remains safely held in escrow until this is resolved.</p>
    </div>
    
    <div class="alert-box">
      <p>If you have already received your order, please click below to confirm delivery.</p>
    </div>
    
    <div style="margin-top: 32px;">
      <a href="https://solelymarketplace.com/track/${data.orderId}" class="cta-button">Track / Confirm Order</a>
    </div>
  `),
};
