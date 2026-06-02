import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { compressImages, getFileSizeMB } from "@/lib/compressImage";
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
import { CATEGORIES, ALL_CATEGORIES, getCategoryName } from "@/lib/categories";

const VendorAddProduct = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_ksh: "",
    stock: "",
    brand: "",
    category: "",
    subcategory: "",
    key_features: "",
    sizes: "",
    colors: "",
    condition: "new",
    condition_notes: "",
    free_delivery: false,
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreview, setImagePreview] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + imageFiles.length > 4) {
      toast.error("Maximum 4 images allowed");
      return;
    }

    // Show compressing indicator for large files
    const hasLargeFiles = files.some(f => f.size > 1024 * 1024);
    if (hasLargeFiles) {
      toast.info("Compressing images for faster upload...");
    }

    try {
      const compressedFiles = await compressImages(files);

      // Log compression results for debugging
      compressedFiles.forEach((compressed, i) => {
        const original = files[i];
        if (compressed.size < original.size) {
          console.log(
            `Image compressed: ${getFileSizeMB(original)}MB → ${getFileSizeMB(compressed)}MB`
          );
        }
      });

      setImageFiles([...imageFiles, ...compressedFiles]);

      // Create preview URLs
      const newPreviews = compressedFiles.map(file => URL.createObjectURL(file));
      setImagePreview([...imagePreview, ...newPreviews]);
    } catch (error) {
      console.error("Image compression failed:", error);
      toast.error("Failed to process images. Please try again.");
    }
  };

  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreview.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreview(newPreviews);
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of imageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}-${Math.random()}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
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

      // Strict Validation for Mandatory Fields
      if (!formData.name.trim()) throw new Error("Product name is required");
      if (!formData.description.trim()) throw new Error("Description is required");
      if (!formData.price_ksh || parseInt(formData.price_ksh) <= 0) throw new Error("Valid price is required");
      if (!formData.stock || parseInt(formData.stock) < 0) throw new Error("Valid stock number is required");
      if (!formData.category) throw new Error("Category is required");

      // Validation: Only require sizes/colors for wearable categories
      const wearableCategories = ["shoes", "womens-fashion", "mens-fashion", "kids", "sports"];
      const needsSizing = wearableCategories.includes(formData.category);
      if (needsSizing) {
        if (sizesArray.length === 0) {
          throw new Error("Please add at least one size for this product");
        }
        if (colorsArray.length === 0) {
          throw new Error("Please add at least one color for this product");
        }
      }

      // Validation: At least one image is required
      if (imageFiles.length === 0) {
        throw new Error("Please upload at least one image of this product");
      }

      // Upload images
      const imageUrls = await uploadImages();

      // Sanitise condition so it always matches the DB constraint
      const conditionMap: Record<string, string> = { thrifted: "good", refurbished: "like_new" };
      const safeCondition = conditionMap[formData.condition] ?? formData.condition;

      // Insert as 'draft' first (RLS policy only allows draft inserts)
      const { data: insertedProduct, error } = await supabase.from("products").insert({
        vendor_id: user?.id,
        name: formData.name,
        description: formData.description,
        price_ksh: parseInt(formData.price_ksh),
        stock: parseInt(formData.stock),
        brand: formData.brand,
        category: formData.category,
        subcategory: formData.subcategory || null,
        key_features: keyFeaturesArray,
        status: "draft",
        sizes: sizesArray,
        colors: colorsArray,
        images: imageUrls,
        video_url: videoUrl,
        condition: safeCondition,
        condition_notes: formData.condition_notes || null,
        free_delivery: formData.free_delivery,
      }).select('id').single();

      if (error) throw error;

      // Now publish it (uses SECURITY DEFINER function to bypass RLS)
      const { error: publishError } = await supabase.rpc('publish_product', {
        product_id_to_publish: insertedProduct.id,
      });

      if (publishError) throw publishError;

      toast.success("Product listed successfully! It is now live on the marketplace.");
      navigate("/vendor/products");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 p-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Add New Product</h1>

          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price (Ksh) *</Label>
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
                    <Label htmlFor="stock">Stock *</Label>
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
                  <Label htmlFor="category">Category / Type *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter(c => c.key !== "accessories").map((cat) => (
                        <SelectItem key={cat.key} value={cat.key}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Subcategory — driven by selected category */}
                {formData.category && (() => {
                  const cat = ALL_CATEGORIES.find(c => c.key === formData.category);
                  if (!cat || cat.subcategories.length === 0) return null;
                  return (
                    <div>
                      <Label htmlFor="subcategory">Subcategory (Optional)</Label>
                      <Select
                        value={formData.subcategory}
                        onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${cat.name} type`} />
                        </SelectTrigger>
                        <SelectContent>
                          {cat.subcategories.map((sub) => (
                            <SelectItem key={sub.key} value={sub.key}>
                              {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })()}

                {/* Condition Selector */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <div>
                    <Label htmlFor="condition" className="text-base font-medium">Item Condition *</Label>
                    <p className="text-sm text-muted-foreground mb-2">Is this new or pre-owned?</p>
                    <Select
                      value={formData.condition}
                      onValueChange={(value) => setFormData({ ...formData, condition: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New - Brand new, unused</SelectItem>
                        {formData.category === "electronics" ? (
                          <SelectItem value="refurbished">Refurbished - Restored to working order</SelectItem>
                        ) : (
                          <SelectItem value="thrifted">Thrifted - Pre-owned / Used</SelectItem>
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
                        Click "Size Guide" above to view the conversion chart.
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
                  <Label htmlFor="images">Product Images (Max 4)</Label>
                  <Input
                    id="images"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    disabled={imageFiles.length >= 4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    📸 <strong>Tip:</strong> High-quality, well-lit photos attract more customers! Upload up to 4 clear images showing different angles.
                  </p>

                  {imagePreview.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {imagePreview.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
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

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✅ Your product will go <strong>live immediately</strong> after submission! Make sure your details and images are accurate to attract more buyers.
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={submitting || uploading}>
                  {uploading ? "Uploading Images..." : submitting ? "Listing Product..." : "List Product"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default VendorAddProduct;
