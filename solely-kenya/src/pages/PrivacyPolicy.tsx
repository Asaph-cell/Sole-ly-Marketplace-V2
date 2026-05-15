import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Eye, Database, Lock, Users, Globe, Mail, Trash2, Bell } from "lucide-react";

const PrivacyPolicy = () => {
    return (
        <div className="min-h-screen bg-muted/30 py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                <Link to="/">
                    <Button variant="ghost" className="mb-6">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Home
                    </Button>
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
                    <p className="text-muted-foreground">
                        Last updated: February 2026
                    </p>
                </div>

                <Card className="p-6 md:p-8 space-y-8">
                    {/* Introduction */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Shield className="h-6 w-6 text-primary" />
                            Introduction
                        </h2>
                        <p className="text-muted-foreground leading-relaxed mb-4">
                            Welcome to Sole-ly ("we", "our", or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our social commerce marketplace platform at solelyshoes.co.ke (the "Platform").
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            Please read this privacy policy carefully. By using our Platform, you consent to the collection, use, and disclosure of your information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Platform.
                        </p>
                    </section>

                    {/* Information We Collect */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Database className="h-6 w-6 text-blue-600" />
                            Information We Collect
                        </h2>

                        <h3 className="text-lg font-semibold mb-3">Personal Information You Provide</h3>
                        <p className="text-muted-foreground mb-3">
                            We collect personal information that you voluntarily provide when you:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Register an account:</strong> Full name, email address, password</li>
                            <li><strong>Complete your profile:</strong> Phone number, profile photo</li>
                            <li><strong>Make a purchase:</strong> Delivery address, billing information</li>
                            <li><strong>Register as a vendor:</strong> Business name, M-Pesa number, store location, business description</li>
                            <li><strong>Contact us:</strong> Any information you include in messages to our support team</li>
                            <li><strong>Sign in with Google:</strong> Your Google account email and profile name</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-3">Information Collected Automatically</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Device information:</strong> Browser type, operating system, device type</li>
                            <li><strong>Usage data:</strong> Pages visited, time spent on pages, click patterns</li>
                            <li><strong>Location data:</strong> Approximate location based on IP address (used for delivery fee calculation)</li>
                            <li><strong>Push notification tokens:</strong> If you opt in, we store your device's push notification subscription to send you order updates and alerts</li>
                            <li><strong>Cookies:</strong> Session cookies, authentication tokens</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-3">Transaction Information</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Order history and purchase details</li>
                            <li>Payment transaction IDs (we do not store full card numbers)</li>
                            <li>M-Pesa payment references</li>
                            <li>Delivery OTP codes (one-time passwords generated for secure delivery confirmation)</li>
                            <li>Dispute and refund records</li>
                        </ul>
                    </section>

                    {/* How We Use Your Information */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Eye className="h-6 w-6 text-green-600" />
                            How We Use Your Information
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            We use the information we collect for the following purposes:
                        </p>

                        <h3 className="text-lg font-semibold mb-2">Essential Services</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li>Creating and managing your account</li>
                            <li>Processing orders and payments</li>
                            <li>Facilitating communication between buyers and vendors</li>
                            <li>Managing our escrow payment system</li>
                            <li>Processing refunds and handling disputes</li>
                            <li>Calculating delivery fees based on location</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-2">Communication</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li>Sending order confirmations and updates</li>
                            <li>Notifying you about disputes and resolutions</li>
                            <li>Sending delivery OTP codes to buyers for secure order confirmation</li>
                            <li>Sending push notifications for order status updates (if opted in)</li>
                            <li>Sending payout notifications to vendors</li>
                            <li>Responding to customer support inquiries</li>
                            <li>Sending important service announcements</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-2">Platform Improvement</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li>Analyzing usage patterns to improve our service</li>
                            <li>Identifying and preventing fraudulent activity</li>
                            <li>Enforcing our Terms and Conditions</li>
                            <li>Ensuring platform security and integrity</li>
                        </ul>
                    </section>

                    {/* Information Sharing */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Users className="h-6 w-6 text-purple-600" />
                            Information Sharing and Disclosure
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            We share your information only in the following circumstances:
                        </p>

                        <h3 className="text-lg font-semibold mb-2">Between Buyers and Vendors</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>When you place an order:</strong> Vendors receive your name, delivery address, and phone number to fulfill the order</li>
                            <li><strong>For pickup orders:</strong> Buyers receive vendor contact information and pickup location</li>
                            <li><strong>Reviews:</strong> Your rating is shared but your identity remains anonymous to vendors</li>
                        </ul>
                        <p className="text-muted-foreground mt-2 mb-4 bg-muted/50 p-3 rounded-lg text-sm">
                            <strong>Note:</strong> When you purchase from a vendor, that vendor acts as an independent controller of your data (name, address, phone) solely for the purpose of order fulfillment. We contractually require vendors to protect your data and not to misuse it for marketing without your consent.
                        </p>

                        <h3 className="text-lg font-semibold mb-2">Third-Party Service Providers</h3>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Supabase:</strong> Database and authentication services</li>
                            <li><strong>IntaSend:</strong> Payment collection and vendor payout processing</li>
                            <li><strong>M-Pesa/Safaricom:</strong> Mobile money payments and vendor payouts</li>
                            <li><strong>Google:</strong> Authentication (when using "Sign in with Google")</li>
                            <li><strong>Resend:</strong> Email delivery service</li>
                        </ul>

                        <h3 className="text-lg font-semibold mb-2">Legal Requirements</h3>
                        <p className="text-muted-foreground mb-4">
                            We may disclose your information if required by law, court order, or government request, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others.
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

                    {/* Data Security */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Lock className="h-6 w-6 text-red-600" />
                            Data Security
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            We implement robust security measures to protect your personal information:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Encryption:</strong> All data transmitted between your browser and our servers is encrypted using HTTPS/TLS</li>
                            <li><strong>Password Protection:</strong> Passwords are securely hashed and never stored in plain text</li>
                            <li><strong>Access Control:</strong> Only authorized personnel have access to your personal data</li>
                            <li><strong>Secure Payments:</strong> Payment information is processed by PCI-DSS compliant providers (IntaSend)</li>
                            <li><strong>Regular Security Audits:</strong> We regularly review and update our security practices</li>
                        </ul>
                        <p className="text-muted-foreground">
                            While we strive to protect your information, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security but are committed to maintaining industry-standard protections.
                        </p>
                    </section>

                    {/* Cookies */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Globe className="h-6 w-6 text-orange-600" />
                            Cookies and Tracking
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            We use cookies and similar technologies to:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Essential cookies:</strong> Keep you logged in and remember your preferences</li>
                            <li><strong>Authentication tokens:</strong> Securely identify you during your session</li>
                            <li><strong>Shopping cart:</strong> Remember items in your cart</li>
                        </ul>
                        <p className="text-muted-foreground">
                            We do not use third-party advertising or tracking cookies. You can control cookie settings through your browser, but disabling essential cookies may affect platform functionality.
                        </p>
                    </section>

                    {/* Your Rights */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Bell className="h-6 w-6 text-cyan-600" />
                            Your Privacy Rights
                        </h2>
                        <p className="text-muted-foreground mb-3">
                            You have the following rights regarding your personal data:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                            <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                            <li><strong>Correction:</strong> Update or correct inaccurate information in your account settings</li>
                            <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
                            <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
                            <li><strong>Opt-out:</strong> Unsubscribe from marketing communications (transactional emails cannot be opted out)</li>
                        </ul>
                        <p className="text-muted-foreground">
                            To exercise these rights, contact us at <a href="mailto:contact@solelyshoes.co.ke" className="text-primary underline">contact@solelyshoes.co.ke</a>. We will respond within 30 days.
                        </p>
                    </section>

                    {/* Data Retention */}
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                            <Trash2 className="h-6 w-6 text-gray-600" />
                            Data Retention
                        </h2>
                        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                            <li><strong>Active accounts:</strong> Data is retained as long as your account is active</li>
                            <li><strong>Order records:</strong> Transaction history is retained for 7 years for legal and accounting purposes</li>
                            <li><strong>Deleted accounts:</strong> Personal data is deleted within 30 days, except where legally required</li>
                            <li><strong>Vendor records:</strong> Business records may be retained longer for tax and legal compliance</li>
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
                        <h2 className="text-2xl font-bold mb-4">International Users</h2>
                        <p className="text-muted-foreground">
                            Our Platform is operated from Kenya. If you access our Platform from outside Kenya, your information may be transferred to, stored, and processed in Kenya where our servers are located. By using our Platform, you consent to this transfer.
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
                            <Mail className="h-6 w-6 text-primary" />
                            Contact Us
                        </h2>
                        <p className="text-muted-foreground mb-4">
                            If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
                        </p>
                        <div className="bg-muted/50 border rounded-lg p-4">
                            <p className="font-semibold mb-2">Sole-ly Marketplace</p>
                            <p className="text-muted-foreground">
                                Email: <a href="mailto:contact@solelyshoes.co.ke" className="text-primary underline">contact@solelyshoes.co.ke</a>
                            </p>
                            <p className="text-muted-foreground">
                                General Inquiries: <a href="mailto:contact@solelyshoes.co.ke" className="text-primary underline">contact@solelyshoes.co.ke</a>
                            </p>
                            <p className="text-muted-foreground mt-2">
                                Website: <a href="https://solelyshoes.co.ke" className="text-primary underline">solelyshoes.co.ke</a>
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
