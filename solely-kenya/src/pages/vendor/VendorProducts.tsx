import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Trash2, CheckCircle, Package, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { getAccessoryTypeName } from "@/lib/accessoryTypes";

const VendorProducts = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user]);

  const fetchProducts = async () => {
    setProductsLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("vendor_id", user?.id)
      .order("created_at", { ascending: false });

    setProducts(data || []);
    setProductsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product? This cannot be undone.")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete product");
    } else {
      toast.success("Product deleted successfully");
      fetchProducts();
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const { error } = await supabase.rpc("publish_product", {
        product_id_to_publish: id,
      });

      if (error) {
        toast.error(error.message || "Failed to publish product");
      } else {
        toast.success("Product published successfully!");
        fetchProducts();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to publish product");
    }
  };

  // Separate regular products from legacy accessories
  const regularProducts  = products.filter(p => p.category !== "accessories");
  const accessories      = products.filter(p => p.category === "accessories");

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const ProductTable = ({ items, isAccessory = false }: { items: any[]; isAccessory?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product Name</TableHead>
          {isAccessory && <TableHead>Type</TableHead>}
          <TableHead>Price (Ksh)</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {productsLoading ? (
          <TableRow>
            <TableCell colSpan={isAccessory ? 6 : 5} className="text-center py-8">
              Loading products...
            </TableCell>
          </TableRow>
        ) : items.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-medium">{product.name}</TableCell>
            {isAccessory && (
              <TableCell>
                <Badge variant="outline">
                  {getAccessoryTypeName(product.accessory_type || "")}
                </Badge>
              </TableCell>
            )}
            <TableCell>Ksh {product.price_ksh.toLocaleString()}</TableCell>
            <TableCell>{product.stock}</TableCell>
            <TableCell>
              <Badge variant={product.status === "active" ? "default" : "secondary"}>
                {product.status}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                {product.status === "draft" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePublish(product.id)}
                    title="Publish product"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(isAccessory ? `/vendor/edit-accessory/${product.id}` : `/vendor/edit-product/${product.id}`)}
                  title="Edit product"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(product.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {!productsLoading && items.length === 0 && (
          <TableRow>
            <TableCell colSpan={isAccessory ? 6 : 5} className="text-center py-8 text-muted-foreground">
              {isAccessory
                ? "No accessories yet. Add your first accessory to start selling!"
                : "No products yet. Add your first product to start selling!"}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 p-3 sm:p-6 lg:p-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4">My Products</h1>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <Button className="w-full sm:w-auto" onClick={() => navigate("/vendor/add-product")}>
                <Package className="h-4 w-4 mr-2" />
                Add Product
              </Button>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/vendor/add-accessory")}>
                <ShoppingBag className="h-4 w-4 mr-2" />
                Add Accessory
              </Button>
            </div>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="mb-4 sm:mb-6">
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products ({regularProducts.length})
              </TabsTrigger>
              <TabsTrigger value="accessories" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Accessories ({accessories.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products">
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <ProductTable items={regularProducts} />
              </div>
            </TabsContent>

            <TabsContent value="accessories">
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <ProductTable items={accessories} isAccessory />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default VendorProducts;
