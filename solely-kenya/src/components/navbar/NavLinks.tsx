import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavLink {
  name: string;
  path: string;
}

interface NavLinksProps {
  links: NavLink[];
  className?: string;
}

export const NavLinks = ({ links, className = "" }: NavLinksProps) => {
  const location = useLocation();

  return (
    <>
      {links.map((link) => {
        const isActive = location.pathname.startsWith(link.path) && link.path !== "/" || (link.path === "/" && location.pathname === "/");
        return (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              "transition-colors",
              isActive
                ? "text-primary font-semibold border-b-2 border-primary py-4 -mb-[1px]"
                : "text-foreground/70 hover:text-foreground font-medium",
              className
            )}
          >
            {link.name}
          </Link>
        );
      })}
    </>
  );
};
