import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchBar, ActionButton, StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { Package, Image as ImageIcon } from "lucide-react";
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

interface Product {
  id: string;
  name: string;
  status: string;
  images: string[] | null;
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
        .select(`id, name, status, images, created_at, vendor_id`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const vendorIds = [...new Set((productsData || []).map(p => p.vendor_id).filter(Boolean))];
      
      let profilesMap: Record<string, any> = {};
      
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

  const toggleProductStatus = async (productId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const { error } = await supabase
        .from("products")
        .update({ status: newStatus })
        .eq("id", productId);

      if (error) throw error;

      toast({ title: "Success", description: `Product ${newStatus === "active" ? "activated" : "paused"}` });
      loadProducts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteProduct = async () => {
    if (!productToDelete) return;
    
    try {
      const { error } = await supabase.from("products").delete().eq("id", productToDelete.id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Product removed permanently" });
      loadProducts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProductToDelete(null);
    }
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
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {product.vendor?.store_name || product.vendor?.full_name || "Unknown Vendor"} · {formatCurrency(1500 /* Mock price as it is not selected from table */)}
                </p>
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
