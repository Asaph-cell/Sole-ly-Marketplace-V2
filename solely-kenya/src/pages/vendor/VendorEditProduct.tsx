import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ShoeSizeChart } from "@/components/ShoeSizeChart";
import { VideoUploader } from "@/components/VideoUploader";
import { AlertTriangle } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

const VendorEditProduct = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_ksh: "",
    stock: "",
    brand: "",
    category: "",
    key_features: "",
    sizes: "",
    colors: "",
    condition: "new",
    condition_notes: "",
    free_delivery: false,
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && id) {
      loadProduct();
    }
  }, [user, id]);

  const loadProduct = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .eq("vendor_id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name,
          description: data.description || "",
          price_ksh: data.price_ksh.toString(),
          stock: data.stock.toString(),
          brand: data.brand || "",
          category: data.category || "",
          key_features: data.key_features?.join(", ") || "",
          sizes: data.sizes?.join(", ") || "",
          colors: data.colors?.join(", ") || "",
          condition: ["good", "fair"].includes(data.condition) ? "thrifted" : data.condition === "like_new" ? "refurbished" : data.condition || "new",
          condition_notes: data.condition_notes || "",
          free_delivery: data.free_delivery || false,
        });
        setExistingImages(data.images || []);
        setVideoUrl(data.video_url || null);
      }
    } catch (error: any) {
      toast.error("Failed to load product");
      navigate("/vendor/products");
    } finally {
      setLoadingProduct(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = imageFiles.length + existingImages.length;

    if (files.length + totalImages > 4) {
      toast.error("Maximum 4 images allowed");
      return;
    }

    setImageFiles([...imageFiles, ...files]);

    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreview([...imagePreview, ...newPreviews]);
  };

  const removeNewImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreview.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreview(newPreviews);
  };

  const removeExistingImage = (index: number) => {
    const newExisting = existingImages.filter((_, i) => i !== index);
    setExistingImages(newExisting);
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }
      return uploadedUrls;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const sizesArray = formData.sizes.split(",").map((s) => s.trim()).filter(Boolean);
      const colorsArray = formData.colors.split(",").map((c) => c.trim()).filter(Boolean);
      const keyFeaturesArray = formData.key_features.split(",").map((s) => s.trim()).filter(Boolean);

      // Sanitise condition so it always matches the DB constraint
      const conditionMap: Record<string, string> = { thrifted: "good", refurbished: "like_new" };
      const safeCondition = conditionMap[formData.condition] ?? formData.condition;

      const newImageUrls = await uploadImages();
      const allImages = [...existingImages, ...newImageUrls];

      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description,
          price_ksh: parseInt(formData.price_ksh),
          stock: parseInt(formData.stock),
          brand: formData.brand,
          category: formData.category,
          key_features: keyFeaturesArray,
          sizes: sizesArray,
          colors: colorsArray,
          images: allImages,
          video_url: videoUrl,
          condition: safeCondition,
          condition_notes: formData.condition_notes || null,
          free_delivery: formData.free_delivery,
        })
        .eq("id", id)
        .eq("vendor_id", user?.id);

      if (error) throw error;

      toast.success("Product updated successfully!");
      navigate("/vendor/products");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingProduct) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 p-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Edit Product</h1>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price (Ksh)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price_ksh}
                      onChange={(e) => setFormData({ ...formData, price_ksh: e.target.value })}
                      required
                    />
                  </div>

                  <div className="flex flex-col justify-center space-y-2 border rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="free_delivery"
                        checked={formData.free_delivery}
                        onChange={(e) => setFormData({ ...formData, free_delivery: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <Label htmlFor="free_delivery" className="font-medium cursor-pointer">Offers Free Delivery</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Check this if you are covering the delivery cost for the buyer.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="stock">Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.key} value={cat.key}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Condition Selector — options change based on category */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div>
                    <Label htmlFor="condition" className="text-base font-medium">Condition *</Label>
                    <p className="text-sm text-muted-foreground mb-2">Is this new or pre-owned?</p>
                    <Select
                      value={formData.condition}
                      onValueChange={(value) => setFormData({ ...formData, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Brand New — sealed / never used
                          </div>
                        </SelectItem>
                        {formData.category === "electronics" || formData.category === "phones" ? (
                          <SelectItem value="refurbished">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              Refurbished — tested &amp; fully working
                            </div>
                          </SelectItem>
                        ) : (
                          <SelectItem value="thrifted">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                              Thrifted — pre-owned, honestly described
                            </div>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.condition !== "new" && (
                    <div>
                      <Label htmlFor="condition_notes">Condition Details (Optional)</Label>
                      <Textarea
                        id="condition_notes"
                        placeholder="Describe any wear, scuffs, or defects. Be honest - this builds trust with buyers!"
                        value={formData.condition_notes}
                        onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sizes">
                      {formData.category === "electronics" || formData.category === "phones"
                        ? "Available Variants (comma-separated)"
                        : formData.category === "apparel"
                        ? "Available Sizes (e.g. XS, S, M, L, XL)"
                        : formData.category === "beauty" || formData.category === "skincare"
                        ? "Available Sizes / Volumes (comma-separated)"
                        : "Available Sizes (EU — comma-separated)"}
                    </Label>
                    {(formData.category === "shoes" || !formData.category) && <ShoeSizeChart />}
                  </div>
                  <Input
                    id="sizes"
                    placeholder={
                      formData.category === "electronics" || formData.category === "phones"
                        ? "64GB, 128GB, 256GB"
                        : formData.category === "apparel"
                        ? "XS, S, M, L, XL, XXL"
                        : formData.category === "beauty" || formData.category === "skincare"
                        ? "50ml, 100ml, 200g"
                        : "36, 37, 38, 39, 40, 41, 42, 43"
                    }
                    value={formData.sizes}
                    onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                  />
                  {(formData.category === "shoes" || !formData.category) && (
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertTriangle size={16} strokeWidth={1.5} className=" text-amber-600" />
                      <AlertDescription className="text-amber-800 text-sm">
                        <strong>Important:</strong> Enter exact EU sizes from the size chart (e.g., 36, 37, 38).
                        Using correct sizes ensures customers can find their perfect fit.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-3">
                  <Label htmlFor="colors">Available Colors (comma-separated)</Label>
                  <Input
                    id="colors"
                    placeholder={
                      formData.category === "beauty" || formData.category === "skincare"
                        ? "Nude, Pink, Red (or leave blank if none)"
                        : "Black, White, Red, Blue, Brown"
                    }
                    value={formData.colors}
                    onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter all available colors/shades for this product. Buyers will select their preferred color when ordering.
                  </p>
                </div>

                <div>
                  <Label htmlFor="key_features">Key Features (comma-separated)</Label>
                  <Textarea
                    id="key_features"
                    placeholder={
                      formData.category === "electronics" || formData.category === "phones"
                        ? "5G, 120Hz display, 5000mAh battery"
                        : formData.category === "beauty" || formData.category === "skincare"
                        ? "Hydrating, Contains Vitamin C, SPF 50"
                        : "Breathable mesh, Cushioned sole, Water resistant"
                    }
                    value={formData.key_features}
                    onChange={(e) => setFormData({ ...formData, key_features: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Product Images</Label>

                  {existingImages.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Current Images</p>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        {existingImages.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Product ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(index)}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Input
                    id="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    disabled={imageFiles.length + existingImages.length >= 4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload up to 4 photos total ({4 - existingImages.length} remaining)
                  </p>

                  {imagePreview.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2 mt-4">New Images</p>
                      <div className="grid grid-cols-4 gap-2">
                        {imagePreview.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeNewImage(index)}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Video Upload */}
                {user && (
                  <VideoUploader
                    vendorId={user.id}
                    videoUrl={videoUrl}
                    onVideoChange={setVideoUrl}
                  />
                )}

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate("/vendor/products")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting || uploading}>
                    {uploading ? "Uploading Images..." : submitting ? "Updating..." : "Update Product"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default VendorEditProduct;
