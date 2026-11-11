// Decision-tree flow definitions for the Solely Help Bot.
// Each node has an id, a bot message, and either quick-reply options or an input prompt.

export interface ChatOption {
  label: string;
  icon?: string;
  nextNodeId: string;
}

export interface ChatNode {
  id: string;
  botMessage: string;
  options?: ChatOption[];
  /** If set, shows a text input instead of quick-reply buttons */
  input?: "order_id";
  /** Supabase action to run when this node is reached */
  action?: "track_order";
  /** Internal route to navigate to */
  link?: string;
  /** External URL to open in a new tab */
  externalLink?: string;
}

// ─── Flow Definitions ────────────────────────────────────────────────

export const CHAT_NODES: Record<string, ChatNode> = {
  // ── Root ──
  start: {
    id: "start",
    botMessage: "Hi there, welcome to Solely. How can I help you?",
    options: [
      { label: "Track my order", nextNodeId: "track_ask" },
      { label: "Payment help", nextNodeId: "payment_menu" },
      { label: "Returns & refunds", nextNodeId: "returns_menu" },
      { label: "Delivery questions", nextNodeId: "delivery_menu" },
      { label: "I want to sell on Solely", nextNodeId: "vendor_menu" },
      { label: "Talk to a person", nextNodeId: "whatsapp" },
    ],
  },

  // ── Order Tracking ──
  track_ask: {
    id: "track_ask",
    botMessage:
      "No problem. Paste your order ID below and I'll pull up the details for you.\n\nYou can find your order ID in your confirmation email, or on your Orders page if you're logged in.",
    input: "order_id",
    action: "track_order",
  },
  track_not_found: {
    id: "track_not_found",
    botMessage:
      "I wasn't able to find an order with that ID. This usually means the ID was mistyped or the order hasn't been fully processed yet.\n\nDouble-check the ID, it's a long string of letters, numbers, and dashes, and try again. If you're still having trouble, reach out to our team on WhatsApp and we'll look into it for you.",
    options: [
      { label: "Try again", nextNodeId: "track_ask" },
      { label: "Talk to support on WhatsApp", nextNodeId: "whatsapp" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },

  // ── Payment Help ──
  payment_menu: {
    id: "payment_menu",
    botMessage: "Sure, what's the issue?",
    options: [
      { label: "How do I pay for an order?", nextNodeId: "payment_how" },
      { label: "My payment failed or didn't go through", nextNodeId: "payment_failed" },
      { label: "I'm waiting for a refund", nextNodeId: "payment_refund" },
      { label: "How does buyer protection work?", nextNodeId: "payment_protection" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  payment_how: {
    id: "payment_how",
    botMessage:
      "All payments on Solely are made via M-Pesa. Here's the step-by-step:\n\n1. Add items to your cart and proceed to checkout.\n2. Enter the M-Pesa phone number you want to pay from.\n3. You'll receive an STK push notification on your phone, this is the standard M-Pesa prompt.\n4. Enter your M-Pesa PIN to confirm the payment.\n\nOnce your payment goes through, your money is held in Solely's escrow system. It is not sent to the vendor. The vendor only receives payment after you confirm that you've received your item and it matches what was described. This is what makes Solely different from paying directly to a Till or Paybill.",
    options: [
      { label: "How does buyer protection work exactly?", nextNodeId: "payment_protection" },
      { label: "Back to payment help", nextNodeId: "payment_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  payment_protection: {
    id: "payment_protection",
    botMessage:
      "Solely holds your money until you have your order. When you pay, the money is held by Solely, not sent to the vendor. Here's what happens next:\n\n- The vendor accepts your order and packs it.\n- Before it ships, you see exactly what's in the package. If it's not what you ordered, tap \"This is wrong\" and it's held back.\n- The vendor ships it. Each delivery has a deadline based on distance.\n- When it arrives, check it, then tap \"Yes, I got it\" or give the vendor your 6-digit code. Either one pays the vendor.\n\nIf anything goes wrong, tap \"Something wrong?\" on your order and the payment stays held. If you don't report a problem within 6 daytime hours of the order being marked arrived, the vendor is paid.\n\nIf the vendor doesn't ship or deliver on time and doesn't send an update, you're refunded in full automatically.\n\nFor pickup orders, you collect the item, check it there, and confirm in the app or show your code.",
    options: [
      { label: "What if something goes wrong with my order?", nextNodeId: "returns_dispute" },
      { label: "Back to payment help", nextNodeId: "payment_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  payment_failed: {
    id: "payment_failed",
    botMessage:
      "Payment failures on M-Pesa are usually caused by one of these:\n\n1. Insufficient funds in your M-Pesa wallet.\n2. You entered the wrong phone number at checkout.\n3. The STK push timed out, you have about 30 seconds to enter your PIN after receiving the prompt.\n4. A temporary network issue between Safaricom and our payment processor.\n\nWhat to do:\n- Wait about 2 minutes and try again from the checkout page.\n- Make sure you're entering the phone number registered to your M-Pesa account.\n- Check that you have enough balance to cover the full order amount.\n\nIf the payment was deducted from your M-Pesa but the order still shows as unpaid, don't place a second order. Contact us on WhatsApp with your phone number and order details, and we'll sort it out.",
    options: [
      { label: "Talk to support on WhatsApp", nextNodeId: "whatsapp" },
      { label: "Back to payment help", nextNodeId: "payment_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  payment_refund: {
    id: "payment_refund",
    botMessage:
      "Refunds on Solely are sent back to the same M-Pesa number you paid from. Here's how the timing works:\n\n- Vendor declines your order: Refund is processed immediately.\n- You cancel before the vendor dispatches: Refund within 24 hours.\n- Dispute resolved in your favor: Refund within 24-48 hours.\n\nIf it's been more than 48 hours since your refund was approved and you haven't received it, contact us on WhatsApp with your order ID and phone number. We'll trace the transaction and get it resolved.",
    options: [
      { label: "Talk to support on WhatsApp", nextNodeId: "whatsapp" },
      { label: "Back to payment help", nextNodeId: "payment_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },

  // ── Returns & Refunds ──
  returns_menu: {
    id: "returns_menu",
    botMessage: "What do you need help with?",
    options: [
      { label: "How do I return an item?", nextNodeId: "returns_how" },
      { label: "What's the return policy?", nextNodeId: "returns_policy" },
      { label: "I need to open a dispute", nextNodeId: "returns_dispute" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  returns_how: {
    id: "returns_how",
    botMessage:
      "If you've received an item that's wrong, damaged, or not as described, here's what to do:\n\n1. Don't tap \"Yes, I got it\" and don't give the vendor your code. Your money is still held.\n2. Go to your Orders page and tap \"Something wrong?\" on the order.\n3. Pick what happened and add photos. Photos help it get sorted faster.\n4. The vendor is asked to offer a fix: some money back, a replacement, or a full refund once they collect the item. They cover any delivery costs.\n5. If the vendor doesn't respond in time, you're refunded in full. If you can't agree, tap \"Ask Solely to decide\".\n\nImportant: once you confirm or the vendor enters your code, the payment is released. Only confirm when you're happy with what you received.",
    options: [
      { label: "Go to my orders", nextNodeId: "go_orders" },
      { label: "Back to returns help", nextNodeId: "returns_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  returns_policy: {
    id: "returns_policy",
    botMessage:
      "Solely's return and dispute policy:\n\n- Once an order has shipped, it can only be returned if it's damaged, not as described, or not what you ordered. There are no change-of-mind returns.\n- Report a problem from your Orders page before the payment is released. The payment stays held while it's sorted.\n- If it's the vendor's fault, the vendor covers the return and any re-delivery. They collect the item from you.\n- Missing items: the vendor has 36 hours to send them, or you can choose a refund for them.\n- Got someone else's order: the vendor has 24 hours to swap it, or you can ask for a refund straight away.\n- If you and the vendor can't agree, Solely decides. Either of you can ask Solely to review an automatic decision within 48 hours.",
    options: [
      { label: "I need to open a dispute now", nextNodeId: "returns_dispute" },
      { label: "Back to returns help", nextNodeId: "returns_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  returns_dispute: {
    id: "returns_dispute",
    botMessage:
      "To open a dispute:\n\n1. Log in and go to your Orders page.\n2. Find the order you want to dispute.\n3. Tap \"Open Dispute\". You'll see a chat-style interface where you can explain the issue and upload evidence.\n4. The vendor will be notified and can respond with their side.\n5. Our admin team reviews the case and makes a decision within 24 hours.\n\nIf you can't find the dispute option, it may mean you've already confirmed delivery for that order. In that case, contact us on WhatsApp and we'll see what we can do.",
    options: [
      { label: "Go to my orders", nextNodeId: "go_orders" },
      { label: "Talk to support on WhatsApp", nextNodeId: "whatsapp" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  go_orders: {
    id: "go_orders",
    botMessage: "Taking you to your orders page now.",
    link: "/orders",
  },

  // ── Delivery Info ──
  delivery_menu: {
    id: "delivery_menu",
    botMessage: "What would you like to know?",
    options: [
      { label: "How does delivery work?", nextNodeId: "delivery_how" },
      { label: "Who pays for delivery?", nextNodeId: "delivery_fees" },
      { label: "Can I pick up instead of having it delivered?", nextNodeId: "delivery_pickup" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  delivery_how: {
    id: "delivery_how",
    botMessage:
      "Delivery on Solely is handled by each vendor. Solely does not operate a delivery service.\n\nAfter you place an order, the vendor arranges delivery to your address using their own rider or a courier. Before it ships, you'll see exactly what they've packed so you can catch a wrong item early.\n\nEach delivery has a deadline based on distance: about a day within the same town or county, 2 days to another county, and 3 days to the coast or border counties. The vendor can send you updates if there's a delay. If it doesn't arrive and they don't send an update, you're refunded in full automatically.",
    options: [
      { label: "Who pays for delivery?", nextNodeId: "delivery_fees" },
      { label: "What if my order never arrives?", nextNodeId: "delivery_not_arrived" },
      { label: "Back to delivery questions", nextNodeId: "delivery_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  delivery_fees: {
    id: "delivery_fees",
    botMessage:
      "Delivery fees are set and charged by each vendor individually - Solely does not add any delivery charges.\n\nThe delivery cost depends on the vendor's location, your delivery address, and the courier they use. Some vendors offer free delivery, which is shown as a green badge on the product listing.\n\nYou can discuss delivery costs with the vendor through the delivery negotiation feature after placing your order.",
    options: [
      { label: "Back to delivery questions", nextNodeId: "delivery_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  delivery_pickup: {
    id: "delivery_pickup",
    botMessage:
      "Yes, you can choose pickup at checkout if the vendor supports it. Here's how it works:\n\n1. Select \"Pickup\" as your delivery method during checkout.\n2. Pay via M-Pesa, your money goes into escrow, same as with delivery orders.\n3. The vendor prepares your item.\n4. You go to the vendor's location and collect the item in person.\n5. Once you have the item, the app generates a 6-digit release code.\n6. Show the code to the vendor, they enter it and receive their payment.\n\nThis way, even with in-person pickups, both sides are protected. The vendor knows they'll get paid, and you can inspect the item before releasing the funds.",
    options: [
      { label: "Back to delivery questions", nextNodeId: "delivery_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  delivery_not_arrived: {
    id: "delivery_not_arrived",
    botMessage:
      "If your order hasn't arrived, your money is still held. It has not been sent to the vendor.\n\nHere's what happens:\n\n1. Every delivery has a deadline. Check your Orders page to see when your order should arrive.\n2. Before the deadline, we ask the vendor where it is. Any update they send is passed on to you.\n3. If the deadline passes and the vendor hasn't sent an update, you're refunded in full automatically.\n4. If the vendor marked it as arrived but you don't have it, tap \"Something wrong?\" and choose \"I didn't get it\". The payment stays held and Solely's team looks into it.",
    options: [
      { label: "I need to open a dispute", nextNodeId: "returns_dispute" },
      { label: "Go to my orders", nextNodeId: "go_orders" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },

  // ── Sell on Solely (Vendor) ──
  vendor_menu: {
    id: "vendor_menu",
    botMessage: "Great, here's what most sellers want to know. What's your question?",
    options: [
      { label: "How do I register as a vendor?", nextNodeId: "vendor_register" },
      { label: "What are the fees?", nextNodeId: "vendor_fees" },
      { label: "How and when do I get paid?", nextNodeId: "vendor_payout" },
      { label: "What are payment links?", nextNodeId: "vendor_links" },
      { label: "Who handles delivery?", nextNodeId: "vendor_delivery" },
      { label: "Can I sell used or thrifted items?", nextNodeId: "vendor_used" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  vendor_register: {
    id: "vendor_register",
    botMessage:
      "Registration is free and takes about 2 minutes. Here's what's involved:\n\n1. Go to the vendor registration page and create your account.\n2. Fill in your store name, phone number (WhatsApp-enabled), and the category you sell in.\n3. Submit your application, our admin team reviews and approves new vendors.\n4. Once approved, you can start listing products immediately from your vendor dashboard.\n\nYou'll get your own store page with a shareable link that you can post on Instagram, WhatsApp, TikTok, or anywhere else you sell. Buyers can browse your catalog and pay through Solely's escrow system.\n\nThere are no setup fees, no subscription fees, and no monthly charges.",
    options: [
      { label: "Take me to registration", nextNodeId: "go_vendor_register" },
      { label: "What are the fees?", nextNodeId: "vendor_fees" },
      { label: "Back to seller questions", nextNodeId: "vendor_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  go_vendor_register: {
    id: "go_vendor_register",
    botMessage: "Taking you to the vendor registration page now.",
    link: "/vendor/register",
  },
  vendor_fees: {
    id: "vendor_fees",
    botMessage:
      "Solely operates on a commission-only model:\n\n- Registration: Free.\n- Listing products: Free, no limit on how many you can list.\n- Monthly or subscription fees: None.\n- Commission: 6% per sale. This is deducted automatically when you receive your payout.\n\nYou never pay anything upfront. You only pay when you actually make a sale.",
    options: [
      { label: "How and when do I get paid?", nextNodeId: "vendor_payout" },
      { label: "Take me to registration", nextNodeId: "go_vendor_register" },
      { label: "Back to seller questions", nextNodeId: "vendor_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  vendor_payout: {
    id: "vendor_payout",
    botMessage:
      "Here's how vendor payouts work:\n\n1. A buyer places an order and pays via M-Pesa. Solely holds the payment. It's not in your account yet.\n2. You accept the order, confirm what's in the package, and ship it within 8 daytime hours (aim for 3).\n3. When it arrives, mark it as arrived.\n4. The buyer taps \"Yes, I got it\" or gives you their 6-digit code to enter. Either one pays you straight away.\n5. If the buyer doesn't report a problem, you're paid automatically 6 daytime hours after you mark it arrived (the clock pauses from 6pm to 7am).\n6. You keep the full delivery fee plus the product price minus the 6% commission. The money goes to your Solely wallet balance.\n7. You can withdraw from your wallet to M-Pesa at any time from your dashboard.\n\nStandard M-Pesa withdrawal fees apply when you cash out.",
    options: [
      { label: "What are the fees?", nextNodeId: "vendor_fees" },
      { label: "Back to seller questions", nextNodeId: "vendor_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  vendor_links: {
    id: "vendor_links",
    botMessage:
      "Payment links are a feature for vendors who sell primarily on WhatsApp, Instagram, or TikTok.\n\nInstead of directing buyers to your store page, you can generate a secure payment link for a specific product and price directly from your vendor dashboard. You send this link to your buyer, they click it, pay via M-Pesa, and the transaction goes through Solely's escrow system.\n\nThis solves the trust problem: your buyer knows their money is protected, and you know the payment is legitimate. No more sending to Till numbers where the buyer has no recourse.\n\nYou can create as many payment links as you need, and they work across any messaging platform.",
    options: [
      { label: "Take me to registration", nextNodeId: "go_vendor_register" },
      { label: "Back to seller questions", nextNodeId: "vendor_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  vendor_delivery: {
    id: "vendor_delivery",
    botMessage:
      "You, the vendor, are responsible for all delivery logistics. Solely does not provide a delivery service.\n\nWhen a buyer places an order, you'll see their delivery address in your vendor dashboard. Ship with your own rider or any courier.\n\nBefore you ship, tick each item and add a short description of what's in the package. The buyer sees it and can stop the package if it's wrong. Then mark it as shipped, and mark it as arrived when it gets there.\n\nIf you're running late, send the buyer an update from the order. That gives you more time. If you miss a deadline without an update, the buyer is refunded and your shop gets a strike. 3 strikes in 90 days suspends your shop.\n\nIf the buyer can't be reached at delivery, tap \"Buyer not available?\". Solely will call them. If they don't respond within 12 hours, you keep the delivery fee.",
    options: [
      { label: "How and when do I get paid?", nextNodeId: "vendor_payout" },
      { label: "Back to seller questions", nextNodeId: "vendor_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },
  vendor_used: {
    id: "vendor_used",
    botMessage:
      "Yes, absolutely. Solely supports new, thrifted, refurbished, and pre-owned items. When listing a product, you select its condition, new, like new, good, fair, or thrifted, and this is shown as a badge on the product listing so buyers know exactly what they're getting.\n\nThe only requirement is that the item matches the description and photos you provide. Accurately representing condition is important because disputes are resolved based on whether the item matches the listing.",
    options: [
      { label: "Take me to registration", nextNodeId: "go_vendor_register" },
      { label: "Back to seller questions", nextNodeId: "vendor_menu" },
      { label: "Back to main menu", nextNodeId: "start" },
    ],
  },

  // ── WhatsApp ──
  whatsapp: {
    id: "whatsapp",
    botMessage: "Opening WhatsApp now. You'll be connected with our support team.",
    externalLink: "https://wa.me/254790793213?text=Hi!%20I%20have%20a%20question%20about%20Solely.",
  },
};
