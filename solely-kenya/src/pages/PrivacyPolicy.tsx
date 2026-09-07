import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Eye, Database, Lock, Users, Globe, Mail, Trash2, Bell, Gavel, Cpu, Store } from "lucide-react";

const PrivacyPolicy = () => {
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
                    <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
                    <p className="text-muted-foreground">
                        Last updated: September 2026
                    </p>
                </div>

                <Card className="p-6 md:p-8 space-y-8">
                    {/* Introduction */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Shield size={24} strokeWidth={1.5} className=" text-primary" />
                            Introduction
                        </h2>
                        <p className="text-muted-foreground leading-relaxed mb-4">
                            Welcome to Sole-ly ("we", "our", or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our marketplace at solelymarketplace.com, our Android app, and any Sole-ly checkout or payment link hosted on another website (together, the "Platform").
                        </p>
                        <p className="text-muted-foreground leading-relaxed mb-4">
                            Sole-ly is the <strong>data controller</strong> for the personal data described in this policy, and we process it in accordance with the <strong>Kenya Data Protection Act, 2019</strong>. Vendors who receive your delivery details act as independent controllers for the purpose of fulfilling your order, see <em>Information Sharing</em> below.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            Please read this policy carefully. If you do not agree with our practices, please do not use the Platform.
                        </p>
                    </section>

                    {/* Information We Collect */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Database size={24} strokeWidth={1.5} className=" text-blue-600" />
                            Information We Collect
                        </h2>

                        <h3 className="text-lg font-semibold mb-3">Personal Information You Provide</h3>
                        <p className="text-muted-foreground mb-3">
                            We collect personal information that you voluntarily provide when you:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Register an account:</strong> Full name, email address, password</li>
                            <li><strong>Complete your profile:</strong> Phone number, profile photo</li>
                            <li><strong>Make a purchase:</strong> Delivery address, town/city, county, phone number, delivery notes</li>
                            <li><strong>Check out as a guest:</strong> Name, phone number, email and delivery address, collected without an account. Guest orders are looked up using the order link we give you, treat that link as private</li>
                            <li><strong>Register as a vendor:</strong> Business name, M-Pesa number, store phone number, store location, business description</li>
                            <li><strong>Negotiate delivery:</strong> The messages you exchange with the other party in the in-app delivery chat, and the delivery fee and method you agree on</li>
                            <li><strong>Contact us or use the help bot:</strong> Any information you include in messages to our support team</li>
                            <li><strong>Raise a dispute or report a stolen item:</strong> Your description of what happened and any evidence you attach</li>
                            <li><strong>Sign in with Google:</strong> Your Google account email and profile name</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-3">Information Collected Automatically</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Device information:</strong> Browser type, operating system, device type</li>
                            <li><strong>Usage data:</strong> Pages visited, time spent on pages, click patterns</li>
                            <li><strong>Product views:</strong> Which products you open, and where you arrived from (for example a shared link, a QR code, or a search). Vendors see this only as aggregate counts for their own products, never as individual visitor records</li>
                            <li><strong>Browsing interests:</strong> Recent searches, categories and brands you interact with. These are stored <strong>in your own browser</strong> to order your product feed, and are not uploaded to us as a personal profile</li>
                            <li><strong>Location data:</strong> Approximate location based on IP address; optional GPS coordinates if you choose to share your delivery location pin</li>
                            <li><strong>Push notification tokens:</strong> If you opt in, we store your device's push notification subscription to send you order updates and alerts</li>
                            <li><strong>Cookies and analytics identifiers:</strong> Session cookies, authentication tokens, and Google Analytics cookies (see <em>Cookies and Tracking</em>)</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-3">Transaction Information</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Order history and purchase details, including the agreed delivery fee</li>
                            <li>Payment transaction IDs (we do not store full card numbers)</li>
                            <li>M-Pesa payment references</li>
                            <li>Package PINs and delivery OTP codes generated to confirm handover</li>
                            <li>GPS coordinates and map links (if you choose to share your location pin)</li>
                            <li>Dispute, refund, and stolen-item records</li>
                            <li>Vendor payout, wallet balance, and withdrawal records</li>
                        </ul>
                    </section>

                    {/* Lawful Basis */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Gavel size={24} strokeWidth={1.5} className=" text-indigo-600" />
                            Why We Are Allowed to Process Your Data
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            Under the Data Protection Act, 2019 we must have a lawful basis for each use of your data:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li><strong>Performance of a contract:</strong> Creating your account, processing orders and payments, running escrow, coordinating delivery, and paying out vendors</li>
                            <li><strong>Legitimate interests:</strong> Preventing fraud and counterfeit sales, securing the Platform, resolving disputes fairly, and understanding aggregate usage so we can improve the service</li>
                            <li><strong>Consent:</strong> Push notifications, sharing your GPS delivery pin, marketing emails, and analytics cookies. You can withdraw consent at any time without affecting anything we did before you withdrew it</li>
                            <li><strong>Legal obligation:</strong> Keeping tax and accounting records, and responding to lawful requests from authorities</li>
                        </ul>
                    </section>

                    {/* How We Use Your Information */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Eye size={24} strokeWidth={1.5} className=" text-green-600" />
                            How We Use Your Information
                        </h2>

                        <h3 className="text-lg font-semibold mb-2">Essential Services</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li>Creating and managing your account</li>
                            <li>Processing orders and payments</li>
                            <li>Facilitating communication between buyers and vendors, including delivery fee negotiation</li>
                            <li>Managing our escrow payment system and releasing funds to vendors</li>
                            <li>Processing refunds and handling disputes</li>
                            <li>Sharing your delivery address and GPS pin with the vendor so they can deliver your order</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-2">Communication</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li>Sending order confirmations and status updates</li>
                            <li>Notifying you about disputes and resolutions</li>
                            <li>Sending Package PINs and delivery OTP codes to confirm handover</li>
                            <li>Sending push notifications for order status updates (if opted in)</li>
                            <li>Sending payout notifications to vendors</li>
                            <li>Responding to customer support inquiries</li>
                            <li>Sending important service announcements</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-2">Platform Improvement</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Analysing aggregate usage patterns to improve our service</li>
                            <li>Identifying and preventing fraudulent activity and counterfeit listings</li>
                            <li>Enforcing our Terms and Conditions</li>
                            <li>Ensuring platform security and integrity</li>
                        </ul>
                    </section>

                    {/* Automated Decisions */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Cpu size={24} strokeWidth={1.5} className=" text-slate-600" />
                            Automated Decisions About Your Order
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            Some steps in the order lifecycle happen automatically, on a timer, without a person reviewing them:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Auto-cancellation:</strong> If a vendor does not accept your order within the confirmation window, the order is cancelled and you are refunded</li>
                            <li><strong>Auto-dispute:</strong> If a confirmed order is not marked as arrived within the delivery window, a dispute is raised automatically for our team to review</li>
                            <li><strong>Auto-release of escrow:</strong> After you confirm receipt by entering the Package PIN, escrowed funds are released to the vendor once the release window elapses, even if the vendor never enters your OTP</li>
                            <li><strong>Auto-payout:</strong> Vendor balances above a set threshold are paid out to the registered M-Pesa number automatically</li>
                        </ul>
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                <strong>You can always ask for a human.</strong> If an automated step produces a result you believe is wrong, raise a dispute or email us and a member of our team will review the decision personally. The exact windows are published in our <Link to="/terms" className="text-primary underline">Terms and Conditions</Link>.
                            </p>
                        </div>
                    </section>

                    {/* Information Sharing */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Users size={24} strokeWidth={1.5} className=" text-purple-600" />
                            Information Sharing and Disclosure
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            We share your information only in the following circumstances:
                        </p>

                        <h3 className="text-lg font-semibold mb-2">Between Buyers and Vendors</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>When you place an order:</strong> Vendors receive your name, delivery address, phone number, and GPS location pin (if you shared one) to fulfil the order</li>
                            <li><strong>Delivery coordination:</strong> You and the vendor negotiate the delivery fee in an in-app chat. Both sides can read that conversation, and we retain it as the record of what was agreed</li>
                            <li><strong>Reviews:</strong> Your rating and comment are shown publicly; your identity is not shown to the vendor</li>
                        </ul>
                        <p className="text-muted-foreground mt-2 mb-4 bg-muted/50 p-3 rounded-lg text-sm">
                            <strong>Note:</strong> When you purchase from a vendor, that vendor acts as an independent controller of your data (name, address, phone, GPS pin) solely for the purpose of order fulfilment and delivery coordination. Our <Link to="/terms" className="text-primary underline">Vendor Agreement</Link> requires vendors to protect your data, use it only to complete your order, and not market to you without your consent.
                        </p>

                        <h3 className="text-lg font-semibold mb-2">Vendor Information Shown Publicly</h3>
                        <p className="text-muted-foreground mb-4">
                            If you register as a vendor, your store name, store description, store location, ratings and reviews, and the <strong>store phone number</strong> you provide are displayed publicly on your storefront and product pages so buyers can reach you. Do not enter a phone number you do not want shown publicly. Your M-Pesa payout number is <strong>not</strong> published.
                        </p>

                        <h3 className="text-lg font-semibold mb-2">Third-Party Service Providers</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Supabase:</strong> Database, authentication, and file storage</li>
                            <li><strong>Cloudflare:</strong> Website hosting, content delivery, and security</li>
                            <li><strong>IntaSend:</strong> Payment collection and vendor payout processing</li>
                            <li><strong>M-Pesa / Safaricom:</strong> Mobile money payments and vendor payouts</li>
                            <li><strong>Google:</strong> Authentication (when using "Sign in with Google"), Google Analytics, and Google Play distribution of our Android app</li>
                            <li><strong>Resend:</strong> Email delivery service</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-2">Legal Requirements and Stolen Goods</h3>
                        <p className="text-muted-foreground mb-4">
                            We may disclose your information if required by law, court order, or government request, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others. Where an item is reported as stolen through the Platform, we may share the relevant order, listing, and contact records with law enforcement or the lawful owner.
                        </p>

                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-6">
                            <h4 className="font-semibold text-green-800 mb-2">We Do NOT Sell Your Data</h4>
                            <p className="text-sm text-muted-foreground">
                                We do not sell, rent, or trade your personal information to third parties for marketing purposes.
                            </p>
                        </div>

                        <h3 className="text-lg font-semibold mb-2">Google User Data</h3>
                        <p className="text-muted-foreground mb-3">
                            When you use "Sign in with Google," Sole-ly Marketplace accesses your Google email address and basic profile information (name and profile picture). We use this data strictly to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li>Authenticate your identity and create your Sole-ly account.</li>
                            <li>Securely manage your escrow transactions and protect our marketplace from fraudulent activity.</li>
                        </ul>
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <h4 className="font-semibold text-blue-800 mb-2">Limited Use Disclosure</h4>
                            <p className="text-sm text-muted-foreground">
                                Sole-ly Marketplace's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not sell your Google user data to third parties or use it for serving advertisements.
                            </p>
                        </div>
                    </section>

                    {/* Payment Links & Embedded Checkout */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Store size={24} strokeWidth={1.5} className=" text-teal-600" />
                            Payment Links and Checkout on Other Websites
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            Vendors can create Sole-ly payment links and embed a Sole-ly checkout on their own website or social media page. When you buy through one of these:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>The checkout itself is operated by Sole-ly, and this Privacy Policy governs the data you enter into it</li>
                            <li>Your order is protected by the same escrow system as an order placed on solelymarketplace.com</li>
                            <li>The website that hosted the link is <strong>not</strong> operated by us, and its own privacy practices apply to everything outside our checkout</li>
                        </ul>
                    </section>

                    {/* Data Security */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Lock size={24} strokeWidth={1.5} className=" text-red-600" />
                            Data Security
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            We implement robust security measures to protect your personal information:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Encryption:</strong> All data transmitted between your browser and our servers is encrypted using HTTPS/TLS</li>
                            <li><strong>Password Protection:</strong> Passwords are securely hashed and never stored in plain text</li>
                            <li><strong>Row-level access control:</strong> Our database enforces per-user access rules, so you can only read the orders, messages, and records that belong to you</li>
                            <li><strong>Secure Payments:</strong> Payment information is processed by PCI-DSS compliant providers (IntaSend). We never see or store your full card number</li>
                            <li><strong>Audit logging:</strong> Administrative actions on orders, disputes, vendors, and platform settings are recorded</li>
                        </ul>
                        <p className="text-muted-foreground">
                            While we strive to protect your information, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security but are committed to maintaining industry-standard protections. If a breach occurs that is likely to result in a real risk to your rights, we will notify you and the Office of the Data Protection Commissioner as required by law.
                        </p>
                    </section>

                    {/* Cookies */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Globe size={24} strokeWidth={1.5} className=" text-orange-600" />
                            Cookies and Tracking
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            We use cookies, browser storage, and similar technologies to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Essential cookies:</strong> Keep you logged in and remember your preferences</li>
                            <li><strong>Authentication tokens:</strong> Securely identify you during your session</li>
                            <li><strong>Shopping cart and browsing interests:</strong> Remember items in your cart and the categories you browse, stored locally in your own browser</li>
                            <li><strong>Analytics cookies:</strong> We use <strong>Google Analytics</strong> to understand how visitors use the Platform in aggregate, which pages are popular, where visitors arrive from, and where they drop off. Google sets its own cookies for this purpose and processes the data as an independent controller</li>
                        </ul>
                        <p className="text-muted-foreground mb-3">
                            We do <strong>not</strong> use advertising cookies, and we do not run ad retargeting.
                        </p>
                        <p className="text-muted-foreground">
                            You can control cookies through your browser settings, and you can opt out of Google Analytics specifically using Google's <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary underline">browser opt-out add-on</a>. Disabling essential cookies will affect platform functionality.
                        </p>
                    </section>

                    {/* Your Rights */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Bell size={24} strokeWidth={1.5} className=" text-cyan-600" />
                            Your Privacy Rights
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            Under the Data Protection Act, 2019 you have the following rights regarding your personal data:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>To be informed:</strong> Know how your data is being used; that is what this policy is for</li>
                            <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                            <li><strong>Correction:</strong> Update or correct inaccurate information in your account settings or by asking us</li>
                            <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                            <li><strong>Objection:</strong> Object to processing we carry out on the basis of legitimate interests</li>
                            <li><strong>Restriction:</strong> Ask us to pause processing while a complaint or correction is being resolved</li>
                            <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
                            <li><strong>Withdraw consent:</strong> Turn off push notifications, location sharing, or marketing emails at any time (transactional emails about your orders cannot be opted out of while you have active orders)</li>
                        </ul>
                        <p className="text-muted-foreground mb-3">
                            To exercise these rights, contact us at <a href="mailto:contact@solelymarketplace.com" className="text-primary underline">contact@solelymarketplace.com</a>. We will respond within 30 days. We may ask you to verify your identity first, so that nobody else can request your data.
                        </p>
                        <p className="text-muted-foreground">
                            If you are not satisfied with how we handle your request, you have the right to lodge a complaint with the <strong>Office of the Data Protection Commissioner (ODPC)</strong> of Kenya at <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer" className="text-primary underline">odpc.go.ke</a>.
                        </p>
                    </section>

                    {/* Data Retention */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Trash2 size={24} strokeWidth={1.5} className=" text-gray-600" />
                            Data Retention
                        </h2>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li><strong>Active accounts:</strong> Data is retained as long as your account is active</li>
                            <li><strong>Order records:</strong> Transaction history is retained for 7 years for legal and accounting purposes</li>
                            <li><strong>Delivery negotiation messages:</strong> Retained with the order they relate to, as the record of the fee that was agreed</li>
                            <li><strong>Deleted accounts:</strong> Personal data is deleted within 30 days, except where legally required</li>
                            <li><strong>Vendor records:</strong> Business records may be retained longer for tax and legal compliance</li>
                            <li><strong>Enforcement records:</strong> Where an account is suspended or banned for fraud, counterfeit sales, or stolen goods, we retain a minimal record of that decision so the ban can be enforced</li>
                        </ul>
                    </section>

                    {/* Children's Privacy */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Children's Privacy</h2>
                        <p className="text-muted-foreground">
                            Our Platform is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected data from a minor, please contact us immediately and we will delete the information.
                        </p>
                    </section>

                    {/* International Users */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4">International Users and Data Transfers</h2>
                        <p className="text-muted-foreground">
                            Our Platform is operated from Kenya and serves the Kenyan market. Some of our service providers, including our database, hosting, email, and analytics providers, process data on servers outside Kenya. Where that happens, we rely on those providers' contractual data protection commitments to keep your data protected to the standard required by the Data Protection Act, 2019.
                        </p>
                    </section>

                    {/* Changes to Policy */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4">Changes to This Policy</h2>
                        <p className="text-muted-foreground">
                            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our Platform or sending you an email. The "Last updated" date at the top indicates when the policy was last revised. Continued use of the Platform after changes constitutes acceptance of the updated policy.
                        </p>
                    </section>

                    {/* Contact */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Mail size={24} strokeWidth={1.5} className=" text-primary" />
                            Contact Us
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
                        </p>
                        <div className="bg-muted/50 border rounded-lg p-4">
                            <p className="font-semibold mb-2">Sole-ly Marketplace</p>
                            <p className="text-muted-foreground">
                                Email: <a href="mailto:contact@solelymarketplace.com" className="text-primary underline">contact@solelymarketplace.com</a>
                            </p>
                            <p className="text-muted-foreground">
                                Data protection requests: <a href="mailto:contact@solelymarketplace.com" className="text-primary underline">contact@solelymarketplace.com</a>
                            </p>
                            <p className="text-muted-foreground mt-2">
                                Website: <a href="https://solelymarketplace.com" className="text-primary underline">solelymarketplace.com</a>
                            </p>
                        </div>
                    </section>
                </Card>

                {/* Link to Terms */}
                <div className="mt-6 text-center">
                    <Link to="/terms" className="text-primary underline hover:no-underline">
                        View our Terms and Conditions →
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
