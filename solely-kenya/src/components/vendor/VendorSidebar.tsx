import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  ShoppingBag,
  Star,
  AlertTriangle,
  Menu,
  LogOut,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { setAppBadge } from "@/lib/badge";

interface AlertCounts {
  pendingOrders: number;
  openDisputes: number;
}

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/vendor/dashboard", alertKey: null, action: null },
  { icon: Package, label: "My Products", path: "/vendor/products", alertKey: null, action: null },
  { icon: PlusCircle, label: "List Item", path: "/vendor/list-item", alertKey: null, action: null },
  { icon: ShoppingBag, label: "Orders", path: "/vendor/orders", alertKey: "pendingOrders" as const, action: null },
  { icon: Star, label: "Ratings", path: "/vendor/ratings", alertKey: null, action: null },
  { icon: AlertTriangle, label: "Disputes", path: "/vendor/disputes", alertKey: "openDisputes" as const, action: null },
  { icon: Settings, label: "Account Settings", path: "/vendor/settings", alertKey: null, action: null },
  { icon: LogOut, label: "Logout", path: "", alertKey: null, action: "logout" as const },
];

const SidebarContent = ({
  onItemClick,
  alertCounts,
  onLogout,
  canInstall,
  onInstall,
}: {
  onItemClick?: () => void;
  alertCounts: AlertCounts;
  onLogout: () => void;
  canInstall?: boolean;
  onInstall?: () => void;
}) => {
  const location = useLocation();

  return (
    <nav className="p-4 space-y-2">
      {/* Install App Button */}
      {canInstall && onInstall && (
        <button
          onClick={() => {
            onInstall();
            onItemClick?.();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] bg-gradient-to-r from-primary to-amber-500 text-white hover:from-primary/90 hover:to-amber-600 mb-2"
        >
          <Download className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 text-left font-medium">Install App</span>
        </button>
      )}
      {menuItems.map((item, index) => {
        const Icon = item.icon;
        const isActive = item.path && location.pathname === item.path;
        const alertCount = item.alertKey ? alertCounts[item.alertKey] : 0;

        // Handle logout action
        if (item.action === "logout") {
          return (
            <button
              key={`action-${index}`}
              onClick={() => {
                onLogout();
                onItemClick?.();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] relative",
                "hover:bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          );
        }

        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] relative",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            )}
          >
            <div className="relative">
              <Icon className="h-5 w-5 flex-shrink-0" />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="flex-1">{item.label}</span>
            {alertCount > 0 && (
              <Badge
                variant="destructive"
                className="h-5 min-w-[20px] px-1.5 text-xs font-bold"
              >
                {alertCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export const VendorSidebar = ({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const [alertCounts, setAlertCounts] = useState<AlertCounts>({
    pendingOrders: 0,
    openDisputes: 0,
  });

  useEffect(() => {
    if (!user) return;

    const fetchAlertCounts = async () => {
      // Fetch pending orders count — only genuinely actionable ones (under 48 hours old)
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { count: pendingOrdersCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", user.id)
        .eq("status", "pending_vendor_confirmation")
        .gte("created_at", cutoff);

      // Fetch open disputes count
      const { count: openDisputesCount } = await supabase
        .from("disputes")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", user.id)
        .in("status", ["open", "under_review"]);

      setAlertCounts({
        pendingOrders: pendingOrdersCount || 0,
        openDisputes: openDisputesCount || 0,
      });

      // Update PWA app badge with total alerts
      const totalAlerts = (pendingOrdersCount || 0) + (openDisputesCount || 0);
      setAppBadge(totalAlerts);
    };

    // Play a pleasant chime when a new order arrives
    const playNewOrderSound = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const play = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        const t = ctx.currentTime;
        play(880, t, 0.3);        // A5
        play(1108, t + 0.18, 0.4); // C#6
        play(1318, t + 0.36, 0.5); // E6
      } catch (e) {
        // Audio context not available (e.g. no user interaction yet) — silent fail
      }
    };

    // Show a browser notification if permission already granted
    const showOrderNotification = () => {
      if (Notification.permission === "granted") {
        new Notification("🛒 New Order!", {
          body: "A customer just placed an order. Tap to review.",
          icon: "/favicon.ico",
          tag: "new-order",
        });
      }
    };

    fetchAlertCounts();

    // Subscribe to real-time updates for orders
    const ordersChannel = supabase
      .channel("vendor-orders-alerts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `vendor_id=eq.${user.id}`,
        },
        (payload) => {
          fetchAlertCounts();
          // Play sound + notify only on brand-new pending orders
          if (
            payload.eventType === "INSERT" &&
            payload.new?.status === "pending_vendor_confirmation"
          ) {
            playNewOrderSound();
            showOrderNotification();
          }
        }
      )
      .subscribe();

    // Subscribe to real-time updates for disputes
    const disputesChannel = supabase
      .channel("vendor-disputes-alerts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "disputes",
          filter: `vendor_id=eq.${user.id}`,
        },
        () => fetchAlertCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(disputesChannel);
    };
  }, [user]);

  const { signOut } = useAuth();
  const { canInstall, promptInstall } = usePWAInstall();

  const handleInstall = async () => {
    await promptInstall();
  };

  return (
    <>
      {/* Mobile Menu for Navbar */}
      {variant === "mobile" && (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 shrink-0 border-primary/20 relative"
            >
              <Menu className="h-5 w-5 text-primary" />
              {(alertCounts.pendingOrders > 0 || alertCounts.openDisputes > 0) && (
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Vendor Menu</SheetTitle>
            </SheetHeader>
            <SidebarContent
              onItemClick={() => setIsOpen(false)}
              alertCounts={alertCounts}
              onLogout={signOut}
              canInstall={canInstall}
              onInstall={handleInstall}
            />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar */}
      {variant === "sidebar" && (
        <aside className="hidden lg:block w-64 border-r border-border min-h-screen bg-card flex-shrink-0">
          <SidebarContent
            alertCounts={alertCounts}
            onLogout={signOut}
            canInstall={canInstall}
            onInstall={handleInstall}
          />
        </aside>
      )}
    </>
  );
};
