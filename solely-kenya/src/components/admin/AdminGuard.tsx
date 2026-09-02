import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SneakerLoader } from "@/components/ui/SneakerLoader";

/**
 * Route-level guard for every /admin* page. Wraps the page component from above
 * (at the route-definition call site) so a non-admin's browser never mounts the
 * page - and never fires its data-fetching effects - in the first place.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, rolesReady } = useAuth();
  const navigate = useNavigate();

  const ready = !loading && rolesReady;

  useEffect(() => {
    if (ready && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [ready, user, isAdmin, navigate]);

  if (!ready || !user || !isAdmin) {
    return <SneakerLoader message="Loading admin dashboard..." />;
  }

  return <>{children}</>;
}
