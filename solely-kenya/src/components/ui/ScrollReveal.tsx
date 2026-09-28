"use client";

import { motion, useInView, useAnimation, Variant } from "framer-motion";
import { useEffect, useRef } from "react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

interface ScrollRevealProps {
    children: React.ReactNode;
    width?: "fit-content" | "100%";
    mode?: "fade-up" | "slide-in" | "zoom-in" | "aggressive";
    delay?: number;
    duration?: number;
    className?: string;
    enableHover?: boolean;
}

export const ScrollReveal = ({
    children,
    width = "100%",
    mode = "fade-up",
    delay = 0,
    duration = 0.5,
    className = "",
    enableHover = false
}: ScrollRevealProps & { enableHover?: boolean }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-10% 0px" });
    const mainControls = useAnimation();

    useEffect(() => {
        if (isInView) {
            mainControls.start("visible");
        }
    }, [isInView, mainControls]);

    const variants = {
        "fade-up": {
            hidden: { opacity: 0, transform: "translateY(24px)" },
            visible: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.6, ease: EASE_OUT, delay } },
        },
        "slide-in": {
            hidden: { opacity: 0, transform: "translateX(-24px)" },
            visible: { opacity: 1, transform: "translateX(0px)", transition: { duration: 0.6, ease: EASE_OUT, delay } },
        },
        "zoom-in": {
            // Never grow from far below full size; 0.95 reads as "arriving", 0.8 as "inflating".
            hidden: { opacity: 0, transform: "scale(0.95)" },
            visible: { opacity: 1, transform: "scale(1)", transition: { duration: 0.5, ease: EASE_OUT, delay } },
        },
        "aggressive": {
            hidden: { opacity: 0, transform: "translateY(48px) scale(0.95)" },
            visible: {
                opacity: 1,
                transform: "translateY(0px) scale(1)",
                transition: { type: "spring", duration: 0.6, bounce: 0.2, delay }
            },
        }
    };

    return (
        <div ref={ref} style={{ position: "relative", width }} className={className}>
            <motion.div
                variants={variants[mode] as { hidden: Variant; visible: Variant }}
                initial="hidden"
                animate={mainControls}
                transition={{ duration, delay }}
                style={{ willChange: "transform, opacity" }}
                whileHover={enableHover && typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches ? {
                    scale: 1.03,
                    transition: { duration: 0.2, ease: EASE_OUT }
                } : undefined}
            >
                {children}
            </motion.div>
        </div>
    );
};
