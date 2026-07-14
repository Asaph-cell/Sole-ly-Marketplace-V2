import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/solely-logo.svg";
import { SEO } from "@/components/SEO";

const Vendor = () => {
  return (
    <div className="min-h-screen py-12">
      <SEO 
        title="Sell Online Safely in Kenya | Sole.ly Trusted Checkout"
        description="Stop losing sales to mistrust. Generate secure M-Pesa payment links for your Instagram, WhatsApp & TikTok shop. Your buyers pay with confidence — money is protected until delivery."
        canonical="https://solelymarketplace.com/vendor"
      />
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <img
            src={logo}
            alt="Sole-ly Marketplace"
            className="h-20 w-auto mx-auto mb-6"
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6">Stop Losing Sales to Mistrust.</h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed mb-6 sm:mb-8">
            Your followers want to buy — but they don't trust "send to Till." With Solely, you generate a protected payment link that tells buyers: "Your money is safe until you get what you ordered." Zero setup fees. 6% only when you sell.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/vendor/register">Register as Vendor</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a
                href="mailto:contact@solelymarketplace.com"
                className="inline-flex items-center gap-2"
              >
                Contact Support
              </a>
            </Button>
          </div>
        </div>

        {/* Benefits */}
        <div className="mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Why Sellers Trust Sole.ly</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 shadow-card hover:shadow-hover transition-all">
              <CardHeader>
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <Users size={24} strokeWidth={1.5} className=" text-primary" />
                </div>
                <CardTitle>Build Instant Trust</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  When buyers see a Sole.ly payment link, they know their money is safe. No more "I'll think about it" — convert followers into paying customers.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 shadow-card hover:shadow-hover transition-all">
              <CardHeader>
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp size={24} strokeWidth={1.5} className=" text-primary" />
                </div>
                <CardTitle>Easy to Start</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  No complicated setup or technical skills needed. Just list your products and we'll help you get started in minutes.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 shadow-card hover:shadow-hover transition-all">
              <CardHeader>
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                  <DollarSign size={24} strokeWidth={1.5} className=" text-primary" />
                </div>
                <CardTitle>Fair Commission</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Only 6% commission per sale. No subscription fees, no monthly costs. You only pay when you make money. Payouts go directly to your M-Pesa or bank account.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-card border-2 border-border rounded-2xl p-8 md:p-12 mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">How It Works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Register & Verify</h3>
              <p className="text-sm text-muted-foreground">
                Sign up, complete your vendor profile, and get approved by our admin team
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">List Your Products</h3>
              <p className="text-sm text-muted-foreground">
                Upload photos, set prices, and publish your products to the marketplace
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Receive Orders</h3>
              <p className="text-sm text-muted-foreground">
                Accept orders, ship directly to buyers, and update tracking info
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="font-semibold mb-2">Get Paid</h3>
              <p className="text-sm text-muted-foreground">
                After buyer confirms delivery, receive payout (minus 6% commission) to your account
              </p>
            </div>
          </div>
        </div>

        {/* Requirements */}
        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">What You Need</h2>
          <Card className="border-2 shadow-card">
            <CardContent className="pt-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl shrink-0">✓</span>
                  <span className="text-[clamp(0.85rem,2.5vw,1rem)] leading-snug">
                    <strong>Quality products to sell</strong> – Whether new or gently used, make sure they're in good condition
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl shrink-0">✓</span>
                  <span className="text-[clamp(0.85rem,2.5vw,1rem)] leading-snug">
                    <strong>Clear photos</strong> – Good pictures help sell products faster
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl shrink-0">✓</span>
                  <span className="text-[clamp(0.85rem,2.5vw,1rem)] leading-snug">
                    <strong>Product details</strong> – Brand, size, condition, and price
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl shrink-0">✓</span>
                  <span className="text-[clamp(0.85rem,2.5vw,1rem)] leading-snug">
                    <strong>Contact information</strong> – So we can reach you and verify your business
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary text-xl shrink-0">✓</span>
                  <span className="text-[clamp(0.85rem,2.5vw,1rem)] leading-snug">
                    <strong>Commitment to customer service</strong> – We want all our vendors to provide great experiences
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">Common Questions</h2>
          <div className="space-y-4">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">Is there a fee to become a vendor?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  No upfront fees! We operate on a commission model. You only pay 6% commission when you make a sale. No subscriptions, no monthly costs.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">How do I receive payments?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  All payments go through Sole-ly's escrow system. When a buyer places an order, payment is held securely. After the buyer confirms delivery, your earnings (94% of order value) are added to your balance. You can then withdraw your funds to M-Pesa at any time directly from your dashboard. Standard transaction fees apply.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">Who handles delivery?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  You handle shipping directly to buyers. Choose your preferred courier, update tracking info in your dashboard, and ship to the address provided in each order.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-lg">Can I sell used or pre-owned items?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes! As long as they're in good condition and you're honest about their condition, used items are welcome on our platform.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-gradient-hero text-primary-foreground rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Start Selling?</h2>
          <p className="text-base sm:text-xl opacity-90 mb-6 sm:mb-8">
            Join our community of successful vendors and start reaching customers across Kenya today!
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/vendor/register">Register as Vendor</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              asChild
            >
              <a
                href="mailto:contact@solelymarketplace.com"
                className="inline-flex items-center gap-2"
              >
                Contact Support
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vendor;
