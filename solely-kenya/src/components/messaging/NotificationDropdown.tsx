import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Bell, LayoutDashboard, Package, PlusCircle, CreditCard, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const NotificationDropdown = () => {
  const navigate = useNavigate();
  const supportEmail = "contact@solelymarketplace.com";

  const openSupport = () => {
    window.location.href = `mailto:${supportEmail}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={20} strokeWidth={1.5}  />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="border-b px-3 py-2">
          <h3 className="font-semibold text-sm">Quick Actions</h3>
          <p className="text-xs text-muted-foreground">Jump to key vendor tools.</p>
        </div>
        <div className="py-2">
          <DropdownMenuItem className="gap-2" onClick={() => navigate('/vendor/dashboard')}>
            <LayoutDashboard size={16} strokeWidth={1.5} className=" text-primary" />
            <span className="text-sm">Vendor Dashboard</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => navigate('/vendor/products')}>
            <Package size={16} strokeWidth={1.5} className=" text-primary" />
            <span className="text-sm">Manage Products</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => navigate('/vendor/add-product')}>
            <PlusCircle size={16} strokeWidth={1.5} className=" text-primary" />
            <span className="text-sm">Add New Product</span>
          </DropdownMenuItem>
          {null}
          <DropdownMenuItem className="gap-2" onClick={openSupport}>
            <Mail size={16} strokeWidth={1.5} className=" text-primary" />
            <div className="flex flex-col">
              <span className="text-sm">Contact Support</span>
              <span className="text-xs text-muted-foreground">Email {supportEmail}</span>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
