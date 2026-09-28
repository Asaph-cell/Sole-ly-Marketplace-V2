import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Motion lives in `.skeleton` (index.css) so reduced-motion can drop it. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
