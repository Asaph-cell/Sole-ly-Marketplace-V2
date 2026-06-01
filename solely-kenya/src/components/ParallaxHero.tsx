import { useRef } from "react";
import heroImage from "@/assets/hero-sneakers-3.png";

interface ParallaxHeroProps {
    children: React.ReactNode;
}

const ParallaxHero = ({ children }: ParallaxHeroProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <section
            ref={containerRef}
            className="relative flex items-end overflow-hidden min-h-[40vh] sm:min-h-[70vh]"
        >
            {/* Hero Background Image */}
            <div className="absolute inset-0 pointer-events-none bg-black">
                <img
                    src={heroImage}
                    alt="Buy authentic sneakers and shoes online in Kenya - Solely Marketplace"
                    className="w-full h-full object-cover object-center"
                />
            </div>

            {/* Translucent overlay — soft gradient for readability without hiding the image */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `
                        linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.08) 100%),
                        linear-gradient(to right, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 60%)
                    `,
                }}
            />

            {children}
        </section>
    );
};

export default ParallaxHero;
