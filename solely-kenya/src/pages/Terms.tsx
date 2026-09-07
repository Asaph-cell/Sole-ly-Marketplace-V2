import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, ShoppingBag, Store, AlertTriangle, CreditCard, Star, Scale, Truck, KeyRound, Database } from "lucide-react";

const Terms = () => {
    return (
        <div className="min-h-screen bg-muted/30 py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                <Link to="/">
                    <Button variant="ghost" className="mb-6">
                        <ArrowLeft size={16} strokeWidth={1.5} className=" mr-2" />
                        Back to Home
                    </Button>
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-4">Terms and Conditions</h1>
                    <p className="text-muted-foreground">
                        Last updated: September 2026
                    </p>
                </div>

                <Tabs defaultValue="buyers" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="buyers">
                            <ShoppingBag size={16} strokeWidth={1.5} className=" mr-2" />
                            For Buyers
                        </TabsTrigger>
                        <TabsTrigger value="vendors">
                            <Store size={16} strokeWidth={1.5} className=" mr-2" />
                            For Vendors
                        </TabsTrigger>
                    </TabsList>

                    {/* BUYER TERMS */}
                    <TabsContent value="buyers">
                        <Card className="p-6 md:p-8 space-y-8">
                            <section>
                                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                    <Shield size={24} strokeWidth={1.5} className=" text-primary" />
                                    Welcome to Solely Marketplace
                                </h2>
                                <p className="text-sm text-muted-foreground mb-4">Last Updated: September 2026</p>
                                <p className="text-muted-foreground leading-relaxed">
                                    Welcome to Sole-ly, Kenya's trusted online marketplace. These Terms and Conditions constitute a legally binding agreement between you ("the Buyer") and Sole-ly ("the Platform"). By creating an account, checking out as a guest, or purchasing products, you agree to these terms.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Scale size={20} strokeWidth={1.5} className=" text-amber-600" />
                                    0. Platform Disclaimer (Important)
                                </h3>
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg mb-4">
                                    <p className="text-amber-900 font-medium mb-2">Sole-ly Kenya is an Online Marketplace</p>
                                    <ul className="list-disc pl-6 space-y-2 text-amber-800 text-sm">
                                        <li>Sole-ly Kenya does not own or sell the products listed on this platform. We are a venue connecting third-party independent vendors with buyers.</li>
                                        <li><strong>No Affiliation:</strong> Sole-ly Kenya is NOT affiliated, associated, authorized, endorsed by, or in any way officially connected with any brands listed on the platform. All brand names, logos, and trademarks are the property of their respective owners.</li>
                                        <li><strong>Resale Condition:</strong> Items listed as "New" are sold by independent vendors, not by authorized retailers, and may not come with the original manufacturer's warranty. Items listed as "Thrifted" or "Refurbished" are pre-owned and are described by the vendor, not by us.</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">1. Account Registration and Guest Checkout</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Accuracy:</strong> You must provide accurate personal information and valid contact details, whether you register or check out as a guest</li>
                                    <li><strong>Security:</strong> You are responsible for maintaining the confidentiality of your account credentials. You are liable for all activities that occur under your account</li>
                                    <li><strong>Eligibility:</strong> You must be at least 18 years old to make purchases on Sole-ly</li>
                                    <li><strong>One Account:</strong> One person may only operate one buyer account. Creating duplicate accounts to abuse promotions is prohibited</li>
                                    <li><strong>Guest orders:</strong> You may check out without an account. Your order is tracked through a private link we send you, anyone holding that link can view the order, so do not share it. We recommend creating an account so your orders, OTPs, and dispute history stay in one place</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <CreditCard size={20} strokeWidth={1.5} className=" text-green-600" />
                                    2. Escrow Payment Protection
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    To guarantee trust, Sole-ly uses a secure Escrow System for all transactions:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Payment:</strong> When you order, your money is held in a neutral escrow account; it is not sent directly to the vendor immediately</li>
                                    <li><strong>What is held:</strong> Escrow covers both the product price and the agreed delivery fee, paid together in a single checkout</li>
                                    <li><strong>Protection:</strong> Your funds remain secured in escrow while the vendor processes and ships your order</li>
                                    <li><strong>Release:</strong> Funds are released to the vendor after you confirm receipt. See section 4 for exactly how and when this happens</li>
                                    <li><strong>Accepted Payment Methods:</strong> M-Pesa, Credit/Debit Cards, and Mobile Wallets</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">3. Ordering Process &amp; Timelines</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Confirmation Window:</strong> Vendors must accept or decline your order within <strong>48 hours</strong>. If they fail to do so, the order is automatically cancelled, and you receive a full refund</li>
                                    <li><strong>Delivery Window:</strong> Once confirmed, vendors have <strong>5 days</strong> to deliver your order. If it is not marked as arrived in that time, a dispute is automatically raised for admin review</li>
                                    <li><strong>Updates:</strong> You will receive order updates via the platform, email, and push notifications (if enabled) as your order progresses</li>
                                    <li><strong>Current windows:</strong> The 48-hour and 5-day windows above are the current settings. We may adjust them to keep the marketplace working well, and the values in force always apply to orders placed after the change</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Truck size={20} strokeWidth={1.5} className=" text-blue-600" />
                                    3.5. Delivery and the Delivery Fee
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Delivery is carried out by the vendor, but the delivery fee is agreed and paid <strong>through Sole-ly</strong>:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>You agree the fee before you pay:</strong> After you enter your delivery details, you and the vendor negotiate the delivery fee in an in-app chat. Either side can propose a fee and method; the order proceeds once both sides accept</li>
                                    <li><strong>Paid in one checkout:</strong> The agreed delivery fee is added to your order total and paid in the same transaction as the product. It is held in escrow with the rest of your money</li>
                                    <li><strong>Free Delivery:</strong> Some vendors offer free delivery. Look for the "Free Delivery" badge on product listings</li>
                                    <li><strong>Pickup:</strong> Where a vendor offers it, you may collect the item in person instead of paying a delivery fee</li>
                                    <li><strong>Location Sharing:</strong> During checkout, you can optionally share your GPS location pin to make it easier for the vendor to find you</li>
                                    <li><strong>Agreements expire:</strong> A delivery negotiation that neither side completes will expire, and you will need to start again. Nothing is charged for an expired negotiation</li>
                                    <li><strong>Vendor is the deliverer:</strong> Sole-ly does not operate a courier fleet. The vendor is responsible for getting the item to you, whether they deliver it themselves or use a courier</li>
                                </ul>
                                <p className="text-muted-foreground mt-3 bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
                                    <strong>Do not pay delivery fees outside Sole-ly.</strong> A fee paid directly to a vendor by M-Pesa is not held in escrow, is not covered by buyer protection, and cannot be refunded by us if something goes wrong. If a vendor asks you to pay outside the platform, report it to us.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <KeyRound size={20} strokeWidth={1.5} className=" text-green-700" />
                                    4. Confirming Delivery: Package PIN and OTP (Critical)
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Sole-ly uses a two-step handover. Read this section carefully. It determines when your money leaves escrow.
                                </p>

                                <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                                    <h4 className="font-semibold text-green-800 mb-2">🔐 How Confirmation Works</h4>
                                    <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li>The vendor ships your order with a <strong>3-digit Package PIN</strong> shown on the package</li>
                                        <li><strong>Inspect the item first.</strong> Check that it is correct, complete, and in the condition described</li>
                                        <li>Once you are satisfied, enter the 3-digit Package PIN in the Sole-ly app to confirm you have received it</li>
                                        <li>Sole-ly then shows you a <strong>6-digit OTP</strong>. Give it to the vendor to release their payment immediately</li>
                                        <li>If the vendor does not enter the OTP, the escrowed funds are released to them automatically <strong>6 hours</strong> after you entered the Package PIN</li>
                                    </ol>
                                </div>

                                <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-red-800 mb-2">🔒 Entering the Package PIN is the point of no return</h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                                        <li><strong>Inspect first, enter second:</strong> Entering the Package PIN tells us you have received the correct item in acceptable condition. Do not enter it while the courier is still holding the package or before you have opened it</li>
                                        <li><strong>The 6-hour clock starts at PIN entry:</strong> After you enter the PIN, you have <strong>6 hours</strong> to raise a dispute before escrow releases automatically. Raise a dispute inside that window and the funds stay frozen while we investigate</li>
                                        <li><strong>Problem? Do not enter the PIN:</strong> If the item is wrong, damaged, or missing, do not enter the Package PIN. Raise a dispute instead and your money stays in escrow</li>
                                        <li><strong>Pickup orders:</strong> When you collect in person there is no 6-hour timer. Funds are released only when the vendor enters the OTP you show them</li>
                                    </ul>
                                </div>

                                <p className="text-muted-foreground mt-4">
                                    <strong>Never share the Package PIN or OTP before you have the item in your hands and have inspected it.</strong> A vendor or courier who pressures you for either code before handover is breaching our Vendor Agreement, refuse, and report it to us.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <AlertTriangle size={20} strokeWidth={1.5} className=" text-amber-600" />
                                    5. Disputes and Refunds
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    You may file a dispute if:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>You did not receive your item</li>
                                    <li>You received a wrong or different item</li>
                                    <li>The item arrived damaged</li>
                                    <li>The item significantly differs from the description</li>
                                    <li>The item is counterfeit</li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    <strong>When to file:</strong> Before entering the Package PIN, or within the <strong>6-hour</strong> window after entering it. Once escrow has released, we can still investigate and act against the vendor, but recovering funds becomes significantly harder.
                                </p>
                                <p className="text-muted-foreground mt-3">
                                    Our admin team will review disputes within <strong>3–5 business days</strong>. Refunds are processed to your original payment method when approved. Where a dispute is resolved in your favour, the delivery fee is refunded along with the product price.
                                </p>
                                <p className="text-muted-foreground mt-3">
                                    <strong>Stolen goods:</strong> If you believe an item you received or saw listed is stolen, report it through the Platform. We may suspend the listing and vendor and share relevant records with law enforcement or the lawful owner.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Star size={20} strokeWidth={1.5} className=" text-yellow-500" />
                                    6. Ratings and Reviews
                                </h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>You may rate vendors after confirming order delivery</li>
                                    <li>Reviews should be honest, factual, and respectful</li>
                                    <li>False or malicious reviews may be removed</li>
                                    <li>Your rating and comment are public; your identity is not shown to the vendor</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">7. Prohibited Activities</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Filing false disputes or fraudulent claims</li>
                                    <li>Attempting to bypass the escrow system, including agreeing to pay a vendor directly</li>
                                    <li>Withholding the Package PIN or OTP after receiving the correct item, in order to obtain goods without paying</li>
                                    <li>Harassing or threatening vendors</li>
                                    <li>Using the platform for illegal activities, including buying goods you know to be stolen</li>
                                    <li>Creating multiple accounts to abuse promotions</li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    Accounts that breach this section may be suspended or banned, and pending orders cancelled.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">8. Limitation of Liability</h3>
                                <p className="text-muted-foreground mb-3">
                                    Sole-ly acts as a marketplace connecting buyers and vendors. While we verify vendors and protect payments, we are not the seller and we are not responsible for the quality, safety, legality, or accuracy of products listed by independent vendors.
                                </p>
                                <p className="text-muted-foreground">
                                    Our liability to you in connection with any order is limited to facilitating dispute resolution and, where a dispute is resolved in your favour, refunding the amount you paid for that order through the Platform. We are not liable for indirect or consequential losses, for delivery fees or payments you make outside the Platform, or for interruptions to the Platform outside our reasonable control. Nothing in these terms limits any liability that cannot be limited under Kenyan law.
                                </p>
                            </section>
                        </Card>
                    </TabsContent>

                    {/* VENDOR TERMS */}
                    <TabsContent value="vendors">
                        <Card className="p-6 md:p-8 space-y-8">
                            <section>
                                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                    <Store size={24} strokeWidth={1.5} className=" text-primary" />
                                    Sole-ly Vendor Agreement
                                </h2>
                                <p className="text-sm text-muted-foreground mb-4">Last Updated: September 2026</p>
                                <p className="text-muted-foreground leading-relaxed">
                                    By registering as a vendor on Sole-ly, you agree to provide high-quality products
                                    and excellent customer service. These terms govern your relationship with Sole-ly and buyers on the platform.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">1. Vendor Registration</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>You must provide accurate business information and valid contact details</li>
                                    <li>You must have legal authorization to sell the products you list</li>
                                    <li>Sole-ly reserves the right to verify vendor information</li>
                                    <li>You are responsible for all taxes applicable to your sales</li>
                                    <li><strong>Public information:</strong> Your store name, description, location, ratings, and the store phone number you provide are displayed publicly so buyers can reach you. Your M-Pesa payout number is never published</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <CreditCard size={20} strokeWidth={1.5} className=" text-green-600" />
                                    2. Commission and Payments
                                </h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Sole-ly charges a <strong>6% commission</strong> on the product price of each completed sale</li>
                                    <li><strong>The delivery fee is never commissioned.</strong> Commission is calculated on the product subtotal only, the delivery fee you agree with the buyer is passed through to you in full</li>
                                    <li>Payments are held in escrow until delivery is confirmed (see section 4)</li>
                                    <li><strong>Withdrawals:</strong> You can withdraw your earnings to M-Pesa at any time. A disbursement fee applies per withdrawal and is deducted from the amount sent: <strong>KES 10</strong> up to KES 100, <strong>KES 20</strong> up to KES 1,000, and <strong>KES 100</strong> above that</li>
                                    <li><strong>Auto-Payout:</strong> If your balance exceeds <strong>KES 10,000</strong>, the system may automatically process a payout to your registered M-Pesa number</li>
                                    <li><strong>Payout Method:</strong> All payouts are sent via M-Pesa to your registered phone number. Keeping that number correct and active is your responsibility</li>
                                    <li><strong>Current rates:</strong> The commission rate, fee tiers, and auto-payout threshold above are the values currently in force. We may change them, and the rate in force at the time of a sale is the rate that applies to it</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">3. Product Listings</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Products go live immediately after submission (no admin approval required)</li>
                                    <li>You must provide accurate descriptions, prices, sizes, and images. Images must be of the actual item you are selling</li>
                                    <li>Stock levels must be kept accurate to avoid order cancellations</li>
                                    <li><strong>Permitted categories:</strong> Footwear, apparel, electronics, beauty, sports, accessories, home, and kids' items. Listing outside the categories supported on the Platform is not permitted</li>
                                    <li>Counterfeit, replica, or fake branded items are strictly prohibited</li>
                                    <li>Stolen goods, recalled goods, and items you are not legally entitled to sell are strictly prohibited</li>
                                    <li><strong>Moderation:</strong> Sole-ly may pause, edit, or remove any listing that breaches these terms, and may pause your listings while an investigation is ongoing</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">4. Order Fulfillment &amp; Timelines</h3>
                                <p className="text-muted-foreground mb-3">
                                    As a vendor, you agree to adhere to the following timelines:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Delivery fee:</strong> Agree the delivery fee with the buyer in the in-app negotiation before the order is paid. Respond promptly, an agreement neither side completes will expire and the sale is lost</li>
                                    <li><strong>Confirmation:</strong> Accept or reject new orders within <strong>48 hours</strong></li>
                                    <li><strong>Delivery:</strong> Arrange and deliver orders within <strong>5 days</strong> of confirmation. You are fully responsible for delivery logistics</li>
                                    <li><strong>Package PIN:</strong> Write the order's 3-digit Package PIN on the package before it goes out. The buyer needs it to confirm receipt</li>
                                </ul>

                                <div className="mt-4 bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                                    <h4 className="font-semibold text-green-800 mb-2">🔐 How You Get Paid</h4>
                                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li>The buyer inspects the item and enters the <strong>3-digit Package PIN</strong> from the package to confirm receipt</li>
                                        <li>Sole-ly then shows the buyer a <strong>6-digit OTP</strong>. Ask them for it and enter it on your Vendor Orders page to <strong>release your funds immediately</strong></li>
                                        <li>If you never enter the OTP, escrow releases to you automatically <strong>6 hours</strong> after the buyer entered the Package PIN</li>
                                        <li><strong>Pickup orders have no auto-release.</strong> For collections, funds move only when you enter the buyer's OTP, so always collect it at handover</li>
                                        <li><strong>Do NOT</strong> pressure buyers into entering the Package PIN or handing over the OTP before they have received and inspected the product. Doing so is grounds for suspension</li>
                                    </ul>
                                </div>

                                <div className="mt-4 space-y-3">
                                    <h4 className="font-semibold text-foreground">Order Automation Rules</h4>
                                    <p className="text-muted-foreground bg-red-50 border border-red-200 p-3 rounded-lg">
                                        ❌ <strong>Auto-Cancel (48 hours):</strong> Orders not confirmed by the vendor within 48 hours will be automatically cancelled and the buyer refunded.
                                    </p>
                                    <p className="text-muted-foreground bg-amber-50 border border-amber-200 p-3 rounded-lg">
                                        ⚠️ <strong>Auto-Dispute (5 days):</strong> If an order is confirmed but not marked as "Arrived" within 5 days, a dispute is automatically raised for admin review.
                                    </p>
                                    <p className="text-muted-foreground bg-green-50 border border-green-200 p-3 rounded-lg">
                                        ✅ <strong>Auto-Release (6 hours after PIN):</strong> Once the buyer enters the Package PIN, escrow releases to you automatically after 6 hours if the OTP has not been entered. This protects you from a buyer who receives the goods and then goes quiet. It does not apply to pickup orders.
                                    </p>
                                    <p className="text-sm bg-blue-50 border border-blue-200 p-3 rounded-lg text-muted-foreground mt-2">
                                        💡 <strong>Buyer won't enter the PIN?</strong> If a buyer has received the correct item but refuses to confirm, raise a dispute. Sole-ly admin will review and release funds in your favour where the evidence supports it. If the item was genuinely wrong or damaged, take it back, the buyer will be refunded and no commission is charged.
                                    </p>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <AlertTriangle size={20} strokeWidth={1.5} className=" text-red-600" />
                                    5. Disputes and Returns
                                </h3>
                                <h4 className="font-semibold text-foreground mb-2">Grounds for Dispute</h4>
                                <p className="text-muted-foreground mb-3">
                                    Buyers may file a dispute before entering the Package PIN, or within the 6-hour window after entering it, for the following reasons:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                    <li><strong>Item Not Received:</strong> The package never arrived</li>
                                    <li><strong>Wrong Item:</strong> You sent the wrong size, colour, model, or product</li>
                                    <li><strong>Damaged/Defective:</strong> The item arrived damaged or significantly different from the description</li>
                                    <li><strong>Counterfeit:</strong> The item is proven to be fake</li>
                                </ul>

                                <h4 className="font-semibold text-foreground mb-2">Resolution Process</h4>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                    <li>Vendors will be notified immediately when a dispute is raised</li>
                                    <li>You must respond with supporting evidence (e.g., photos of the packed item, courier receipts) within 48 hours</li>
                                    <li>Funds remain frozen in escrow during the investigation</li>
                                    <li><strong>Sole-ly Admin Decision:</strong> If the dispute is resolved in favour of the buyer, a full refund is issued including the delivery fee. If resolved in favour of the vendor, funds are released</li>
                                </ul>

                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-foreground mb-2">Sizing, Fit, and "Change of Mind"</h4>
                                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li><strong>Vendor Responsibility:</strong> You are liable for returns if you sent something other than what was ordered, for example the buyer ordered size 42 and you sent 43, or a different colour or model</li>
                                        <li><strong>Buyer Responsibility:</strong> If the item matches the description and the size ordered, but simply does not suit or fit the buyer, Sole-ly does not mandate a refund. Vendors may accept such returns at their own discretion, and the buyer is responsible for the return shipping costs</li>
                                        <li><strong>Accurate sizing is your job:</strong> Where an item runs small or large relative to its stated size, say so in the listing. Repeated fit disputes on inaccurately described items will be treated as misdescription</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Star size={20} strokeWidth={1.5} className=" text-yellow-500" />
                                    6. Ratings and Reputation
                                </h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Buyers rate you after receiving their orders (ratings are visible publicly)</li>
                                    <li>High ratings increase your visibility and attract more buyers</li>
                                    <li>Vendor reviews are anonymous - you cannot see who rated you</li>
                                    <li>Focus on product quality, fast shipping, and good communication for better ratings</li>
                                </ul>
                                <p className="text-muted-foreground mt-3 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                    <strong>💡 Tip:</strong> Vendors with 4+ star ratings are featured more prominently
                                    in search results and suggestions.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">7. Prohibited Conduct</h3>
                                <p className="text-muted-foreground mb-3">Vendors must not:</p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Sell counterfeit, fake, or replica branded products</li>
                                    <li>Sell stolen goods or goods you are not legally entitled to sell</li>
                                    <li>Misrepresent product condition (e.g., selling "thrifted" items as "new")</li>
                                    <li>Conduct or attempt to conduct transactions outside the Sole-ly platform (e.g., asking buyers to "pay via M-Pesa directly")</li>
                                    <li><strong>Collect delivery fees outside the platform</strong> after agreeing a fee in the in-app negotiation, or ask the buyer for "top-up" on delivery</li>
                                    <li>Pressure a buyer to enter the Package PIN or hand over the OTP before they have received and inspected the item</li>
                                    <li>Inflate prices to cover commission fees dishonestly</li>
                                    <li>Harass buyers or respond aggressively to reviews</li>
                                </ul>
                                <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-red-700 mb-2">Counterfeit and Stolen Goods Policy</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Sole-ly has a <strong>zero-tolerance policy</strong> for fakes and stolen goods. If you are found to be knowingly selling either:
                                    </p>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground mt-2">
                                        <li>Your account will be immediately suspended</li>
                                        <li>Sole-ly reserves the right to withhold any funds currently in your escrow balance to refund defrauded buyers</li>
                                        <li>We may report the matter, and share your account and order records, with law enforcement</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Database size={20} strokeWidth={1.5} className=" text-indigo-600" />
                                    8. Handling Buyer Data
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    To fulfil an order you receive the buyer's name, phone number, delivery address, and GPS pin if they shared one. Under the Kenya Data Protection Act, 2019 you are an independent data controller for that information, and you agree to:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Use buyer data <strong>only</strong> to fulfil and deliver that order, and to resolve any dispute arising from it</li>
                                    <li>Not market to buyers, add them to mailing or WhatsApp lists, or contact them for unrelated purposes without their consent</li>
                                    <li>Not sell, share, or publish buyer data, including sharing a buyer's location or phone number with anyone other than a courier engaged for that delivery</li>
                                    <li>Keep the data secure, and delete it once it is no longer needed for the order or your own tax and accounting obligations</li>
                                    <li>Tell us promptly if buyer data you hold is lost, exposed, or misused</li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    Misusing buyer data is grounds for immediate suspension, and you are responsible for any claim that arises from your handling of it.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">9. Payment Links and Checkout on Your Own Site</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>You may generate Sole-ly payment links and embed the Sole-ly checkout on your own website or social media page</li>
                                    <li>Orders placed this way are full Sole-ly orders: the same escrow, the same commission, the same dispute process, and the same fulfilment timelines apply</li>
                                    <li>You must not use payment links to sell items you have not listed, or items that would breach section 3 or 7</li>
                                    <li>You are responsible for what you say about Sole-ly on your own channels; do not describe Sole-ly as guaranteeing, endorsing, or authenticating your products</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Scale size={20} strokeWidth={1.5}  />
                                    10. Account Suspension and Termination
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Sole-ly may suspend, restrict, or terminate your vendor account if you:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Violate these terms and conditions</li>
                                    <li>Receive excessive disputes or negative ratings</li>
                                    <li>Fail to fulfill orders consistently</li>
                                    <li>Engage in fraudulent activity</li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    We may pause your listings while an investigation is underway. Upon termination, any pending payouts will be held for <strong>30 days</strong> to resolve any outstanding disputes before release. You may close your vendor account at any time once all open orders are completed or cancelled.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">11. Indemnification</h3>
                                <p className="text-muted-foreground">
                                    You agree to indemnify and hold Sole-ly harmless from any claims, damages, or
                                    expenses arising from your products, your violation of these terms, your handling of buyer data, or any
                                    dispute with buyers resulting from your actions.
                                </p>
                            </section>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* GENERAL TERMS */}
                <Card className="p-6 md:p-8 mt-6 space-y-6">
                    <h2 className="text-2xl font-bold">General Terms</h2>

                    <section>
                        <h3 className="text-lg font-semibold mb-2">Privacy</h3>
                        <p className="text-muted-foreground">
                            Our <Link to="/privacy-policy" className="text-primary underline">Privacy Policy</Link> explains what personal data we collect, why we are allowed to process it, who we share it with, and the rights you have under the Kenya Data Protection Act, 2019. It forms part of these terms.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold mb-2">Service Availability</h3>
                        <p className="text-muted-foreground">
                            We aim to keep the Platform available at all times, but we may take it offline for maintenance or suspend checkout temporarily. Where this happens we will show a notice on the Platform. Orders already in escrow are unaffected by maintenance.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold mb-2">Changes to Terms</h3>
                        <p className="text-muted-foreground">
                            Sole-ly reserves the right to modify these terms at any time. We will update the "Last updated" date above and, for significant changes, post a notice on the Platform or email you. Continued use of
                            the platform after changes constitutes acceptance of the new terms. The terms in force when you place an order govern that order.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold mb-2">Governing Law</h3>
                        <p className="text-muted-foreground">
                            These terms are governed by the laws of Kenya. Any disputes shall be resolved
                            in Kenyan courts.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold mb-2">Contact Us</h3>
                        <p className="text-muted-foreground">
                            For questions about these terms, contact us at{" "}
                            <a href="mailto:contact@solelymarketplace.com" className="text-primary underline">
                                contact@solelymarketplace.com
                            </a>
                        </p>
                    </section>
                </Card>
            </div>
        </div >
    );
};

export default Terms;
