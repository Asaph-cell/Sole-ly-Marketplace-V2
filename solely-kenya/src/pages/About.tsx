import { Users, TrendingUp, Heart, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/solely-logo.svg";
import { SEO } from "@/components/SEO";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const About = () => {
  const { isVendor } = useAuth();
  const storyRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"]
  });

  // Transform scroll progress to Y position for the founder section
  const founderY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);

  return (
    <div className="min-h-screen py-12">
      <SEO
        title="About Us"
        description="Learn about Sole-ly Marketplace's mission to connect buyers with trusted vendors across Kenya through secure escrow-protected transactions — shoes, electronics, fashion, beauty & more."
        canonical="https://solelyshoes.co.ke/about"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" }
        ]}
      />
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <img
            src={logo}
            alt="Solely Marketplace"
            className="h-20 w-auto mx-auto mb-6"
          />
          <h1 className="text-5xl font-bold mb-6">About Sole-ly Marketplace</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
           Kenya's safest social commerce marketplace — where buying and selling anything is simple, safe, and exciting. We're on a mission to connect shoppers with amazing vendors across Kenya.
          </p>
        </div>

        {/* Values */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">What We Stand For</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Community First</h3>
              <p className="text-muted-foreground">
                We're building a community of shoe lovers, not just a marketplace. Every buyer and seller matters to us.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Growth Together</h3>
              <p className="text-muted-foreground">
                When sellers succeed, buyers get better choices. When buyers are happy, sellers thrive. We all win together.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Made with Love</h3>
              <p className="text-muted-foreground">
                Every feature, every design choice is crafted with care to make your experience enjoyable and hassle-free.
              </p>
            </div>
          </div>
        </div>

        {/* Mission Section */}
        <div className="bg-gradient-hero text-primary-foreground rounded-2xl p-8 md:p-12 mb-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-xl leading-relaxed opacity-90">
              To make Sole-ly Marketplace the easiest and most trusted place to buy and sell shoes in Kenya. We believe everyone deserves access to quality shoes at fair prices, and every seller deserves a platform where they can grow their business without barriers.
            </p>
          </div>
        </div>

        {/* Why Choose Us */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Sole-ly?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-card p-6 rounded-xl border-2 border-border shadow-soft">
              <h3 className="text-xl font-semibold mb-3">For Buyers</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Wide selection from verified vendors
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Transparent pricing in KES
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Escrow-protected payments
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Dispute resolution support
                </li>
              </ul>
            </div>
            <div className="bg-card p-6 rounded-xl border-2 border-border shadow-soft">
              <h3 className="text-xl font-semibold mb-3">For Sellers</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Easy product listing
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Reach customers across Kenya
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Simple dashboard management
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">✓</span>
                  Commission-based (10% per sale, no upfront fees)
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Our Story - Premium Design */}
        <div className="mb-20" ref={storyRef}>
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/30 rounded-3xl p-8 md:p-12 lg:p-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left: Story Content */}
              <div className="space-y-8">
                <h2 className="text-4xl font-bold text-foreground">Our Story</h2>

                {/* Genesis Section */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 bg-white/50 dark:bg-black/20">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Genesis</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Buying online in Kenya often feels less like retail therapy and more like an extreme sport. A customer sends money for shoes seen on Instagram or WhatsApp, hoping they aren't about to learn a painful lesson. When the goods don't arrive, the customer loses money, but the market loses something more valuable: <span className="font-semibold text-foreground">Trust</span>.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Yet, the narrative isn't just about the scammers. It's about the silent majority of honest vendors:
                  </p>
                  <ul className="space-y-2 text-muted-foreground pl-4">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      The student running a thrift store from their hostel.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      The parent looking to put food on the table.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 mt-1">•</span>
                      The legitimate stall owner fighting to be seen.
                    </li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed">
                    These aren't faceless entities; they are entrepreneurs who genuinely care. They are ready to do business, but they are fighting an uphill battle against a reputation they didn't earn.
                  </p>
                </div>

                <div className="border-t border-amber-200 dark:border-amber-800"></div>

                {/* The Solution Section */}
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 bg-white/50 dark:bg-black/20">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">The Solution</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    We built Sole-ly to change that. When you buy on Sole-ly, your payment is held safely in escrow, not released to the vendor until you confirm your order arrived. If the shoes never come, you get your money back automatically. If the vendor delivers, they get paid fairly.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    And for vendors? No website to build, no tech skills needed, just list your products and start selling. Your first online store, ready in minutes.
                  </p>
                </div>

                <div className="border-t border-amber-200 dark:border-amber-800"></div>

                {/* The Vision Section */}
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 bg-white/50 dark:bg-black/20">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">The Vision</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Every order that goes right creates a ripple. A buyer shops without fear. A vendor earns a living. A family is supported. Trust grows. And slowly, the way Kenya buys and sells shoes begins to change.
                  </p>
                  <p className="text-foreground font-medium italic">
                    We believe you should only pay for what you love. And if you deliver with honesty and care, you deserve to be trusted.
                  </p>
                </div>
              </div>

              {/* Right: Founder Photo - Scroll-animated */}
              <motion.div
                className="hidden lg:flex flex-col items-end gap-6 self-start pb-8"
                style={{ y: founderY }}
              >
                {/* Minimalist frame with dark border */}
                <div className="relative group">
                  {/* Subtle glow on hover */}
                  <div className="absolute -inset-1 bg-slate-800/30 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Clean dark border matching FAQ section */}
                  <div className="relative p-1.5 bg-[#1f1f1f] rounded-2xl shadow-xl">
                    <img
                      src="/founder.png"
                      alt="Asaph Wenslause - Founder & CEO of Sole-ly"
                      className="w-72 h-auto md:w-80 lg:w-96 rounded-xl object-cover"
                    />
                  </div>
                </div>

                {/* Founder Info & Personal Story */}
                <div className="text-center lg:text-right max-w-sm">
                  <h3 className="text-xl font-bold text-foreground mb-1">Asaph Wenslause</h3>
                  <p className="text-amber-600 dark:text-amber-400 font-medium text-sm mb-3">Founder & CEO</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    A young entrepreneur who got tired of seeing friends (and himself) lose money to online scammers. After one too many trips to ghost stores and shoes that never arrived, he decided to build a platform where trust isn't optional, it's built in. When he's not coding, you'll find him hunting for the freshest kicks around town.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">Join Our Community</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Whether you're here to shop or sell, we're excited to have you as part of the Sole-ly family.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/shop">Start Shopping</Link>
            </Button>
            {isVendor ? (
              <Button size="lg" variant="outline" asChild>
                <Link to="/vendor/dashboard">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Vendor Dashboard
                </Link>
              </Button>
            ) : (
              <Button size="lg" variant="outline" asChild>
                <Link to="/vendor">Become a Vendor</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default About;
