import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Lock, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Eyebrow, Accent, SectionIntro, CtaPanel, FaqList } from "@/components/Marketing";

const PRICING = [
  { figure: "KSh 0", label: "to join. No listing or monthly fees." },
  { figure: "6%", label: "of the product price, only when you sell." },
  { figure: "All yours", label: "The delivery fee is never commissioned." },
];

const BENEFITS = [
  {
    title: "Buyers pay without asking for proof",
    desc: "A Solely link tells them the money waits with us until the order arrives. You stop sending screenshots of past deliveries to strangers.",
  },
  {
    title: "Paid the moment they confirm",
    desc: "The buyer enters the delivery PIN and shows you a release code. If they go quiet after confirming, the money releases to you after 6 hours anyway.",
  },
  {
    title: "A store page that sells for you",
    desc: "Your own link with your products, reviews and ratings. Put it in your bio and let buyers browse without DMing you first.",
  },
];

const STEPS = [
  { title: "Register", desc: "Create your seller profile. Our team verifies it before your first sale." },
  { title: "List your items", desc: "Add photos, price and sizes. Each item gets its own protected checkout link." },
  { title: "Share the link", desc: "Drop it in WhatsApp, Instagram or TikTok, or let buyers find you in the Solely shop." },
  { title: "Ship and get paid", desc: "Deliver, the buyer confirms, and the money goes to your balance. Withdraw to M-Pesa any time." },
];

const NEEDS = [
  "Items in good condition, new or pre-owned",
  "Clear photos of what you're selling",
  "Brand, size, condition and price for each item",
  "A phone number we can verify",
];

const FAQS = [
  {
    q: "Is there a fee to join?",
    a: "No. You pay 6% of the product price when an item sells, and nothing otherwise. There are no subscriptions or monthly costs.",
  },
  {
    q: "How much of each sale do I keep?",
    a: "94% of the product price, plus the full delivery fee you agreed with the buyer. We never take commission on delivery.",
  },
  {
    q: "What if the buyer takes the item and goes quiet?",
    a: "Once the buyer enters the delivery PIN, the money releases to you automatically after 6 hours, even if they never share the release code.",
  },
  {
    q: "How do I get paid?",
    a: "Released money lands in your Solely balance. Withdraw it to M-Pesa from your dashboard whenever you like. Standard M-Pesa transaction fees apply.",
  },
  {
    q: "Who handles delivery?",
    a: "You do, with your own rider or courier. Add the delivery details in your dashboard so the buyer can follow the order.",
  },
  {
    q: "Can I sell pre-owned items?",
    a: "Yes. Describe the condition honestly and pre-owned and thrifted items are welcome.",
  },
];

const Vendor = () => {
  return (
    <div data-layout="designed" className="min-h-screen bg-background">
      <SEO
        title="Sell Online Safely in Kenya with Payment Links"
        description="Stop losing sales because buyers don't trust you yet. Send them a secure Solely payment link, their money is protected until delivery. Zero fees to start. Works on WhatsApp, Instagram & TikTok."
        canonical="https://solelymarketplace.com/vendor"
      />

      {/* Hero */}
      <section className="pt-10 pb-12 sm:pt-14 lg:pt-20 lg:pb-16">
        <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-10 lg:gap-10 items-center">
          <div className="lg:col-span-7">
            <Eyebrow className="mb-7">For WhatsApp, Instagram and TikTok sellers</Eyebrow>
            <h1 className="font-display text-[2.75rem] sm:text-6xl lg:text-7xl leading-[1] [text-wrap:balance]">
              Stop losing sales <Accent>to mistrust.</Accent>
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg md:text-xl text-muted-foreground leading-relaxed [text-wrap:pretty]">
              Your followers want to buy. They just don't trust "send to Till." Send a Solely payment link and
              they pay knowing the money waits with us until the order arrives.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
              <Button
                size="lg"
                asChild
                className="h-14 rounded-full px-8 text-base font-semibold hover:bg-primary-hover shadow-[0_12px_32px_-10px_hsl(var(--primary)/0.6)] transition-[transform,background-color] duration-200 active:scale-[0.97]"
              >
                <Link to="/vendor/register">
                  Start selling free <ArrowRight className="ml-2 w-4 h-4" strokeWidth={2} />
                </Link>
              </Button>
              <a
                href="mailto:contact@solelymarketplace.com"
                className="inline-flex items-center justify-center py-3 -my-3 text-base font-medium text-muted-foreground hover:text-foreground underline decoration-foreground/20 underline-offset-[6px] hover:decoration-foreground transition-colors"
              >
                Questions? Email us
              </a>
            </div>
          </div>

          {/* A payment link as the buyer sees it in the chat */}
          <div className="lg:col-span-5 lg:justify-self-end w-full max-w-[380px] mx-auto lg:mx-0" aria-hidden="true">
            <div className="rounded-[1.75rem] bg-[hsl(30_20%_94%)] dark:bg-card p-4 sm:p-5 shadow-[0_30px_70px_-30px_hsl(30_30%_20%/0.45)]">
              <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[hsl(95_40%_86%)] dark:bg-[hsl(95_20%_22%)] px-4 py-2.5 text-sm text-foreground">
                Is it still available? Size 41
              </div>
              <div className="mt-3 w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-background px-4 py-2.5 text-sm text-foreground">
                Yes. Pay here, the money is held until you get them
              </div>
              <div className="mt-2 max-w-[92%] overflow-hidden rounded-2xl rounded-bl-md bg-background">
                <div className="h-36 bg-[url('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=300&fit=crop')] bg-cover bg-center" />
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">solelymarketplace.com</p>
                  <p className="mt-1 font-medium text-foreground">Red running sneakers, size 41</p>
                  <p className="mt-0.5 font-display text-2xl tabular-nums">KSh 3,450</p>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-medium">
                    Pay with M-Pesa
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="w-3.5 h-3.5 text-[hsl(40_62%_33%)]" /> Held by Solely until delivery
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing facts */}
      <section className="border-y border-primary/25 bg-cream">
        <div className="container mx-auto px-6 grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-primary/25">
          {PRICING.map((p) => (
            <div key={p.figure} className="py-5 sm:py-8 sm:px-8 first:sm:pl-0">
              <p className="font-display text-4xl tabular-nums">{p.figure}</p>
              <p className="mt-2 text-muted-foreground">{p.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="py-14 sm:py-16 lg:py-20">
        <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-6 lg:gap-16">
          <div className="lg:col-span-5">
            <Eyebrow className="mb-5">Why sellers switch</Eyebrow>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.04] [text-wrap:balance]">
              Close the sale at the <Accent>payment step.</Accent>
            </h2>
          </div>
          <ol className="lg:col-span-7 divide-y divide-border border-y border-border">
            {BENEFITS.map((b, i) => (
              <li key={b.title} className="grid grid-cols-[2.5rem_1fr] gap-3 py-5 sm:py-6">
                <span className="font-display text-2xl text-foreground/30 tabular-nums">0{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{b.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* How it works for sellers */}
      <section className="py-14 sm:py-16 lg:py-20 bg-sunken">
        <div className="container mx-auto px-6">
          <SectionIntro eyebrow="How it works" title="From sign-up to paid in four steps">
            Everything runs from your phone. No website, no app to install.
          </SectionIntro>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid grid-cols-[2.5rem_1fr] sm:block gap-3 border-t border-foreground/20 pt-4 sm:pt-6">
                <span className="font-display text-4xl sm:text-5xl leading-none text-[hsl(40_62%_33%)] dark:text-primary tabular-nums">{i + 1}</span>
                <div><h3 className="sm:mt-4 text-lg font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed">{s.desc}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you need */}
      <section className="py-14 sm:py-16 lg:py-20">
        <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-6 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            <Eyebrow className="mb-5">Before you start</Eyebrow>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.04]">What you need</h2>
          </div>
          <ul className="lg:col-span-7 grid sm:grid-cols-2 gap-x-8 gap-y-4">
            {NEEDS.map((n) => (
              <li key={n} className="flex items-start gap-3 text-foreground/85 leading-relaxed">
                <Check size={18} strokeWidth={2.25} className="mt-0.5 text-[hsl(40_62%_33%)] dark:text-primary shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-14 sm:pb-16 lg:pb-20">
        <div className="container mx-auto px-6">
          <h2 className="font-display text-4xl md:text-5xl leading-[1.04] mb-6 lg:mb-8">Questions sellers ask</h2>
          <FaqList items={FAQS} />
        </div>
      </section>

      <CtaPanel>
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-end">
          <div className="lg:col-span-7">
            <Eyebrow tone="inverse" className="mb-6">Free to join</Eyebrow>
            <h2 className="font-display text-4xl sm:text-5xl leading-[1.04] [text-wrap:balance]">
              Your next buyer is already <Accent onDark>in your DMs.</Accent>
            </h2>
          </div>
          <div className="lg:col-span-5 flex flex-wrap items-center gap-x-7 gap-y-4 lg:justify-end">
            <Button size="lg" className="h-12 rounded-full px-7 font-semibold hover:bg-primary-hover active:scale-[0.97]" asChild>
              <Link to="/vendor/register">Start selling free</Link>
            </Button>
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-1 py-3 -my-3 text-sm font-medium text-secondary-foreground/75 hover:text-secondary-foreground transition-colors"
            >
              How buyer protection works
            </Link>
          </div>
        </div>
      </CtaPanel>
    </div>
  );
};

export default Vendor;
