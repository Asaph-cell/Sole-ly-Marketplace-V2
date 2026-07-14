import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchBar, ActionButton, StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { Package, Image as ImageIcon, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  status: string;
  images: string[] | null;
  price_ksh?: number;
  vendor_id?: string;
  vendor?: { full_name: string; store_name: string } | null;
  created_at: string;
}

const AdminProducts = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (data) {
        setIsAdmin(true);
        loadProducts();
      }
    };
    if (!loading) checkAdmin();
  }, [user, loading]);

  const loadProducts = async () => {
    setLoadingData(true);
    try {
      const { data: productsData, error } = await supabase
        .from("products")
        .select(`id, name, status, images, price_ksh, created_at, vendor_id`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const vendorIds = [...new Set((productsData || []).map(p => p.vendor_id).filter(Boolean))];
      
      const profilesMap: Record<string, any> = {};
      
      if (vendorIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, store_name")
          .in("id", vendorIds);
          
        if (!profilesError && profiles) {
          profiles.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }
      
      const mappedProducts = (productsData || []).map(p => ({
        ...p,
        vendor: p.vendor_id ? profilesMap[p.vendor_id] : null
      }));

      setProducts(mappedProducts as Product[]);
    } catch (error) {
      console.error("Error loading products:", error);
      toast({ title: "Error", description: "Failed to load products", variant: "destructive" });
    } finally {
      setLoadingData(false);
    }
  };

  /** Call the admin-action Edge Function (bypasses RLS via service role) */
  const adminAction = async (action: string, targetId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-action", {
        body: { action, targetId },
      });

      if (error) {
        // Try to extract a readable message from the edge function error
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

  const toggleProductStatus = async (productId: string, currentStatus: string) => {
    const action = currentStatus === "active" ? "pause_product" : "restore_product";
    const ok = await adminAction(action, productId);
    if (ok) loadProducts();
  };

  const deleteProduct = async () => {
    if (!productToDelete) return;
    const ok = await adminAction("delete_product", productToDelete.id);
    if (ok) loadProducts();
    setProductToDelete(null);
  };

  const filteredProducts = products
    .filter(p => productSearch === "" || p.name?.toLowerCase().includes(productSearch.toLowerCase()));

  const formatCurrency = (val: number) => `KES ${val.toLocaleString()}`;

  if (loading || (!isAdmin && !loadingData)) return <SneakerLoader message="Loading products..." />;

  return (
    <AdminLayout pageTitle="Products">
      <SearchBar 
        placeholder="Search listings..." 
        value={productSearch}
        onChange={(e) => setProductSearch(e.target.value)}
      />

      {loadingData ? (
        <SneakerLoader message="Loading..." fullScreen={false} />
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState 
            icon={Package}
            title="No products listed"
            subtitle="Active listings will appear here"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {filteredProducts.map((product) => (
            <div key={product.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
              
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded-lg border border-border bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={16} className="text-muted-foreground" />
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {product.name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[11px] text-muted-foreground truncate">
                    {product.vendor?.store_name || product.vendor?.full_name || "Unknown Vendor"} · {formatCurrency(product.price_ksh || 0)}
                  </p>
                  {product.vendor_id && (
                    <Link
                      to={`/vendor-store/${product.vendor_id}`}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5 ml-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={9} />
                      Store
                    </Link>
                  )}
                </div>
                <div className="mt-1">
                  <StatusPill status={product.status === 'draft' ? 'paused' : product.status} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                {product.status !== "paused" && product.status !== "draft" ? (
                  <ActionButton 
                    label="Pause"
                    onClick={() => toggleProductStatus(product.id, product.status)}
                  />
                ) : (
                  <ActionButton 
                    label="Restore"
                    onClick={() => toggleProductStatus(product.id, product.status)}
                  />
                )}
                <ActionButton
                  label="Delete"
                  variant="danger"
                  onClick={() => setProductToDelete(product)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The product "{productToDelete?.name}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={deleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminProducts;
