import { Lock, Package, KeyRound, Wallet, Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Eyebrow, Accent, SectionIntro, CtaPanel, FaqList } from "@/components/Marketing";

const steps = [
  {
    icon: Wallet,
    title: "Order and pay",
    details: [
      "Browse sellers on Solely, or open a seller's payment link",
      "Choose delivery or pickup at checkout",
      "Pay with M-Pesa. No account needed to browse",
    ],
  },
  {
    icon: Lock,
    title: "We hold the money",
    details: [
      "Your payment goes into a Solely holding account, not to the seller",
      "The seller accepts or declines within 24 hours",
      "If they decline, you get your money back straight away",
    ],
  },
  {
    icon: Package,
    title: "Receive and check",
    details: [
      "The seller dispatches and writes a 3-digit PIN on your package",
      "Check the item, then enter the PIN to confirm you have it",
      "Solely then gives you a 6-digit release code",
    ],
  },
  {
    icon: KeyRound,
    title: "Release the payment",
    details: [
      "Show the release code to the seller, in person or as a screenshot",
      "The seller enters it and gets paid on the spot",
      "If you don't share it, the money releases 6 hours after your PIN",
    ],
  },
];

const pickupSteps = [
  "Pay with M-Pesa. We hold the money",
  "The seller gets your item ready",
  "Collect it and check it in person",
  "Show the release code and the seller is paid",
];

const faqs = [
  {
    q: "What if my order never arrives?",
    a: "Your money stays locked until you enter the delivery PIN. Open a dispute and we'll refund you in full if the seller can't prove they dispatched it.",
  },
  {
    q: "What if it's damaged or not as described?",
    a: "Open a dispute any time before the money is released. Our team reviews every dispute within 24 hours and can refund you or release the payment to the seller.",
  },
  {
    q: "I entered the PIN. What happens if I never share the release code?",
    a: "The money releases to the seller automatically 6 hours after you enter the PIN. Only enter it once the item is in your hands and you've checked it.",
  },
  {
    q: "How long does the seller have to dispatch?",
    a: "Sellers must dispatch within the time shown on the product page. If they don't, you can cancel and get a full refund.",
  },
  {
    q: "How do pickup orders work?",
    a: "There's no PIN on a package. You collect the item, Solely gives you the release code, and you show it to the seller.",
  },
];

const HowItWorks = () => {
  return (
    <div data-layout="designed" className="min-h-screen bg-background">
      <SEO
        title="How Solely Protects Your Money"
        description="See how Solely holds your M-Pesa payment until your order arrives and pays the seller when you confirm. Full refund if it never comes."
        canonical="https://solelymarketplace.com/how-it-works"
      />

      {/* Hero */}
      <section className="pt-10 pb-12 sm:pt-14 lg:pt-20 lg:pb-16">
        <div className="container mx-auto px-6 max-w-5xl">
          <Eyebrow className="mb-7">Buyer protection on every order</Eyebrow>
          <h1 className="font-display text-[2.75rem] sm:text-6xl lg:text-7xl leading-[1] [text-wrap:balance]">
            Your money waits <Accent>until your order arrives.</Accent>
          </h1>
          <p className="mt-7 max-w-[36rem] text-lg md:text-xl text-muted-foreground leading-relaxed [text-wrap:pretty]">
            You pay with M-Pesa, we hold it, and the seller is paid only after you've checked the item.
            If it never comes, you get it all back.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
            <Button
              size="lg"
              asChild
              className="h-14 rounded-full px-8 text-base font-semibold hover:bg-primary-hover transition-[transform,background-color] duration-200 active:scale-[0.97]"
            >
              <Link to="/shop">Start shopping <ArrowRight className="ml-2 w-4 h-4" strokeWidth={2} /></Link>
            </Button>
            <Link
              to="/vendor"
              className="inline-flex items-center justify-center py-3 -my-3 text-base font-medium text-muted-foreground hover:text-foreground underline decoration-foreground/20 underline-offset-[6px] hover:decoration-foreground transition-colors"
            >
              I'm a seller
            </Link>
          </div>
        </div>
      </section>

      {/* Delivery flow */}
      <section className="py-14 sm:py-16 lg:py-20 bg-sunken">
        <div className="container mx-auto px-6">
          <SectionIntro eyebrow="Delivery orders" title="Four steps, and the seller is paid last">
            The PIN on your package is your proof of receipt. Until you enter it, the seller can't touch the money.
          </SectionIntro>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-3xl bg-card p-5 lg:p-7 shadow-card flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-5xl text-[hsl(40_62%_33%)] dark:text-primary tabular-nums">{i + 1}</span>
                    <Icon size={20} strokeWidth={1.75} className="text-foreground/40" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 lg:mt-6 text-lg font-semibold text-foreground">{step.title}</h3>
                  <ul className="mt-3 space-y-2.5">
                    {step.details.map((d) => (
                      <li key={d} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                        <Check size={14} strokeWidth={2.25} className="mt-1 shrink-0 text-foreground/35" aria-hidden="true" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Pickup flow */}
      <section className="py-14 sm:py-16 lg:py-20 bg-cream border-b border-primary/25">
        <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-6 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            <Eyebrow className="mb-5">Pickup orders</Eyebrow>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.04] [text-wrap:balance]">
              Simpler, <Accent>still protected.</Accent>
            </h2>
            <p className="mt-5 text-muted-foreground text-lg leading-relaxed max-w-md">
              No PIN needed. Collect, check and release, all in one visit.
            </p>
          </div>
          <ol className="lg:col-span-7 divide-y divide-primary/25 border-y border-primary/25">
            {pickupSteps.map((s, i) => (
              <li key={s} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-3 py-4">
                <span className="font-display text-2xl text-foreground/30 tabular-nums">{i + 1}</span>
                <span className="text-foreground/85">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 sm:py-16 lg:py-20">
        <div className="container mx-auto px-6">
          <h2 className="font-display text-4xl md:text-5xl leading-[1.04] mb-6 lg:mb-8">Questions buyers ask</h2>
          <FaqList items={faqs} />
        </div>
      </section>

      <CtaPanel>
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-end">
          <div className="lg:col-span-7">
            <Eyebrow tone="inverse" className="mb-6">Every order, protected</Eyebrow>
            <h2 className="font-display text-4xl sm:text-5xl leading-[1.04] [text-wrap:balance]">
              Shop sellers you found online, <Accent onDark>without the gamble.</Accent>
            </h2>
          </div>
          <div className="lg:col-span-5 flex flex-wrap items-center gap-x-7 gap-y-4 lg:justify-end">
            <Button size="lg" className="h-12 rounded-full px-7 font-semibold hover:bg-primary-hover active:scale-[0.97]" asChild>
              <Link to="/shop">Browse the shop</Link>
            </Button>
            <Link
              to="/vendors"
              className="inline-flex items-center gap-1 py-3 -my-3 text-sm font-medium text-secondary-foreground/75 hover:text-secondary-foreground transition-colors"
            >
              See all stores
            </Link>
          </div>
        </div>
      </CtaPanel>
    </div>
  );
};

export default HowItWorks;
