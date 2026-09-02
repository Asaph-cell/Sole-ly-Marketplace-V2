import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Calls the admin-action edge function (bypasses RLS via service role) and
 * handles the error-parsing + toast boilerplate. Was previously copy-pasted
 * verbatim in AdminVendors.tsx and AdminProducts.tsx.
 */
export function useAdminAction() {
  const { toast } = useToast();

  const adminAction = async (action: string, targetId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-action", {
        body: { action, targetId },
      });

      if (error) {
        let msg = error.message;
        if (error.context && typeof error.context.json === "function") {
          try {
            const errJson = await error.context.json();
            if (errJson?.error) msg = errJson.error;
          } catch (_) { /* ignore */ }
        }
        throw new Error(msg);
      }

      toast({ title: "Success", description: data?.message || "Action completed" });
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return false;
    }
  };

  return { adminAction };
}
