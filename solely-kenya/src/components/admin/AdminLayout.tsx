import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Store, Scale, Package, Megaphone, Mail, History,
  ClipboardList, Settings, Menu, Search, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface NavItem {
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  href: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function useNavGroups(): NavGroup[] {
  const [openDisputeCount, setOpenDisputeCount] = useState(0);

  useEffect(() => {
    const fetchDisputeCount = async () => {
      const { count } = await supabase
        .from("disputes")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      if (count) setOpenDisputeCount(count);
    };
    fetchDisputeCount();

    const channel = supabase
      .channel("public:disputes")
      .on("postgres_changes", { event: "*", schema: "public", table: "disputes" }, fetchDisputeCount)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return [
    {
      label: "Marketplace",
      items: [
        { label: "Overview", icon: LayoutDashboard, href: "/admin" },
        { label: "Orders", icon: ClipboardList, href: "/admin/orders" },
        { label: "Disputes", icon: Scale, href: "/admin/disputes", badge: openDisputeCount },
        { label: "Vendors", icon: Store, href: "/admin/vendors" },
        { label: "Products", icon: Package, href: "/admin/products" },
        { label: "Growth", icon: TrendingUp, href: "/admin/growth" },
      ],
    },
    {
      label: "Admin",
      items: [
        { label: "Comms", icon: Megaphone, href: "/admin/comms" },
        { label: "Mailing List", icon: Mail, href: "/admin/mailing-list" },
        { label: "Settings", icon: Settings, href: "/admin/settings" },
        { label: "Activity", icon: History, href: "/admin/activity" },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 pl-2.5 pr-3 py-2 rounded-lg text-xs font-medium transition-colors border-l-2",
        active
          ? "border-primary bg-primary/10 text-foreground font-semibold"
          : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
    >
      <item.icon size={15} strokeWidth={1.75} className={cn("flex-shrink-0", active && "text-primary")} />
      <span className="flex-1 truncate">{item.label}</span>
      {!!item.badge && (
        <span className={cn(
          "text-[9px] font-semibold rounded-full px-1.5 py-px",
          active ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// Light, off-white sidebar - part of the same floating frame as the content
// area (see AdminLayout below) - with a colored left-bar + tint for the
// active item, instead of a filled pill. Matches the reference dashboard's
// structure more closely than a dark charcoal sidebar would.
function SidebarContent({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-6">
        <p className="text-sm font-semibold text-foreground">
          Admin <span className="text-primary">Panel</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Manage your marketplace
        </p>
      </div>

      <nav className="flex-1 px-3 flex flex-col gap-5 overflow-y-auto">
        {groups.map(group => (
          <div key={group.label}>
            <p className="px-2.5 mb-1.5 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-widest">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map(item => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">
          A
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">Admin</p>
          <Link to="/" className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
            View site &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children, pageTitle }: { children: React.ReactNode; pageTitle?: string }) {
  const location = useLocation();
  const groups = useNavGroups();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    // Whole dashboard presented as one floating rounded card on a soft
    // gray canvas, rather than a flat full-bleed white page - modeled on
    // the reference the user shared.
    <div className="admin-shell min-h-screen bg-background p-2 sm:p-3 md:p-4">
      <div className="mx-auto max-w-[1600px] rounded-2xl md:rounded-[28px] bg-sidebar shadow-lg overflow-hidden flex flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col md:w-60 md:flex-shrink-0">
          <SidebarContent groups={groups} pathname={location.pathname} />
        </aside>

        {/* Mobile sidebar drawer */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="p-0 w-64 border-none">
            <SidebarContent groups={groups} pathname={location.pathname} onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="flex items-center gap-3 h-14 px-4 md:px-6 border-b border-border/70">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>

            <div className="hidden sm:flex relative flex-1 max-w-sm">
              <Search size={13} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search orders, vendors, products..."
                className="w-full pl-8 pr-3 py-1.5 rounded-full border border-border bg-card text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                disabled
                title="Global search coming soon"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <NotificationBell />
              <div className="md:hidden w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-medium text-primary">
                A
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="px-4 md:px-6 py-5 md:py-6 pb-10 flex-1 min-w-0">
            {pageTitle && (
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2.5">
                {pageTitle}
              </p>
            )}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
