import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, ShoppingBag, Store, AlertTriangle, CreditCard, Star, Scale, Truck, KeyRound, Database, ShieldAlert } from "lucide-react";

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
                                    Welcome to Solely, Kenya's trusted online marketplace. These Terms and Conditions constitute a legally binding agreement between you ("the Buyer") and Solely ("the Platform"). By creating an account, checking out as a guest, or purchasing products, you agree to these terms.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Scale size={20} strokeWidth={1.5} className=" text-primary-strong" />
                                    0. Platform Disclaimer (Important)
                                </h3>
                                <div className="bg-primary-soft border border-primary/30 p-4 rounded-lg mb-4">
                                    <p className="text-primary-strong font-medium mb-2">Solely Kenya is an Online Marketplace</p>
                                    <ul className="list-disc pl-6 space-y-2 text-primary-strong text-sm">
                                        <li>Solely Kenya does not own or sell the products listed on this platform. We are a venue connecting third-party independent vendors with buyers.</li>
                                        <li><strong>No Affiliation:</strong> Solely Kenya is NOT affiliated, associated, authorized, endorsed by, or in any way officially connected with any brands listed on the platform. All brand names, logos, and trademarks are the property of their respective owners.</li>
                                        <li><strong>Resale Condition:</strong> Items listed as "New" are sold by independent vendors, not by authorized retailers, and may not come with the original manufacturer's warranty. Items listed as "Thrifted" or "Refurbished" are pre-owned and are described by the vendor, not by us.</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">1. Account Registration and Guest Checkout</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>Accuracy:</strong> You must provide accurate personal information and valid contact details, whether you register or check out as a guest</li>
                                    <li><strong>Security:</strong> You are responsible for maintaining the confidentiality of your account credentials. You are liable for all activities that occur under your account</li>
                                    <li><strong>Eligibility:</strong> You must be at least 18 years old to make purchases on Solely</li>
                                    <li><strong>One Account:</strong> One person may only operate one buyer account. Creating duplicate accounts to abuse promotions is prohibited</li>
                                    <li><strong>Guest orders:</strong> You may check out without an account. Your order is tracked through a private link we send you, anyone holding that link can view the order, so do not share it. We recommend creating an account so your orders, OTPs, and dispute history stay in one place</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <CreditCard size={20} strokeWidth={1.5} className=" text-success" />
                                    2. Escrow Payment Protection
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    To guarantee trust, Solely uses a secure Escrow System for all transactions:
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
                                    <li><strong>Shipping:</strong> Once they accept, vendors must ship within <strong>8 daytime hours</strong> (we expect most to ship within 3). Daytime means 7am to 6pm Kenya time; the clock pauses overnight. A vendor who sends you an update gets a little more time. If they neither ship nor update you, the order is cancelled and you are refunded in full</li>
                                    <li><strong>Before it ships:</strong> The vendor confirms exactly what is in your package and we show it to you. If it is not what you ordered, tap "This is wrong" and the package is held back</li>
                                    <li><strong>Delivery Window:</strong> Each delivery has a deadline based on distance: <strong>24 hours</strong> within the same town or county, <strong>48 hours</strong> to another county, <strong>72 hours</strong> to the coast or border counties, and <strong>10 days</strong> elsewhere in East Africa. Before the deadline we ask the vendor where your order is and pass any update on to you. If the deadline passes without an update, you are refunded in full</li>
                                    <li><strong>Updates:</strong> You will receive order updates via the platform, email, push notifications (if enabled) and SMS for urgent steps as your order progresses</li>
                                    <li><strong>Current windows:</strong> The time windows in these terms are the current settings. We may adjust them to keep the marketplace working well, and the values in force always apply to orders placed after the change</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Truck size={20} strokeWidth={1.5} className=" text-muted-foreground" />
                                    3.5. Delivery and the Delivery Fee
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Delivery is carried out by the vendor, but the delivery fee is agreed and paid <strong>through Solely</strong>:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li><strong>You agree the fee before you pay:</strong> After you enter your delivery details, you and the vendor negotiate the delivery fee in an in-app chat. Either side can propose a fee and method; the order proceeds once both sides accept</li>
                                    <li><strong>Paid in one checkout:</strong> The agreed delivery fee is added to your order total and paid in the same transaction as the product. It is held in escrow with the rest of your money</li>
                                    <li><strong>Free Delivery:</strong> Some vendors offer free delivery. Look for the "Free Delivery" badge on product listings</li>
                                    <li><strong>Pickup:</strong> Where a vendor offers it, you may collect the item in person instead of paying a delivery fee</li>
                                    <li><strong>Location Sharing:</strong> During checkout, you can optionally share your GPS location pin to make it easier for the vendor to find you</li>
                                    <li><strong>Agreements expire:</strong> A delivery negotiation that neither side completes will expire, and you will need to start again. Nothing is charged for an expired negotiation</li>
                                    <li><strong>Vendor is the deliverer:</strong> Solely does not operate a courier fleet. The vendor is responsible for getting the item to you, whether they deliver it themselves or use a courier</li>
                                </ul>
                                <p className="text-muted-foreground mt-3 bg-muted border border-border p-3 rounded-lg text-sm">
                                    <strong>Do not pay delivery fees outside Solely.</strong> A fee paid directly to a vendor by M-Pesa is not held in escrow, is not covered by buyer protection, and cannot be refunded by us if something goes wrong. If a vendor asks you to pay outside the platform, report it to us.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <KeyRound size={20} strokeWidth={1.5} className=" text-success" />
                                    4. Confirming Delivery (Critical)
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Read this section carefully. It determines when the vendor is paid.
                                </p>

                                <div className="bg-success-soft border border-success/30 p-4 rounded-lg mb-4">
                                    <h4 className="font-semibold text-success mb-2">How confirmation works</h4>
                                    <ol className="list-decimal pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li>When your order arrives, the vendor marks it as arrived and we ask you to confirm</li>
                                        <li><strong>Inspect the item first.</strong> Check that it is correct, complete, and in the condition described</li>
                                        <li>If you are satisfied, tap <strong>"Yes, I got it"</strong> in the app, or give the vendor the <strong>6-digit code</strong> shown on your order. Either one pays the vendor immediately</li>
                                        <li>If something is wrong or it did not arrive, tap <strong>"Something wrong?"</strong>. The payment stays held while it is sorted out</li>
                                        <li>If you do nothing, we ask you a second time. If you still do not report a problem, the payment is released to the vendor <strong>6 daytime hours</strong> after the order was marked arrived (the clock pauses from 6pm to 7am)</li>
                                    </ol>
                                </div>

                                <div className="mt-4 bg-destructive-soft border border-destructive/30 p-4 rounded-lg">
                                    <h4 className="font-semibold text-destructive mb-2">Confirming is the point of no return</h4>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                                        <li><strong>Inspect first, confirm second:</strong> Confirming, or giving the vendor your code, tells us you have the correct item in acceptable condition. Do not do either while the courier is still holding the package or before you have opened it</li>
                                        <li><strong>Problem? Don't confirm:</strong> If the item is wrong, damaged, or missing, report it instead and your money stays held</li>
                                        <li><strong>Pickup orders:</strong> There is no automatic release. The vendor is paid when you confirm in the app or show them your code</li>
                                    </ul>
                                </div>

                                <p className="text-muted-foreground mt-4">
                                    <strong>Never share your code before you have the item in your hands and have inspected it.</strong> A vendor or courier who pressures you for it before handover is breaching our Vendor Agreement. Refuse, and report it to us.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <AlertTriangle size={20} strokeWidth={1.5} className=" text-primary-strong" />
                                    5. Disputes and Refunds
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    You may report a problem if:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>You did not receive your item</li>
                                    <li>You received a wrong or different item</li>
                                    <li>The item arrived damaged</li>
                                    <li>The item significantly differs from the description</li>
                                    <li>Items are missing from your order</li>
                                    <li>You received someone else's order</li>
                                    <li>The item is counterfeit</li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    <strong>When to report:</strong> Before you confirm the order, and before the payment is released automatically. Once the payment has been released we can still investigate and act against the vendor, but recovering funds becomes significantly harder.
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                                    <li><strong>Wrong, damaged, defective or not as described:</strong> The vendor is asked to offer a fix: a partial refund, a replacement, or a full refund once they collect the item. The vendor pays any delivery costs. If the vendor does not respond within <strong>48 hours</strong>, you are refunded in full. If you cannot agree within 48 hours, Solely decides</li>
                                    <li><strong>Items missing:</strong> The vendor has <strong>36 hours</strong> to send them. If they do not, you choose a refund for the missing items or keep the order as it is</li>
                                    <li><strong>Someone else's order:</strong> The vendor has <strong>24 hours</strong> to swap it, or you can ask for a full refund straight away</li>
                                    <li><strong>Not received:</strong> If the vendor marked your order as arrived but you do not have it, Solely's team reviews it and the payment stays held</li>
                                    <li><strong>Returns:</strong> Where an item is returned, the vendor arranges and pays for collection. Once you hand it over, the vendor has 48 hours to confirm it, or you are refunded automatically</li>
                                    <li><strong>No change-of-mind returns:</strong> Once an order has shipped it cannot be cancelled or returned unless it is damaged, not as described, or not what you ordered. If you refuse a correct delivery, the vendor keeps the delivery fee and you are refunded the item price</li>
                                    <li><strong>If you can't be reached:</strong> If the vendor reports that you are unavailable at delivery, we notify you and try to call you. If you do not respond within <strong>12 hours</strong>, the order is cancelled, the vendor keeps the delivery fee and you are refunded the item price</li>
                                    <li><strong>Reviews of automatic decisions:</strong> Either you or the vendor can ask Solely to review an automatic decision within <strong>48 hours</strong></li>
                                </ul>
                                <p className="text-muted-foreground mt-3">
                                    Refunds are processed to your original payment method. Where you are owed your full payment, the delivery fee is refunded along with the product price.
                                </p>
                                <p className="text-muted-foreground mt-3">
                                    <strong>Repeated false reports:</strong> Buyers who repeatedly lose disputes may have their account suspended from placing new orders.
                                </p>
                                                                <p className="text-muted-foreground mt-3">
                                    <strong>Stolen goods:</strong> If you believe an item you received or saw listed is stolen, tell us using the <Link to="/report-listing" className="text-primary underline">Report a Listing</Link> form. We may suspend the listing and vendor and share relevant records with law enforcement or the lawful owner.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Star size={20} strokeWidth={1.5} className=" text-primary-strong" />
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
                                    <li>Falsely reporting a problem after receiving the correct item, in order to obtain goods without paying</li>
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
                                    Solely acts as a marketplace connecting buyers and vendors. While we verify vendors and protect payments, we are not the seller and we are not responsible for the quality, safety, legality, or accuracy of products listed by independent vendors.
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
                                    Solely Vendor Agreement
                                </h2>
                                <p className="text-sm text-muted-foreground mb-4">Last Updated: September 2026</p>
                                <p className="text-muted-foreground leading-relaxed">
                                    By registering as a vendor on Solely, you agree to provide high-quality products
                                    and excellent customer service. These terms govern your relationship with Solely and buyers on the platform.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3">1. Vendor Registration</h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>You must provide accurate business information and valid contact details</li>
                                    <li>You must have legal authorization to sell the products you list</li>
                                    <li>Solely reserves the right to verify vendor information</li>
                                    <li>You are responsible for all taxes applicable to your sales</li>
                                    <li><strong>Public information:</strong> Your store name, description, location, ratings, and the store phone number you provide are displayed publicly so buyers can reach you. Your M-Pesa payout number is never published</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <CreditCard size={20} strokeWidth={1.5} className=" text-success" />
                                    2. Commission and Payments
                                </h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Solely charges a <strong>6% commission</strong> on the product price of each completed sale</li>
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
                                    <li><strong>Moderation:</strong> Solely may pause, edit, or remove any listing that breaches these terms, and may pause your listings while an investigation is ongoing</li>
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
                                    <li><strong>Shipping:</strong> Ship within <strong>8 daytime hours</strong> of accepting (aim for 3). Daytime means 7am to 6pm Kenya time; the clock pauses overnight, so you may accept at night and ship in the morning. Each update you send the buyer adds 3 hours, up to twice</li>
                                    <li><strong>Packing list:</strong> Before shipping, confirm each item in the package and add a short description. The buyer sees it first; if they say it is wrong, shipping is paused for up to 2 hours while you sort it out</li>
                                    <li><strong>Delivery:</strong> Deliver within the window for the distance: <strong>24 hours</strong> within the same town or county, <strong>48 hours</strong> to another county, <strong>72 hours</strong> to the coast or border counties, <strong>10 days</strong> elsewhere in East Africa. When we ask where an order is, reply with an update: each one adds 24 hours, up to three times, after which Solely steps in. You are fully responsible for delivery logistics</li>
                                </ul>

                                <div className="mt-4 bg-success-soft border border-success/30 p-4 rounded-lg mb-4">
                                    <h4 className="font-semibold text-success mb-2">How you get paid</h4>
                                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li>When the order arrives, mark it as arrived. The buyer is asked to confirm</li>
                                        <li>When the buyer confirms in the app, or gives you their <strong>6-digit code</strong> to enter on your Orders page, your funds are <strong>released immediately</strong></li>
                                        <li>If the buyer does not report a problem, the funds are released to you automatically <strong>6 daytime hours</strong> after you marked the order arrived</li>
                                        <li><strong>Pickup orders have no auto-release.</strong> Funds move when the buyer confirms or you enter their code, so always collect it at handover</li>
                                        <li><strong>Do NOT</strong> mark an order as arrived before it reaches the buyer, or pressure buyers into confirming or handing over their code before they have received and inspected the product. Doing so is grounds for suspension</li>
                                    </ul>
                                </div>

                                <div className="mt-4 space-y-3">
                                    <h4 className="font-semibold text-foreground">Strikes and suspension</h4>
                                    <p className="text-muted-foreground bg-destructive-soft border border-destructive/30 p-3 rounded-lg">
                                        You receive a <strong>strike</strong> if you accept an order and then miss the shipping or delivery deadline without sending an update (the buyer is refunded in full), or if you report a buyer as unavailable and Solely confirms they were there. Your first and second strikes come with a warning. <strong>Three strikes within 90 days suspends your shop</strong>: your listings are hidden and you cannot take new orders until Solely restores you. Orders you already have continue as normal. Strikes expire after 90 days. Cancelling an order yourself (which refunds the buyer in full) is not a strike.
                                    </p>
                                    <p className="text-muted-foreground bg-muted border border-border p-3 rounded-lg">
                                        <strong>Buyer unavailable at delivery?</strong> Tap "Buyer not available?" on the order and please wait a while. We notify the buyer and Solely's team calls them (during support hours, 8am to 5pm). If they do not respond within 12 hours, the order is cancelled, you keep the delivery fee and the buyer is refunded the item price.
                                    </p>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <AlertTriangle size={20} strokeWidth={1.5} className=" text-destructive" />
                                    5. Disputes and Returns
                                </h3>
                                <h4 className="font-semibold text-foreground mb-2">Grounds for Dispute</h4>
                                <p className="text-muted-foreground mb-3">
                                    Buyers may report a problem before they confirm the order, and before the payment is released automatically, for the following reasons:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                    <li><strong>Item Not Received:</strong> The package never arrived</li>
                                    <li><strong>Wrong Item:</strong> You sent the wrong size, colour, model, or product</li>
                                    <li><strong>Damaged/Defective:</strong> The item arrived damaged or significantly different from the description</li>
                                    <li><strong>Missing Items:</strong> Part of the order was not in the package</li>
                                    <li><strong>Someone Else's Order:</strong> The buyer received a package meant for another buyer</li>
                                    <li><strong>Counterfeit:</strong> The item is proven to be fake</li>
                                </ul>

                                <h4 className="font-semibold text-foreground mb-2">Resolution Process</h4>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                                    <li>You are notified immediately when a problem is reported, and the payment is held</li>
                                    <li><strong>Wrong, damaged, defective or not as described:</strong> Offer a fix from the order within <strong>48 hours</strong>: a partial refund, a replacement, or a full refund once you collect the item. If you do not respond, the buyer is refunded in full. If you cannot agree within 48 hours, Solely decides</li>
                                    <li><strong>Missing items:</strong> Send them within <strong>36 hours</strong>. If you do not, the buyer may choose a refund for those items</li>
                                    <li><strong>Someone else's order:</strong> Swap it within <strong>24 hours</strong>, or the buyer is refunded</li>
                                    <li><strong>Returns:</strong> Where it is your fault, you arrange and pay for collecting the item and any re-delivery. Once the buyer hands it back you have <strong>48 hours</strong> to confirm or dispute it, or the buyer is refunded automatically</li>
                                    <li>You can send Solely your side, with photos of what you packed, at any time from the Problems page</li>
                                    <li><strong>Solely Admin Decision:</strong> If resolved in favour of the buyer, a full refund is issued including the delivery fee. If resolved in favour of the vendor, funds are released. Either party can ask Solely to review an automatic decision within 48 hours</li>
                                </ul>

                                <div className="bg-muted border border-border p-4 rounded-lg">
                                    <h4 className="font-semibold text-foreground mb-2">Sizing, Fit, and "Change of Mind"</h4>
                                    <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                                        <li><strong>Vendor Responsibility:</strong> You are liable for returns if you sent something other than what was ordered, for example the buyer ordered size 42 and you sent 43, or a different colour or model</li>
                                        <li><strong>Buyer Responsibility:</strong> If the item matches the description and the size ordered, but simply does not suit or fit the buyer, Solely does not mandate a refund. Vendors may accept such returns at their own discretion, and the buyer is responsible for the return shipping costs</li>
                                        <li><strong>Accurate sizing is your job:</strong> Where an item runs small or large relative to its stated size, say so in the listing. Repeated fit disputes on inaccurately described items will be treated as misdescription</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Star size={20} strokeWidth={1.5} className=" text-primary-strong" />
                                    6. Ratings and Reputation
                                </h3>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Buyers rate you after receiving their orders (ratings are visible publicly)</li>
                                    <li>High ratings increase your visibility and attract more buyers</li>
                                    <li>Vendor reviews are anonymous - you cannot see who rated you</li>
                                    <li>Focus on product quality, fast shipping, and good communication for better ratings</li>
                                </ul>
                                <p className="text-muted-foreground mt-3 bg-muted border border-border p-3 rounded-lg">
                                    <strong>Tip:</strong> Vendors with 4+ star ratings are featured more prominently
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
                                    <li>Conduct or attempt to conduct transactions outside the Solely platform (e.g., asking buyers to "pay via M-Pesa directly")</li>
                                    <li><strong>Collect delivery fees outside the platform</strong> after agreeing a fee in the in-app negotiation, or ask the buyer for "top-up" on delivery</li>
                                    <li>Mark an order as arrived before it reaches the buyer, or pressure a buyer to confirm or hand over their code before they have received and inspected the item</li>
                                    <li>Inflate prices to cover commission fees dishonestly</li>
                                    <li>Harass buyers or respond aggressively to reviews</li>
                                </ul>
                                <div className="mt-4 bg-destructive-soft border border-destructive/30 p-4 rounded-lg">
                                    <h4 className="font-semibold text-destructive mb-2">Counterfeit and Stolen Goods Policy</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Solely has a <strong>zero-tolerance policy</strong> for fakes and stolen goods. If you are found to be knowingly selling either:
                                    </p>
                                    <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground mt-2">
                                        <li>Your account will be immediately suspended</li>
                                        <li>Solely reserves the right to withhold any funds currently in your escrow balance to refund defrauded buyers</li>
                                        <li>We may report the matter, and share your account and order records, with law enforcement</li>
                                    </ul>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Database size={20} strokeWidth={1.5} className=" text-muted-foreground" />
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
                                    <li>You may generate Solely payment links and embed the Solely checkout on your own website or social media page</li>
                                    <li>Orders placed this way are full Solely orders: the same escrow, the same commission, the same dispute process, and the same fulfilment timelines apply</li>
                                    <li>You must not use payment links to sell items you have not listed, or items that would breach section 3 or 7</li>
                                    <li>You are responsible for what you say about Solely on your own channels; do not describe Solely as guaranteeing, endorsing, or authenticating your products</li>
                                </ul>
                            </section>

                            <section>
                                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                                    <Scale size={20} strokeWidth={1.5}  />
                                    10. Account Suspension and Termination
                                </h3>
                                <p className="text-muted-foreground mb-3">
                                    Solely may suspend, restrict, or terminate your vendor account if you:
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
                                    You agree to indemnify and hold Solely harmless from any claims, damages, or
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
                        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <ShieldAlert size={18} strokeWidth={1.5} className="text-primary-strong" />
                            Reporting Counterfeits and Infringement
                        </h3>
                        <p className="text-muted-foreground mb-3">
                            Solely does not permit listings that infringe anyone's copyright, trademark, right of publicity, or other proprietary rights, and we do not permit counterfeit goods. If you own such a right, represent someone who does, or are simply a buyer who has spotted a problem, tell us.
                        </p>
                        <div className="bg-primary-soft border border-primary/30 p-4 rounded-lg mb-3">
                            <p className="text-sm text-muted-foreground mb-2">
                                <strong>How to report:</strong> Use the <Link to="/report-listing" className="text-primary underline font-semibold">Report a Listing</Link> form. You do not need an account. Every product page also carries a "Report this listing" link, which fills in the listing for you. If you would rather write to us, email{" "}
                                <a href="mailto:contact@solelymarketplace.com" className="text-primary underline">contact@solelymarketplace.com</a> with the listing link, what right is affected, how it is infringed, and your contact details.
                            </p>
                        </div>
                        <p className="text-muted-foreground mb-3"><strong>What happens next:</strong></p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-3">
                            <li>We aim to review every report within <strong>2 business days</strong></li>
                            <li>Where a listing breaches these terms we remove or suspend it, and we notify the vendor with the substance of the report so they can respond</li>
                            <li>Where money for an affected order is still held in escrow, we can withhold it pending the outcome</li>
                            <li>We keep a record of every report and what was decided</li>
                        </ul>
                        <p className="text-muted-foreground mb-3">
                            <strong>Repeat infringers:</strong> A vendor who repeatedly lists infringing or counterfeit items will have their selling privileges revoked and their account terminated. As set out in the Vendor Agreement, we may withhold funds in their escrow balance to refund affected buyers.
                        </p>
                        <p className="text-muted-foreground">
                            Knowingly filing a false report is itself a breach of these terms. Nothing here limits any other legal remedy available to a rights owner.
                        </p>
                    </section>

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
                            Solely reserves the right to modify these terms at any time. We will update the "Last updated" date above and, for significant changes, post a notice on the Platform or email you. Continued use of
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
