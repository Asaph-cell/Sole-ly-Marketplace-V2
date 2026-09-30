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
  Link2,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  unreadMessages: number;
}

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/vendor/dashboard", alertKey: null, action: null },
  { icon: Package, label: "My Products", path: "/vendor/products", alertKey: null, action: null },
  { icon: PlusCircle, label: "List Item", path: "/vendor/list-item", alertKey: null, action: null },
  { icon: ShoppingBag, label: "Orders", path: "/vendor/orders", alertKey: "pendingOrders" as const, action: null },
  { icon: Link2, label: "Payment Links", path: "/vendor/payment-links", alertKey: null, action: null },
  { icon: MessageCircle, label: "Messages", path: "/vendor/messages", alertKey: "unreadMessages" as const, action: null },
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
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[48px] bg-primary-soft text-primary-strong hover:bg-primary/20 mb-2"
        >
          <Download size={20} strokeWidth={1.5} className=" flex-shrink-0" />
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
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-150 min-h-[48px] relative",
              isActive
                ? "bg-primary-soft font-medium text-foreground before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-full before:bg-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary-strong")} strokeWidth={isActive ? 2 : 1.75} />
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
      <div className="mt-2 flex items-center justify-between border-t border-border px-4 pt-4">
        <span className="text-xs text-muted-foreground">Theme</span>
        <ThemeToggle />
      </div>
    </nav>
  );
};

export const VendorSidebar = ({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const [alertCounts, setAlertCounts] = useState<AlertCounts>({
    pendingOrders: 0,
    openDisputes: 0,
    unreadMessages: 0,
  });

  useEffect(() => {
    if (!user) return;

    const fetchAlertCounts = async () => {
      // Fetch pending orders count, only genuinely actionable ones (under 48 hours old)
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

      // Fetch unread messages count, messages sent to conversations where this vendor is a participant
      // that the vendor hasn't read yet (sender_id != vendor = sent by buyer, is_read = false)
      const { data: vendorConvs } = await supabase
        .from("conversations")
        .select("id")
        .eq("vendor_id", user.id);

      let unreadMessagesCount = 0;
      if (vendorConvs && vendorConvs.length > 0) {
        const convIds = vendorConvs.map((c: { id: string }) => c.id);
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .in("conversation_id", convIds)
          .eq("is_read", false)
          .neq("sender_id", user.id);
        unreadMessagesCount = count || 0;
      }

      setAlertCounts({
        pendingOrders: pendingOrdersCount || 0,
        openDisputes: openDisputesCount || 0,
        unreadMessages: unreadMessagesCount,
      });

      // Update PWA app badge with total alerts
      const totalAlerts = (pendingOrdersCount || 0) + (openDisputesCount || 0) + unreadMessagesCount;
      setAppBadge(totalAlerts);
    };


    // Show a browser notification if permission already granted
    const showOrderNotification = () => {
      if (Notification.permission === "granted") {
        new Notification("New order", {
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
          if (
            payload.eventType === "INSERT" &&
            payload.new?.status === "pending_vendor_confirmation"
          ) {
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

    // Subscribe to real-time new messages in vendor's conversations
    const messagesChannel = supabase
      .channel("vendor-messages-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // Only re-fetch if the new message wasn't sent by this vendor
          if (payload.new?.sender_id !== user.id) {
            fetchAlertCounts();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        () => {
          // Re-fetch when is_read flips to true so badge decrements
          fetchAlertCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(disputesChannel);
      supabase.removeChannel(messagesChannel);
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
              <Menu size={20} strokeWidth={1.5} className=" text-primary" />
              {(alertCounts.pendingOrders > 0 || alertCounts.openDisputes > 0 || alertCounts.unreadMessages > 0) && (
                // Menu is closed on mobile, so this dot is the only hint; static, not pulsing.
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" aria-label="Something needs your attention" />
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
