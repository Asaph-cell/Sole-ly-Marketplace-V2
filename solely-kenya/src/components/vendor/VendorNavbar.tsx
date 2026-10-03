import { Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { PendingOrdersBanner } from "./PendingOrdersBanner";
import { DeliveryInquiryBanner } from "./DeliveryInquiryBanner";
import { VendorSidebar } from "./VendorSidebar";

export const VendorNavbar = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

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

  return (
    <>
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 flex-nowrap gap-2">
          <Link to="/shop" className="flex flex-col items-start shrink-0">
            <BrandLogo alt="Solely Marketplace" className="h-8 sm:h-10 w-auto" />
            <span className="text-[8px] sm:text-[9px] text-muted-foreground tracking-wide uppercase -mt-3 pl-1">the marketplace</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-nowrap">
            {isAdmin && (
              <Link to="/admin/dashboard" className="hidden sm:inline-flex">
                <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted transition-colors text-xs">
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

      {/* One calm strip per thing that needs the vendor. Each hides itself
          on the page that already shows the same information. */}
      <PendingOrdersBanner />

      <DeliveryInquiryBanner />
    </>
  );
};

