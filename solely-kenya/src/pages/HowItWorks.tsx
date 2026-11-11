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
      "The seller accepts or declines within 48 hours",
      "If they decline, you get your money back straight away",
    ],
  },
  {
    icon: Package,
    title: "Check what's packed",
    details: [
      "Before it ships, the seller shows you exactly what's in the package",
      "Not what you ordered? Tap \"This is wrong\" and it's held back",
      "If it isn't shipped in time, you're refunded automatically",
    ],
  },
  {
    icon: KeyRound,
    title: "Receive and release",
    details: [
      "When it arrives, check it first",
      "Tap \"Yes, I got it\" or give the seller your code, and they're paid",
      "Something wrong? Tap \"Something wrong?\" and the payment stays held",
    ],
  },
];

const pickupSteps = [
  "Pay with M-Pesa. We hold the money",
  "The seller gets your item ready",
  "Collect it and check it in person",
  "Confirm in the app or show your code, and the seller is paid",
];

const faqs = [
  {
    q: "What if my order never arrives?",
    a: "Every delivery has a deadline based on distance. If it doesn't arrive and the seller can't tell us where it is, you're refunded in full automatically.",
  },
  {
    q: "What if it's damaged or not as described?",
    a: "Tap \"Something wrong?\" before the money is released. The seller is asked to fix it (a partial refund, a replacement, or a full refund once they collect it), and they cover any delivery costs. If they don't respond, you're refunded. If you can't agree, Solely decides.",
  },
  {
    q: "What happens if I don't confirm?",
    a: "Once the seller marks your order as arrived, we ask you twice. If you don't report a problem within 6 daytime hours (the clock pauses from 6pm to 7am), the seller is paid. If it didn't arrive, tell us and the payment stays held.",
  },
  {
    q: "How long does the seller have to ship?",
    a: "Sellers must ship within 8 daytime hours of accepting (most within 3), or send you an update. If they don't, you're refunded in full automatically.",
  },
  {
    q: "Can I return something I just don't want?",
    a: "Not once it's shipped. Returns are only for items that arrive damaged, not as described, or not what you ordered.",
  },
  {
    q: "How do pickup orders work?",
    a: "You collect the item and check it there. Then tap \"I've collected it\" or give the seller your code, and they're paid.",
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
            You see what's packed before it ships, and the seller can't touch the money until you've got it.
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
              Collect, check and release, all in one visit.
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
