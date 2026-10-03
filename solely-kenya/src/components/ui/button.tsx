import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Motion: see BUTTON MOTION in index.css.
 *  - Press: every button dips 2px while held and springs back up on release.
 *  - Magnetic: filled buttons (gold, ink) lean a few px toward the cursor and
 *    spring home when it leaves. Mouse only; touch and pens never move them.
 *  - Icons act out their verb on hover (plus turns, bin lid opens, bell rings).
 *
 * Surfaces: filled buttons carry a 1px inner top highlight and a shadow tinted
 * with their own hue, like a lit object, instead of a flat colour swap.
 */
const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm",
    "btn-fx",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "btn-magnetic bg-primary font-semibold text-primary-foreground",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.35),0_1px_2px_hsl(40_60%_25%/0.25)]",
          "hover:bg-[hsl(45_74%_54%)]",
          "hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.4),0_6px_16px_-6px_hsl(40_70%_32%/0.55)]",
          "active:shadow-[inset_0_1px_2px_hsl(40_60%_20%/0.25)]",
        ].join(" "),
        destructive: [
          "bg-destructive font-semibold text-destructive-foreground",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.2),0_1px_2px_hsl(4_60%_25%/0.25)]",
          "hover:bg-destructive/90 hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.2),0_6px_14px_-6px_hsl(4_64%_40%/0.5)]",
        ].join(" "),
        outline: [
          "border border-border bg-card font-medium text-foreground shadow-soft",
          // Hover warms toward gold instead of just greying.
          "hover:border-primary/55 hover:bg-primary-soft/60",
        ].join(" "),
        secondary: [
          "btn-magnetic bg-secondary font-semibold text-secondary-foreground",
          "shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_1px_2px_hsl(30_20%_10%/0.3)]",
          "hover:bg-secondary/85 hover:shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_6px_14px_-6px_hsl(30_20%_10%/0.45)]",
        ].join(" "),
        ghost: "font-medium text-foreground hover:bg-muted",
        link: "text-primary-strong underline-offset-4 decoration-primary-strong/40 hover:underline",
        accent: [
          "bg-primary-soft font-semibold text-primary-strong",
          "hover:bg-primary/20",
        ].join(" "),
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-11 w-11", // Minimum 44x44px for touch targets
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// How far a magnetic button may lean toward the cursor, in px.
const PULL_X = 5;
const PULL_Y = 3;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onPointerMove, onPointerLeave, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const magnetic = variant == null || variant === "default" || variant === "secondary";

    const handleMove = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerMove?.(e);
      if (!magnetic || e.pointerType !== "mouse") return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - r.left) / r.width - 0.5) * 2 * PULL_X;
      const dy = ((e.clientY - r.top) / r.height - 0.5) * 2 * PULL_Y;
      el.style.setProperty("--tx", `${dx.toFixed(1)}px`);
      el.style.setProperty("--ty", `${dy.toFixed(1)}px`);
    };

    const handleLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
      onPointerLeave?.(e);
      if (!magnetic) return;
      e.currentTarget.style.setProperty("--tx", "0px");
      e.currentTarget.style.setProperty("--ty", "0px");
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
