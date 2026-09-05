import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, LogOut, LayoutDashboard, ShoppingBag, Shield } from "lucide-react";

interface AuthButtonsProps {
  user: any;
  isVendor: boolean;
  isAdmin: boolean;
  isVendorPage: boolean;
  onLogout: () => void | Promise<void>;
}

export const AuthButtons = ({ user, isVendor, isAdmin, isVendorPage, onLogout }: AuthButtonsProps) => {
  const supportEmail = "contact@solelymarketplace.com";
  const location = useLocation();
  return (
    <>
      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild title="Email Support">
        <a href={`mailto:${supportEmail}`}>
          <Mail size={16} strokeWidth={1.5}  />
        </a>
      </Button>

      {/* Sits outside the vendor/customer branches below so an admin who is
          not a vendor still gets a way in - until now the only admin link in
          the app lived in the vendor dashboard header. isAdmin defaults to
          false in useAuth and only flips once the roles query returns, so a
          regular user never renders this, not even briefly. */}
      {isAdmin && (
        <Button size="sm" variant="outline" asChild title="Admin dashboard">
          <Link to="/admin">
            <Shield size={16} strokeWidth={1.5} className=" mr-2" />
            Admin
          </Link>
        </Button>
      )}

      {!user ? (
        <>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/auth?redirect=${location.pathname}`}>Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to={`/auth?redirect=/vendor/register`}>Become a Vendor</Link>
          </Button>
        </>
      ) : isVendor ? (
        isVendorPage ? (
          <>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/orders">
                <ShoppingBag size={16} strokeWidth={1.5} className=" mr-2" />
                My Purchases
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onLogout} title="Logout">
              <LogOut size={16} strokeWidth={1.5} />
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" asChild>
              <Link to="/vendor/dashboard">
                <LayoutDashboard size={16} strokeWidth={1.5} className=" mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/vendor/orders">
                <ShoppingBag size={16} strokeWidth={1.5} className=" mr-2" />
                Vendor Orders
              </Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/orders">
                <ShoppingBag size={16} strokeWidth={1.5} className=" mr-2" />
                My Purchases
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onLogout} title="Logout">
              <LogOut size={16} strokeWidth={1.5} />
            </Button>
          </>
        )
      ) : (
        <>
          <Button size="sm" asChild>
            <Link to="/orders">
              <ShoppingBag size={16} strokeWidth={1.5} className=" mr-2" />
              My Orders
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/vendor/register">Become a Vendor</Link>
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={onLogout} title="Logout">
            <LogOut size={16} strokeWidth={1.5} />
          </Button>
        </>
      )}
    </>
  );
};
