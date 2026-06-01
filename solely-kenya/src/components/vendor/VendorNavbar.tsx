import { Shield, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/solely-logo.svg";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { PendingOrdersBanner } from "./PendingOrdersBanner";
import { VendorSidebar } from "./VendorSidebar";

export const VendorNavbar = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [openDisputes, setOpenDisputes] = useState(0);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
          return;
        }

        setIsAdmin(data?.some(r => r.role === "admin") || false);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }
    };
    checkAdminStatus();
  }, [user]);

  // Fetch open disputes count
  useEffect(() => {
    if (!user) return;

    const fetchDisputes = async () => {
      const { count } = await supabase
        .from("disputes")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", user.id)
        .in("status", ["open", "under_review"]);

      setOpenDisputes(count || 0);
    };

    fetchDisputes();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("navbar-disputes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "disputes",
          filter: `vendor_id=eq.${user.id}`,
        },
        () => fetchDisputes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 flex-nowrap gap-2">
          <Link to="/shop" className="flex flex-col items-start shrink-0">
            <img src={logo} alt="Solely Marketplace" className="h-8 sm:h-10 w-auto" />
            <span className="text-[8px] sm:text-[9px] text-muted-foreground tracking-wide uppercase -mt-3 pl-1">the marketplace</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-nowrap">
            {/* Disputes Alert - Always visible when there are open disputes */}
            {openDisputes > 0 && (
              <Link to="/vendor/disputes">
                <Badge
                  variant="destructive"
                  className="gap-1 cursor-pointer hover:bg-destructive/90 transition-colors animate-pulse"
                >
                  <AlertTriangle strokeWidth={1.5} className="h-3 w-3" />
                  <span>{openDisputes} Dispute{openDisputes !== 1 ? 's' : ''}</span>
                </Badge>
              </Link>
            )}

            {isAdmin && (
              <Link to="/admin/dashboard" className="hidden sm:inline-flex">
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80 transition-colors text-xs">
                  <Shield strokeWidth={1.5} className="h-3 w-3" />
                  <span className="hidden sm:inline">Admin</span>
                </Badge>
              </Link>
            )}

            {/* Mobile Menu Button */}
            <VendorSidebar variant="mobile" />
          </div>
        </div>
      </header>

      {/* Pending Orders Notification Banner */}
      <PendingOrdersBanner />
    </>
  );
};

