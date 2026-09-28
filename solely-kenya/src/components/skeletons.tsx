/**
 * Content-shaped placeholders. They mirror the real layout closely so nothing
 * jumps when data lands, which is the whole point of a skeleton over a spinner.
 */
import { useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Fallback while a page's code is still downloading. It picks the skeleton
 * that page will show once it's fetching data, so the user sees one loading
 * state from tap to content instead of a spinner followed by a skeleton.
 */
export function RouteSkeleton() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/product/")) return <ProductDetailSkeleton />;
  if (pathname.startsWith("/shop") || pathname.startsWith("/wishlist")) return <ShopSkeleton />;
  if (pathname.startsWith("/store/") || pathname.startsWith("/vendors")) return <ShopSkeleton />;
  if (
    /^\/vendor\/(list|edit|add|settings|register)/.test(pathname) ||
    /^\/(checkout|delivery|buy|pay|auth|reset-password|report-listing|feedback|contact)/.test(pathname)
  ) return <FormSkeleton />;
  if (pathname.startsWith("/vendor/") || pathname.startsWith("/admin")) return <DashboardSkeleton />;
  if (pathname.startsWith("/orders") || pathname.startsWith("/messages") || pathname.startsWith("/cart")) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Skeleton className="h-8 w-40 mb-6" />
        <ListSkeleton rows={5} />
      </div>
    );
  }
  return <PageSkeleton />;
}

/** Generic content page: heading, a few paragraphs, a card grid. */
export function PageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6" role="status" aria-label="Loading">
      <div className="space-y-3 max-w-2xl">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <ProductGridSkeleton count={4} />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="h-full bg-card border border-border rounded-[20px] overflow-hidden flex flex-col" aria-hidden>
      <Skeleton className="w-full aspect-square rounded-none" />
      <div className="p-3.5 flex flex-col gap-2 flex-grow">
        <Skeleton className="h-2.5 w-16" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-full" />
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading products" className={cn("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ShopSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8" role="status" aria-label="Loading shop">
      <Skeleton className="h-8 w-48 mb-2" />
      <Skeleton className="h-4 w-32 mb-6" />
      <div className="flex gap-2 mb-6 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
        <div className="hidden lg:flex flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
        <ProductGridSkeleton count={9} className="lg:col-span-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5" />
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8" role="status" aria-label="Loading product">
      <Skeleton className="h-4 w-40 mb-6" />
      <div className="grid md:grid-cols-2 gap-6 lg:gap-12">
        <div className="space-y-3">
          <Skeleton className="w-full aspect-square rounded-2xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-16 h-16 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-7 w-32" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="flex gap-2 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-12 rounded-lg" />
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Orders, messages, admin tables: thumbnail + two lines + trailing value. */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card">
          <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6" role="status" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-border bg-card space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <ListSkeleton rows={4} />
    </div>
  );
}

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-56" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}
