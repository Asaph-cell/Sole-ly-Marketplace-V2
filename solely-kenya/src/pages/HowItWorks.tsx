import { Shield, Lock, Package, Zap, ShoppingBag, Tag, CheckCircle, Truck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { SEO } from "@/components/SEO";

const steps = [
  {
    step: "01",
    icon: ShoppingBag,
    title: "Browse & Order",
    color: "bg-primary/10 text-primary border-primary/20",
    iconBg: "bg-primary/10 text-primary",
    details: [
      "Browse verified vendors across 9 categories",
      "Add items to cart — no account needed to browse",
      "Choose delivery or pickup at checkout",
      "Pay securely via M-Pesa",
    ],
  },
  {
    step: "02",
    icon: Lock,
    title: "Funds Held in Escrow",
    color: "bg-green-50 text-green-800 border-green-200",
    iconBg: "bg-green-100 text-green-700",
    details: [
      "Your payment is immediately locked in escrow",
      "The vendor is notified and prepares your order",
      "Vendor accepts or declines within 24 hours",
      "If declined, funds are returned instantly",
    ],
  },
  {
    step: "03",
    icon: Package,
    title: "Receive Your Package",
    color: "bg-blue-50 text-blue-800 border-blue-200",
    iconBg: "bg-blue-100 text-blue-700",
    details: [
      "Vendor dispatches — a 3-digit PIN is generated",
      "PIN is written on your physical package",
      "You enter the PIN in the app to confirm receipt",
      "A 6-digit release code is then generated for you",
    ],
  },
  {
    step: "04",
    icon: Zap,
    title: "Release Payment",
    color: "bg-purple-50 text-purple-800 border-purple-200",
    iconBg: "bg-purple-100 text-purple-700",
    details: [
      "Show the 6-digit code to the vendor (in-person or screenshot)",
      "Vendor enters the code in their app",
      "Funds are released to vendor's wallet instantly",
      "If vendor is absent, funds auto-release after 6 hours",
    ],
  },
];

const pickupSteps = [
  { title: "Pay via M-Pesa — funds go to escrow" },
  { title: "Vendor prepares your item for pickup" },
  { title: "Collect item in person" },
  { title: "App generates your 6-digit release code" },
  { title: "Show code to vendor → funds released" },
];

const faqs = [
  {
    q: "What if I enter the PIN but the vendor never comes?",
    a: "After 6 hours, the funds are automatically released to the vendor. If you believe the item was stolen, you can file a stolen item report and our team will investigate and may ban the buyer.",
  },
  {
    q: "What if the item doesn't arrive?",
    a: "If delivery hasn't happened and you haven't entered any PIN, your funds stay locked. You can open a dispute and we'll mediate — including a full refund if the vendor can't prove dispatch.",
  },
  {
    q: "Can I file a dispute?",
    a: "Yes. At any point before funds are released, you can open a dispute (broken item, not as described, etc.). Our admin team reviews within 24 hours and can refund you or release to the vendor.",
  },
  {
    q: "What about pickup orders?",
    a: "For pickup, no PIN is needed on the package. The buyer collects the item and the release code is generated directly. They show it to the vendor and funds are released.",
  },
  {
    q: "How long does the vendor have to dispatch?",
    a: "Vendors must accept and dispatch within the timeframe shown on the product page. If they fail to dispatch, you can cancel and receive a full refund.",
  },
];

const HowItWorks = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="How Solely Works — Kenya's Zero-Scam Escrow Marketplace"
        description="Learn how Solely's 4-step escrow protocol protects every transaction. No more pay-and-pray. Buyer and seller protected."
        canonical="https://solelyshoes.co.ke/how-it-works"
      />

      {/* Hero */}
      <section className="bg-gradient-hero text-primary-foreground py-14 sm:py-20">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 bg-black/20 text-primary-foreground border-0 text-xs font-bold uppercase tracking-widest">
            Zero-Scam Guarantee
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4 leading-tight">
            Shopping Without Stress
          </h1>
          <p className="text-base sm:text-xl max-w-2xl mx-auto opacity-90">
            Solely's escrow protocol ensures your money is safe at every step —
            for both buyers and sellers.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <Button size="lg" variant="secondary" className="rounded-full font-bold" asChild>
              <Link to="/shop"><ShoppingBag className="h-4 w-4 mr-2" /> Start Shopping</Link>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full border-2 border-primary-foreground/60 text-primary-foreground bg-transparent hover:bg-primary-foreground hover:text-primary font-bold" asChild>
              <Link to="/vendor"><Tag className="h-4 w-4 mr-2" /> Start Selling</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Delivery flow */}
      <section className="py-14 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-3 text-xs font-bold uppercase tracking-widest">Delivery Orders</Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold">4-Step Delivery Escrow</h2>
            <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
              The 3-digit PIN on your package is your proof of receipt. No PIN entry = no payment released.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className={`relative border rounded-2xl p-6 ${step.color}`}
                >
                  <span className="absolute top-4 right-5 text-5xl font-black opacity-10">{step.step}</span>
                  <div className={`w-12 h-12 rounded-xl ${step.iconBg} flex items-center justify-center mb-5`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-3">{step.title}</h3>
                  <ul className="space-y-2">
                    {step.details.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm opacity-80">
                        <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        {d}
                      </li>
                    ))}
                  </ul>
                  {i < steps.length - 1 && (
                    <ArrowRight className="hidden lg:block absolute -right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pickup flow */}
      <section className="py-12 sm:py-16 bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <Badge variant="secondary" className="mb-3 text-xs font-bold uppercase tracking-widest">Pickup Orders</Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Simpler — But Still Protected</h2>
            <p className="text-muted-foreground mt-2">No PIN on the package needed. Just collect, confirm, release.</p>
          </div>
          <div className="max-w-md mx-auto space-y-3">
            {pickupSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-4 bg-card border border-border rounded-xl px-5 py-4">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-extrabold text-sm flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10">Common Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="border border-border rounded-xl p-6 bg-card">
                <h3 className="font-bold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-16 bg-gradient-hero text-primary-foreground text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-4xl font-extrabold mb-3">Convinced? Start Shopping.</h2>
          <p className="text-sm sm:text-lg mb-6 opacity-90 max-w-md mx-auto">
            Every order. Every time. Escrow protection included.
          </p>
          <Button size="lg" variant="secondary" className="rounded-full font-bold" asChild>
            <Link to="/shop"><ShoppingBag className="h-4 w-4 mr-2" /> Browse All Items</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
