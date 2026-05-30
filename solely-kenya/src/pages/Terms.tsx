import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, ShoppingBag, Store, AlertTriangle, CreditCard, Star, Scale } from "lucide-react";

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
                        Last updated: May 2026
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
                                <p className="text-sm text-muted-foreground mb-4">Last Updated: May 2026</p>
                                <p className="text-muted-foreground leading-relaxed">
                                    Welcome to Sole-ly, Kenya's trusted online shoe marketplace. These Terms and Conditions constitute a legally binding agreement between you ("the Buyer") and Sole-ly ("the Platform"). By creating an account or purchasing products, you agree to these terms.
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
                                        <li><strong>No Affiliation:</strong> Sole-ly Kenya is NOT affiliated, associated, authorized, endorsed by, or in any way officially connected with any brands listed on the platform (such as Nike, Adidas, Puma, etc.). All brand names, logos, and trademarks are the property of their respective owners.</li>
                                        <li><strong>"Mint" / "Unworn" Condition:</strong> Items listed as "Mint" or "Unworn" are resale items in brand-new condition. They are sold by independent owners, not by authorized retailers, and may not come with the original manufacturer's warranty.</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">1. Account Registration</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Accuracy:</strong> You must provide accurate personal information and valid contact details during registration</li>
                                    <li><strong>Security:</strong> You are responsible for maintaining the confidentiality of your account credentials. You are liable for all activities that occur under your account</li>
                                    <li><strong>Eligibility:</strong> You must be at least 18 years old to make purchases on Sole-ly</li>
                                    <li><strong>One Account:</strong> One person may only operate one buyer account. Creating duplicate accounts to abuse promotions is prohibited</li>
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
                                    <li><strong>Payment:</strong> When you order, your money is held in a neutral escrow account—it is not sent directly to the vendor immediately</li>
                                    <li><strong>Protection:</strong> Your funds remain secured in escrow while the vendor processes and ships your order</li>
                                    <li><strong>Release:</strong> Funds are released to the vendor <strong>only</strong> when the buyer shares their OTP after inspecting and accepting the item. No OTP = no payment, no exceptions</li>
                                    <li><strong>Accepted Payment Methods:</strong> M-Pesa, Credit/Debit Cards, and Mobile Wallets</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">3. Ordering Process & Timelines</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Confirmation Window:</strong> Vendors must accept or decline your order within <strong>48 hours</strong>. If they fail to do so, the order is automatically cancelled, and you receive a full refund</li>
                                    <li><strong>Delivery Window:</strong> Once confirmed, vendors have <strong>5 days</strong> to deliver your order. If not delivered, a dispute is automatically raised for admin review</li>
                                    <li><strong>Updates:</strong> You will receive order updates via the platform/email as your order progresses</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">3.5. Delivery</h3>
                                <p className="text-muted-foreground mb-3">
                                    Delivery on Sole-ly is facilitated directly by the vendor, not the platform:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Vendor-Facilitated Delivery:</strong> Vendors arrange and handle delivery to your location themselves. Sole-ly does not charge any delivery fees</li>
                                    <li><strong>Free Delivery:</strong> Some vendors offer free delivery — look for the "Free Delivery" badge on product listings</li>
                                    <li><strong>Delivery Costs:</strong> If a vendor charges for delivery, this will be communicated and arranged directly between you and the vendor, outside the platform price</li>
                                    <li><strong>Location Sharing:</strong> During checkout, you can optionally share your GPS location pin to make it easier for the vendor to find you</li>
                                    <li><strong>Communication:</strong> Once your order is confirmed, the vendor's contact details are available so you can coordinate delivery logistics directly</li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    <strong>Note:</strong> Since Sole-ly does not manage delivery, any delivery fees agreed upon between you and the vendor are separate from the product price shown on the platform.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">4. Delivery Confirmation via OTP (Critical)</h3>
                                <p className="text-muted-foreground mb-3">
                                    Sole-ly uses a <strong>One-Time Password (OTP)</strong> system to securely confirm deliveries and protect both buyers and vendors:
                                </p>

                                <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                                    <h4 className="font-semibold text-green-800 mb-2">🔐 How OTP Delivery Confirmation Works</h4>
                                    <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li>When the vendor ships your order, you receive a <strong>6-digit OTP code</strong> via email</li>
                                        <li>You can also view your OTP code in your <strong>Orders</strong> page on Sole-ly</li>
                                        <li><strong>Keep this code private</strong> until you have inspected the shoes and are satisfied</li>
                                        <li>Upon delivery, share the OTP code with the vendor/courier <strong>only after you have verified</strong> the shoes are correct</li>
                                        <li>The vendor enters the code to confirm delivery — this <strong>immediately releases the escrowed funds</strong> to them</li>
                                    </ol>
                                </div>

                                <p className="text-muted-foreground mb-3">
                                    When your order arrives, it is your responsibility to:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Inspect:</strong> Check the shoes immediately for quality, size, and accuracy</li>
                                    <li><strong>Verify:</strong> Only share your OTP code with the vendor/courier <strong>after</strong> you are satisfied with the product</li>
                                    <li><strong>Report Issues:</strong> If there is a problem, <strong>do NOT share your OTP</strong> — file a dispute instead</li>
                                </ul>

                                <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-red-800 mb-2">🔒 OTP = Your Final Confirmation</h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                                        <li><strong>Inspect First, Share Second:</strong> Before handing over your OTP, physically inspect the shoes. Check the size, condition, and that they match your order</li>
                                        <li><strong>Sharing = Satisfied:</strong> By giving your OTP to the vendor, you confirm you have received the correct item in acceptable condition. <strong>This cannot be undone</strong></li>
                                        <li><strong>Problem? Don't share the OTP:</strong> If something is wrong, withhold the OTP and contact support to file a dispute. The vendor will take the shoes back and you will receive a full refund</li>
                                        <li><strong>Lost your OTP?</strong> You can always view it in your <strong>Orders page</strong> on Sole-ly</li>
                                    </ul>
                                </div>
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
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    Our admin team will review disputes within <strong>3-5 business days</strong>.
                                    Refunds are processed to your original payment method when approved.
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
                                    <li>Your identity remains anonymous to vendors in reviews</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">7. Prohibited Activities</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Filing false disputes or fraudulent claims</li>
                                    <li>Attempting to bypass the escrow system</li>
                                    <li>Harassing or threatening vendors</li>
                                    <li>Using the platform for illegal activities</li>
                                    <li>Creating multiple accounts to abuse promotions</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">8. Limitation of Liability</h3>
                                <p className="text-muted-foreground">
                                    Sole-ly acts as a marketplace connecting buyers and vendors. While we verify vendors
                                    and protect payments, we are not responsible for the quality of products sold by
                                    independent vendors. Our liability is limited to facilitating dispute resolution
                                    and refunds through our escrow system.
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
                                <p className="text-sm text-muted-foreground mb-4">Last Updated: February 2026</p>
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
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <CreditCard size={20} strokeWidth={1.5} className=" text-green-600" />
                                    2. Commission and Payments
                                </h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Sole-ly charges a <strong>6% commission</strong> on the product price of each completed sale</li>
                                    <li>Payments are held in escrow until the buyer confirms delivery by sharing their OTP code</li>
                                    <li><strong>Withdrawals:</strong> You can withdraw your earnings to M-Pesa at any time. Standard M-Pesa transaction fees apply and are deducted from the withdrawal amount</li>
                                    <li><strong>Auto-Payout:</strong> If your balance exceeds KES 10,000, the system may automatically process a payout to your registered M-Pesa number</li>
                                    <li><strong>Payout Method:</strong> All payouts are sent via M-Pesa to your registered phone number</li>
                                </ul>

                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">3. Product Listings</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Products go live immediately after submission (no admin approval required)</li>
                                    <li>You must provide accurate descriptions, prices, and images</li>
                                    <li>Use high-quality images to attract more buyers</li>
                                    <li>Stock levels must be kept accurate to avoid order cancellations</li>
                                    <li>Only genuine footwear products are allowed</li>
                                    <li>Counterfeit or fake branded items are strictly prohibited</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">4. Order Fulfillment & Timelines</h3>
                                <p className="text-muted-foreground mb-3">
                                    As a vendor, you agree to adhere to the following strict timelines:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Confirmation:</strong> Accept or reject new orders within <strong>48 hours</strong></li>
                                    <li><strong>Delivery:</strong> Arrange and deliver orders within <strong>5 days</strong> of confirmation. You are fully responsible for delivery logistics</li>
                                    <li><strong>OTP Verification:</strong> Upon delivery, collect the buyer's <strong>6-digit OTP code</strong> and enter it on Sole-ly to confirm delivery and release funds</li>
                                </ul>

                                <div className="mt-4 bg-green-50 border border-green-200 p-4 rounded-lg mb-4">
                                    <h4 className="font-semibold text-green-800 mb-2">🔐 OTP Delivery Confirmation</h4>
                                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li>When you mark an order as <strong>"Shipped"</strong>, a 6-digit OTP is automatically sent to the buyer via email</li>
                                        <li>Upon delivery, <strong>ask the buyer for their OTP code</strong> after they have inspected the item</li>
                                        <li>Enter the OTP on your Vendor Orders page to <strong>immediately confirm delivery and release funds</strong></li>
                                        <li>If the buyer has lost their OTP, you can <strong>resend it</strong> from your orders page</li>
                                        <li><strong>Do NOT</strong> pressure buyers into sharing the OTP before they have inspected the product</li>
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
                                        ✅ <strong>OTP Release (Only):</strong> Funds are released <strong>exclusively</strong> when the buyer provides their OTP after inspecting the item. There is no auto-release timer — the OTP is the only key.
                                    </p>
                                    <p className="text-sm bg-blue-50 border border-blue-200 p-3 rounded-lg text-muted-foreground mt-2">
                                        💡 <strong>Buyer refuses OTP?</strong> If a buyer withholds the OTP after receiving the correct item, raise a dispute immediately. Sole-ly admin will review and release funds in your favour. If the item was genuinely wrong or damaged, take it back — the buyer will be refunded and no commission is charged.
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
                                    Buyers may file a dispute <strong>before sharing their OTP</strong> for the following reasons:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                    <li><strong>Item Not Received:</strong> The package never arrived</li>
                                    <li><strong>Wrong Item:</strong> The vendor sent the wrong size, color, or model</li>
                                    <li><strong>Damaged/Defective:</strong> The item arrived damaged or significantly different from the description</li>
                                    <li><strong>Counterfeit:</strong> The item is proven to be fake</li>
                                </ul>

                                <h4 className="font-semibold text-foreground mb-2">Resolution Process</h4>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                    <li>Vendors will be notified immediately when a dispute is raised</li>
                                    <li>You must respond with supporting evidence (e.g., photos of the packed item, courier receipts) within 48 hours</li>
                                    <li>Funds remain frozen in escrow during the investigation</li>
                                    <li><strong>Sole-ly Admin Decision:</strong> If the dispute is resolved in favor of the buyer, a full refund is issued. If resolved in favor of the vendor, funds are released</li>
                                </ul>

                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-foreground mb-2">"Fit" and "Change of Mind"</h4>
                                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li><strong>Vendor Responsibility:</strong> You are liable for returns if you sent the wrong size (e.g., Buyer ordered 42, you sent 43)</li>
                                        <li><strong>Buyer Responsibility:</strong> If the item matches the description/size ordered but does not fit the buyer's foot comfortably, Sole-ly does not mandate a refund. Vendors may choose to accept such returns at their own discretion, but the buyer is responsible for all shipping costs</li>
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
                                    <li>Misrepresent product condition (e.g., selling "used" shoes as "new")</li>
                                    <li>Conduct or attempt to conduct transactions outside the Sole-ly platform (e.g., asking buyers to "pay via M-Pesa directly")</li>
                                    <li>Inflate prices to cover commission fees dishonestly</li>
                                    <li>Harass buyers or respond aggressively to reviews</li>
                                </ul>
                                <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-lg">
                                    <h4 className="font-semibold text-red-700 mb-2">Counterfeit Policy</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Sole-ly has a <strong>zero-tolerance policy</strong> for fakes. If you are found to be knowingly selling counterfeit goods:
                                    </p>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground mt-2">
                                        <li>Your account will be immediately suspended</li>
                                        <li>Sole-ly reserves the right to withhold any funds currently in your escrow balance to refund defrauded buyers</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Scale size={20} strokeWidth={1.5}  />
                                    8. Account Suspension and Termination
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Sole-ly may suspend or terminate your vendor account if you:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Violate these terms and conditions</li>
                                    <li>Receive excessive disputes or negative ratings</li>
                                    <li>Fail to fulfill orders consistently</li>
                                    <li>Engage in fraudulent activity</li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    Upon termination, any pending payouts will be held for <strong>30 days</strong>
                                    to resolve any outstanding disputes before release.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">9. Indemnification</h3>
                                <p className="text-muted-foreground">
                                    You agree to indemnify and hold Sole-ly harmless from any claims, damages, or
                                    expenses arising from your products, your violation of these terms, or any
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
                        <h3 className="text-lg font-semibold mb-2">Changes to Terms</h3>
                        <p className="text-muted-foreground">
                            Sole-ly reserves the right to modify these terms at any time. Continued use of
                            the platform after changes constitutes acceptance of the new terms.
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

