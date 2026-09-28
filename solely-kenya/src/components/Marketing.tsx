import { ReactNode } from "react";

// Shared building blocks for the public marketing pages (home, sell, how it
// works, about). Keeps the hairline label, heading scale and dark closing
// panel identical from page to page.

export const Eyebrow = ({ children, className = "", tone = "default" }: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "inverse";
}) => (
  <p
    className={`flex items-center gap-3 text-sm font-medium ${
      tone === "inverse" ? "text-white/70" : "text-foreground/70"
    } ${className}`}
  >
    <span className="h-px w-8 bg-primary shrink-0" aria-hidden="true" />
    {children}
  </p>
);

// Gold italic accent phrase inside a display heading.
export const Accent = ({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) => (
  <span className={`font-serif italic ${onDark ? "text-primary" : "text-[hsl(40_62%_33%)] dark:text-primary"}`}>
    {children}
  </span>
);

export const SectionIntro = ({ eyebrow, title, children, className = "" }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) => (
  <div className={`grid lg:grid-cols-12 gap-4 lg:gap-12 items-end mb-8 lg:mb-12 ${className}`}>
    <div className="lg:col-span-7">
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h2 className="font-display text-4xl md:text-5xl leading-[1.04] [text-wrap:balance]">{title}</h2>
    </div>
    {children && (
      <p className="lg:col-span-5 text-muted-foreground text-lg leading-relaxed max-w-md [text-wrap:pretty]">
        {children}
      </p>
    )}
  </div>
);

// Dark closing call-to-action panel with a warm corner light.
export const CtaPanel = ({ children }: { children: ReactNode }) => (
  <section className="pt-4 pb-2 sm:pt-6">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="bg-grain relative overflow-hidden rounded-[2rem] bg-secondary text-secondary-foreground px-6 py-10 sm:p-12 lg:p-14">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(60% 80% at 100% 0%, hsl(var(--primary) / 0.22), transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  </section>
);

// Question/answer list laid out side by side instead of an accordion.
export const FaqList = ({ items }: { items: { q: string; a: ReactNode }[] }) => (
  <dl className="divide-y divide-border border-y border-border">
    {items.map((item) => (
      <div key={item.q} className="grid md:grid-cols-12 gap-1.5 md:gap-10 py-5">
        <dt className="md:col-span-5 font-medium text-foreground">{item.q}</dt>
        <dd className="md:col-span-7 text-muted-foreground leading-relaxed">{item.a}</dd>
      </div>
    ))}
  </dl>
);
