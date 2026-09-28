import { useState, useEffect, CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface DynamicHeroTextProps {
    texts: string[];
    interval?: number;
    className?: string;
    style?: CSSProperties;
}

export function DynamicHeroText({
    texts,
    interval = 6000,
    className,
    style
}: DynamicHeroTextProps) {
    const [index, setIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setInterval(() => {
            setIsVisible(false);

            setTimeout(() => {
                setIndex((prev) => (prev + 1) % texts.length);
                setIsVisible(true);
            }, 1000); // Wait for transition to finish

        }, interval);

        return () => clearInterval(timer);
    }, [texts.length, interval]);

    return (
        <span
            className={cn(
                "inline-block transition duration-1000 ease-in-out transform",
                isVisible
                    ? "opacity-100 translate-y-0 blur-0 scale-100"
                    : "opacity-0 translate-y-8 blur-sm scale-95",
                className
            )}
            style={{ willChange: "transform, opacity, filter", ...style }}
        >
            {texts[index]}
        </span>
    );
}
