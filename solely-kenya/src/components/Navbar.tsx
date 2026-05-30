import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { NavLinks } from "./navbar/NavLinks";
import { AuthButtons } from "./navbar/AuthButtons";
import { MobileNav } from "./navbar/MobileNav";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Search } from "lucide-react";
import logo from "@/assets/solely-logo.svg";
import { saveSearch } from "@/lib/searchHistory";

const Navbar = () => {
  const { user, isVendor } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isVendorPage = location.pathname.startsWith('/vendor');
  const { totalQuantity } = useCart();
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    try {
      localStorage.removeItem("solely_cart_v1");
      sessionStorage.clear();
      const { error } = await supabase.auth.signOut();
      if (error) console.error("Logout failed:", error.message);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      try {
        window.location.replace("/auth");
      } catch (e) {
        try { window.location.href = "/auth"; }
        catch (e2) { window.location.assign("/auth"); }
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      saveSearch(searchQuery.trim());
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/shop");
    }
  };

  const navLinks = [
    { name: "Shop", path: "/shop" },
    { name: "Sell", path: "/vendor" },
    { name: "About", path: "/about" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      {/* ── Row 1: Logo + Desktop Nav + Cart + Auth ── */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between flex-nowrap py-3 sm:py-4">
          {/* Logo */}
          <Link to="/" className="flex flex-col items-start group shrink-0">
            <img
              src={logo}
              alt="Solely Marketplace"
              className="h-12 sm:h-14 w-auto transition-transform group-hover:scale-105"
            />
            <span className="text-[9px] sm:text-[10px] text-muted-foreground tracking-wide uppercase -mt-3 pl-1">
              Kenya's Trusted Marketplace
            </span>
          </Link>

          {/* Desktop Nav - Center */}
          <div className="hidden md:flex items-center justify-center flex-1 px-6 gap-8">
            <NavLinks links={navLinks} className="text-sm" />
          </div>

          {/* Right side - Cart & Auth (desktop) */}
          <div className="hidden md:flex items-center gap-4 flex-shrink-0">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/cart" className="relative">
                <ShoppingCart size={20} strokeWidth={1.5}  />
                {totalQuantity > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center px-1">
                    {totalQuantity}
                  </span>
                )}
              </Link>
            </Button>
            <AuthButtons
              user={user}
              isVendor={isVendor}
              isVendorPage={isVendorPage}
              onLogout={handleLogout}
            />
          </div>

          {/* Mobile Nav */}
          <div className="md:hidden ml-auto">
            <MobileNav
              navLinks={navLinks}
              user={user}
              isVendor={isVendor}
              isVendorPage={isVendorPage}
              onLogout={handleLogout}
              cartCount={totalQuantity}
            />
          </div>
        </div>
      </div>

      {/* ── Row 2: Full-Width Search Bar ── */}
      <div className="border-t border-border/50 bg-background px-3 sm:px-4 py-2">
        <div className="container mx-auto">
          <form onSubmit={handleSearch} className="w-full">
            <div className="flex items-center gap-2 bg-muted rounded-full px-3 sm:px-4 py-1.5 sm:py-2 border border-border focus-within:border-primary/40 focus-within:shadow-sm transition-all">
              <Search size={16} strokeWidth={1.5} className=" text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Search shoes, phones, fashion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground h-7 w-7 flex items-center justify-center rounded-full transition-colors"
                aria-label="Search"
              >
                <Search size={14} strokeWidth={1.5}  />
              </button>
            </div>
          </form>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
