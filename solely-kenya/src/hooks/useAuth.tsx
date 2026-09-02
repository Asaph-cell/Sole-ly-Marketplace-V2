import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVendor, setIsVendor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // False until checkUserRoles has resolved for the current session (or there's no
  // user to check). loading turning false does NOT mean isAdmin/isVendor are final -
  // the roles query runs separately/later, so anything gating on isAdmin must wait
  // for rolesReady too, or it'll bounce real admins/vendors during that window.
  const [rolesReady, setRolesReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Check roles when user changes
        if (session?.user) {
          setRolesReady(false);
          setTimeout(() => {
            checkUserRoles(session.user.id);
          }, 0);
        } else {
          setIsVendor(false);
          setIsAdmin(false);
          setRolesReady(true);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        checkUserRoles(session.user.id);
      } else {
        setRolesReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Error checking roles:", error);
        // Set defaults on error
        setIsVendor(false);
        setIsAdmin(false);
        return;
      }

      if (data) {
        setIsVendor(data.some(r => r.role === "vendor"));
        setIsAdmin(data.some(r => r.role === "admin"));
      } else {
        setIsVendor(false);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error checking roles:", error);
      // Set defaults on error
      setIsVendor(false);
      setIsAdmin(false);
    } finally {
      setRolesReady(true);
    }
  };

  const signOut = async () => {
    try {
      // Reset state immediately
      setIsVendor(false);
      setIsAdmin(false);
      setUser(null);
      setSession(null);
      
      // Clear all storage
      localStorage.removeItem("solely_cart_v1");
      sessionStorage.clear();
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Logout failed:", error.message);
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Try multiple redirect methods to bypass extension blocking
      try {
        window.location.replace("/auth");
      } catch (e) {
        // Fallback 1: Use href
        try {
          window.location.href = "/auth";
        } catch (e2) {
          // Fallback 2: Use assign
          window.location.assign("/auth");
        }
      }
    }
  };

  return { user, session, loading, signOut, isVendor, isAdmin, rolesReady };
};
