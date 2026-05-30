import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ReadMoreProps {
    children: React.ReactNode;
    maxHeight?: number;
    className?: string;
    buttonClassName?: string;
}

export function ReadMore({
    children,
    maxHeight = 150,
    className,
    buttonClassName
}: ReadMoreProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsTruncation, setNeedsTruncation] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            setNeedsTruncation(contentRef.current.scrollHeight > maxHeight);
        }
    }, [children, maxHeight]);

    if (!needsTruncation) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div className={className}>
            <div
                ref={contentRef}
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    !isExpanded && "relative"
                )}
                style={{
                    maxHeight: isExpanded ? contentRef.current?.scrollHeight : maxHeight,
                }}
            >
                {children}
                {!isExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                )}
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "mt-2 w-full md:w-auto text-primary hover:text-primary/80 min-h-[44px]",
                    buttonClassName
                )}
            >
                {isExpanded ? (
                    <>
                        <ChevronUp size={16} strokeWidth={1.5} className=" mr-2" />
                        Show Less
                    </>
                ) : (
                    <>
                        <ChevronDown size={16} strokeWidth={1.5} className=" mr-2" />
                        Read More
                    </>
                )}
            </Button>
        </div>
    );
}
