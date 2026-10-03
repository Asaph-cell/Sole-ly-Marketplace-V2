import logo from "@/assets/solely-logo.svg";
import logoDark from "@/assets/solely-logo-dark.svg";
import { cn } from "@/lib/utils";

/**
 * The wordmark in both themes. The light file has black lettering, so dark
 * mode swaps to a copy with warm-white lettering; the gold "ly" is the same
 * in both. Swapped with CSS so there's no flash while the theme resolves.
 */
export const BrandLogo = ({ className, alt = "Solely" }: { className?: string; alt?: string }) => (
  <>
    <img src={logo} alt={alt} className={cn(className, "dark:hidden")} />
    <img src={logoDark} alt={alt} className={cn(className, "hidden dark:block")} />
  </>
);
