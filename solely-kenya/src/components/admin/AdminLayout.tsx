import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, Scale, Package, Megaphone, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export function AdminLayout({ children, pageTitle }: { children: React.ReactNode, pageTitle?: string }) {
  const location = useLocation();
  const [openDisputeCount, setOpenDisputeCount] = useState(0);

  useEffect(() => {
    const fetchDisputeCount = async () => {
      const { count } = await supabase
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      if (count) setOpenDisputeCount(count);
    };
    fetchDisputeCount();
    
    // Optional: Realtime subscription for dispute count
    const channel = supabase.channel('public:disputes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, fetchDisputeCount)
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const tabs = [
    { label: "Overview", icon: LayoutDashboard, href: "/admin", badge: 0 },
    { label: "Disputes", icon: Scale, href: "/admin/disputes", badge: openDisputeCount },
    { label: "Vendors", icon: Store, href: "/admin/vendors", badge: 0 },
    { label: "Products", icon: Package, href: "/admin/products", badge: 0 },
    { label: "Comms", icon: Megaphone, href: "/admin/comms", badge: 0 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar (all pages) */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 md:px-6 border-b border-border bg-background/80 backdrop-blur-md">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Admin <span className="text-primary">Panel</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Manage your marketplace
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Notifications"
          >
            <Bell size={15} strokeWidth={1.5} className="text-muted-foreground" />
          </button>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
            A
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="flex overflow-x-auto border-b border-border bg-background scrollbar-none sticky top-14 z-20">
        {tabs.map(tab => {
          // Exact match for overview, prefix match for others
          const isActive = tab.href === "/admin" 
            ? location.pathname === "/admin" 
            : location.pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "text-primary border-primary font-medium"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              <tab.icon size={13} strokeWidth={1.5} />
              {tab.label}
              {tab.badge > 0 && (
                <span className="ml-0.5 bg-destructive text-destructive-foreground text-[9px] font-semibold rounded-full px-1.5 py-px">
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Page wrapper */}
      <main className="px-4 md:px-6 py-5 md:py-6 pb-24 md:pb-6 flex-1">
        {pageTitle && (
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2.5">
            {pageTitle}
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
