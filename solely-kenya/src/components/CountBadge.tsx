import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A number badge that bumps when its count goes up, so adding to cart visibly
 * "lands" in the navbar. It stays still on mount, so navigating between pages
 * (which remounts the navbar) doesn't replay the bump.
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  const prev = useRef(count);
  const [bumpKey, setBumpKey] = useState(0);

  useEffect(() => {
    if (count > prev.current) setBumpKey((k) => k + 1);
    prev.current = count;
  }, [count]);

  if (count <= 0) return null;

  return (
    <span key={bumpKey} className={cn(bumpKey > 0 && "animate-badge-bump", className)}>
      {count}
    </span>
  );
}
