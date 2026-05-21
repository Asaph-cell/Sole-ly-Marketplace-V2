import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, LogOut, LayoutDashboard, ShoppingBag } from "lucide-react";

interface AuthButtonsProps {
  user: any;
  isVendor: boolean;
  isVendorPage: boolean;
  onLogout: () => void | Promise<void>;
}

export const AuthButtons = ({ user, isVendor, isVendorPage, onLogout }: AuthButtonsProps) => {
  const supportEmail = "contact@solelyshoes.co.ke";
  const location = useLocation();
  return (
    <>
      <Button variant="outline" size="sm" asChild>
        <a
          href={`mailto:${supportEmail}`}
          className="flex items-center gap-2"
        >
          <Mail className="h-4 w-4" />
          Email Support
        </a>
      </Button>

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
                <ShoppingBag className="h-4 w-4 mr-2" />
                My Purchases
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" asChild>
              <Link to="/vendor/dashboard">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/vendor/orders">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Vendor Orders
              </Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/orders">
                <ShoppingBag className="h-4 w-4 mr-2" />
                My Purchases
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </>
        )
      ) : (
        <>
          <Button size="sm" asChild>
            <Link to="/orders">
              <ShoppingBag className="h-4 w-4 mr-2" />
              My Orders
            </Link>
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/vendor/register">Become a Vendor</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </>
      )}
    </>
  );
};
