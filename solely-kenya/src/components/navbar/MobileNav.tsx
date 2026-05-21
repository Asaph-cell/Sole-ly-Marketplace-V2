import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Mail, LogOut, LayoutDashboard, Menu, ShoppingBag,
  ShoppingCart, Download, Home, Info, HelpCircle, Tag, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface NavLink {
  name: string;
  path: string;
}

interface MobileNavProps {
  navLinks: NavLink[];
  user: any;
  isVendor: boolean;
  isVendorPage: boolean;
  onLogout: () => void | Promise<void>;
  cartCount?: number;
}

// Icon map for nav links
const NAV_ICONS: Record<string, React.ElementType> = {
  "/shop":          ShoppingBag,
  "/how-it-works":  HelpCircle,
  "/vendor":        Tag,
  "/about":         Info,
};

export const MobileNav = ({
  navLinks, user, isVendor, isVendorPage, onLogout, cartCount = 0,
}: MobileNavProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const supportEmail = "contact@solelyshoes.co.ke";
  const { canInstall, promptInstall } = usePWAInstall();
  const location = useLocation();

  const close = () => setIsOpen(false);

  const handleInstallClick = async () => {
    const installed = await promptInstall();
    if (installed) close();
  };

  const handleLogoutClick = async () => {
    close();
    await onLogout();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Menu className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-0.5">
              {cartCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[280px] p-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-foreground">SOLE.<span className="text-primary">ly</span></span>
            {user ? (
              <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">{user.email}</span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Kenya's Trusted Marketplace</span>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto py-2">

          {/* Main nav links */}
          <nav className="px-2">
            {navLinks.map((link) => {
              const Icon = NAV_ICONS[link.path] ?? Home;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={close}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors group
                    ${isActive(link.path)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                    }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive(link.path) ? "text-primary" : "text-muted-foreground"}`} />
                  {link.name}
                  <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </Link>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-border" />

          {/* Cart */}
          <div className="px-2">
            <Link
              to="/cart"
              onClick={close}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ShoppingCart className="h-4 w-4 shrink-0 text-muted-foreground" />
              Cart
              {cartCount > 0 ? (
                <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-2 py-0.5">
                  {cartCount}
                </span>
              ) : (
                <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50" />
              )}
            </Link>
          </div>

          {/* Install App */}
          {canInstall && (
            <div className="px-4 mt-1">
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-primary/10 to-amber-400/10 text-primary border border-primary/20 hover:bg-primary/10 transition-colors"
              >
                <Download className="h-4 w-4 shrink-0" />
                Install App
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="mx-4 my-2 border-t border-border" />

          {/* Auth-aware section */}
          <div className="px-2 space-y-0.5">
            {!user ? (
              <>
                <Link
                  to={`/auth?redirect=${location.pathname}`}
                  onClick={close}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Login
                  <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50" />
                </Link>
                <Link
                  to="/auth?redirect=/vendor/register"
                  onClick={close}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                >
                  <Tag className="h-4 w-4 shrink-0" />
                  Become a Vendor
                </Link>
              </>
            ) : isVendor ? (
              isVendorPage ? (
                <>
                  <Link to="/orders" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    My Purchases
                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50" />
                  </Link>
                  <button onClick={handleLogoutClick} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                    <LogOut className="h-4 w-4 shrink-0" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/vendor/dashboard" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <LayoutDashboard className="h-4 w-4 shrink-0 text-muted-foreground" />
                    Dashboard
                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50" />
                  </Link>
                  <Link to="/vendor/orders" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    Vendor Orders
                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50" />
                  </Link>
                  <Link to="/orders" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                    My Purchases
                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50" />
                  </Link>
                  <button onClick={handleLogoutClick} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                    <LogOut className="h-4 w-4 shrink-0" />
                    Logout
                  </button>
                </>
              )
            ) : (
              <>
                <Link to="/orders" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-muted-foreground" />
                  My Orders
                  <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/50" />
                </Link>
                <Link to="/vendor/register" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 transition-colors">
                  <Tag className="h-4 w-4 shrink-0" />
                  Become a Vendor
                </Link>
                <button onClick={handleLogoutClick} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut className="h-4 w-4 shrink-0" />
                  Logout
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border px-4 py-3 bg-muted/30">
          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {supportEmail}
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
};
