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
        description="Sole.ly is the trust layer for Kenya's social commerce. We protect every transaction between online sellers and buyers with secure M-Pesa payments and buyer protection."
        canonical="https://solelymarketplace.com/about"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" }
        ]}
      />
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
          <img
            src={logo}
            alt="Solely Marketplace"
            className="h-14 sm:h-20 w-auto mx-auto mb-6"
          />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">About Sole.ly Kenya</h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground leading-relaxed font-medium">
            Sole.ly is the trust layer for Kenya's social commerce. We're not another marketplace — we're the checkout system that makes buying from Instagram, WhatsApp, and TikTok sellers safe for everyone.
          </p>
        </div>

        {/* Mission / About Section */}
        <div className="bg-gradient-hero text-primary-foreground rounded-2xl p-8 md:p-12 mb-20 shadow-xl">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <p className="text-base sm:text-lg md:text-xl leading-relaxed opacity-95">
              We built Sole.ly because online sellers in Kenya lose customers every day — not because their products are bad, but because buyers are afraid of being scammed. When a buyer sees a Sole.ly payment link, they know their money is protected until they receive exactly what they ordered.
            </p>
            <p className="text-base sm:text-lg md:text-xl leading-relaxed opacity-95">
              For sellers, this means more conversions, fewer "I'll think about it" responses, and a professional checkout experience that builds trust from the first transaction. For buyers, it means shopping from social media sellers with complete peace of mind.
            </p>
            <div className="pt-4 border-t border-primary-foreground/20">
              <p className="text-lg sm:text-2xl font-bold tracking-tight">
                At Sole.ly Kenya, trust isn't assumed — it's built into every transaction.
              </p>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users strokeWidth={1.5} className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">1. Community First</h3>
              <p className="text-muted-foreground leading-relaxed">
                We're more than a marketplace, we're a community built on trust, passion, and connection. Every buyer and seller is an important part of our journey.
              </p>
            </div>
            
            <div className="text-center p-6 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp strokeWidth={1.5} className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">2. Grow Together</h3>
              <p className="text-muted-foreground leading-relaxed">
                Success on our platform is shared. When sellers thrive, buyers enjoy better choices and experiences. By supporting each other, we all move forward together.
              </p>
            </div>
            
            <div className="text-center p-6 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart strokeWidth={1.5} className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-4">3. Made with Love</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every feature, interaction, and experience is thoughtfully designed to make trading simple, secure, and enjoyable.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Join Our Community</h2>
          <p className="text-muted-foreground mb-6 sm:mb-8 text-base sm:text-lg">
            Whether you're here to shop or sell, we're excited to have you as part of the Sole-ly family.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center">
            <Button size="lg" asChild>
              <Link to="/shop">Start Shopping</Link>
            </Button>
            {isVendor ? (
              <Button size="lg" variant="outline" asChild>
                <Link to="/vendor/dashboard">
                  <LayoutDashboard size={16} strokeWidth={1.5} className=" mr-2" />
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
