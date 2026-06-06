import { Link } from "react-router-dom";
import { Instagram, Facebook, ChevronDown } from "lucide-react";
import logo from "@/assets/solely-logo.svg";
import { useState } from "react";
import { Helmet } from "react-helmet-async";

// TikTok icon component (not in lucide-react)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

// FAQ data
const faqs = [
  {
    question: "How does the escrow payment system work?",
    answer: "When you make a purchase, your payment is held securely in escrow. The vendor is notified to ship your order. Once you receive and confirm delivery, the funds are released to the vendor. This protects both buyers and sellers."
  },
  {
    question: "What happens if I don't receive my order?",
    answer: "If your order isn't delivered within the expected timeframe, you can open a dispute. Our team will investigate and initiate a refund if the vendor cannot provide proof of delivery."
  },
  {
    question: "How do I become a vendor on Sole-ly?",
    answer: "Simply click 'Sell Your Shoes' and complete the vendor registration form. You'll need to agree to our Terms & Conditions. Once registered, you can start listing your products immediately!"
  },
  {
    question: "What are the fees for sellers?",
    answer: "There are no upfront fees to list products. We only take a small commission when you successfully make a sale, so you never pay unless you earn."
  },
  {
    question: "How long does delivery take?",
    answer: "Delivery times vary by vendor and location. Once your order is confirmed, you'll see delivery details on your order page. You can contact the vendor directly by phone if you have any questions about your delivery."
  }
];

const Footer = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Build FAQPage JSON-LD for Google rich results
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <footer className="bg-muted border-t border-border mt-20 text-muted-foreground">
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
      <div className="container mx-auto px-4 py-12">
        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8 text-foreground">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-secondary-foreground/20 rounded-lg overflow-hidden">
                <button
                  className="w-full px-4 sm:px-6 py-4 text-left flex items-start sm:items-center justify-between hover:bg-muted transition-colors text-foreground gap-3 min-h-[44px]"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span className="font-medium text-[clamp(0.85rem,2.5vw,1rem)] leading-snug">{faq.question}</span>
                  <ChevronDown size={20} strokeWidth={1.5} className={`shrink-0 mt-0.5 sm:mt-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4 text-sm text-muted-foreground">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Footer Grid - Equal Spacing */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand - Bigger Logo */}
          <div className="space-y-4">
            <Link to="/" className="flex flex-col items-start group">
              <img
                src={logo}
                alt="Sole-ly Marketplace"
                className="h-14 w-auto transition-transform group-hover:scale-105 dark:invert"
              />
              <span className="text-[10px] text-muted-foreground tracking-wide uppercase -mt-3 pl-1">Kenya's Trusted Marketplace</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Kenya's Premier Secure Marketplace — Shoes, Fashion, Electronics &amp; More.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/shop" className="text-sm hover:text-primary transition-colors">
                  Shop
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-sm hover:text-primary transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/vendor" className="text-sm hover:text-primary transition-colors">
                  Start Selling
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-sm hover:text-primary transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm hover:text-primary transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-sm hover:text-primary transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Why Solely - Advantages */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Why Sole-ly?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Escrow-Protected Payments</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Zero Upfront Fees for Sellers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Verified Authentic Products</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>Fast & Secure Delivery</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                <span>24/7 Customer Support</span>
              </li>
            </ul>
          </div>

          {/* Social Media - With TikTok */}
          <div>
            <h3 className="font-semibold mb-4 text-foreground">Connect With Us</h3>
            <div className="flex gap-4 mb-4">
              <a
                href="https://instagram.com/solely.kenya"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={24} strokeWidth={1.5}  />
              </a>
              <a
                href="https://www.tiktok.com/@solely.kenya"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
                aria-label="TikTok"
              >
                <TikTokIcon className="h-6 w-6" />
              </a>
              <a
                href="https://facebook.com/solely.kenya"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={24} strokeWidth={1.5}  />
              </a>
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <a href="mailto:contact@solelymarketplace.com" className="hover:text-primary transition-colors">
                  contact@solelymarketplace.com
                </a>
              </p>
              <Link to="/terms" className="block hover:text-primary transition-colors">
                Terms & Conditions
              </Link>
              <a href="https://solelymarketplace.com/privacy-policy" className="block hover:text-primary transition-colors">
                Privacy Policy
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Sole-ly Marketplace. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
