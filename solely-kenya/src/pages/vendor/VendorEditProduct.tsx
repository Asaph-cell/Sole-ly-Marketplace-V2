import { useEffect, useState, useRef } from "react";
import { FormSkeleton } from "@/components/skeletons";
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
import { toast } from "@/lib/toast";
import { ShoeSizeChart } from "@/components/ShoeSizeChart";
import { VideoUploader } from "@/components/VideoUploader";
import { PricingCalculator } from "@/components/vendor/PricingCalculator";
import { AlertTriangle } from "lucide-react";
import { CATEGORIES, ALL_CATEGORIES } from "@/lib/categories";
import { parseSizesInput } from "@/lib/sizes";
import { compressImages } from "@/lib/compressImage";

const VendorEditProduct = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const originalPrice = useRef<number | null>(null); // price when the page loaded
  const [loadingProduct, setLoadingProduct] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price_ksh: "",
    original_price: "",
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
        originalPrice.current = data.price_ksh;
        setFormData({
          name: data.name,
          description: data.description || "",
          price_ksh: data.price_ksh.toString(),
          original_price: data.original_price ? String(data.original_price) : "",
          stock: data.stock.toString(),
          brand: data.brand || "",
          category: data.category || "",
          subcategory: data.subcategory || "",
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

  // The first photo is the cover shown on cards and in search.
  const makeCover = (index: number) => {
    setExistingImages((imgs) => [imgs[index], ...imgs.filter((_, i) => i !== index)]);
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      const compressedFiles = await compressImages(imageFiles);

      for (const file of compressedFiles) {
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
    if (parseInt(formData.price_ksh) > 300000) {
      toast.error("Price cannot exceed KES 300,000.");
      return;
    }
    setSubmitting(true);

    try {
      const sizesArray = parseSizesInput(formData.sizes); // "38-45" becomes 38, 39 … 45
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
          subcategory: formData.subcategory || null,
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

      // Saved on its own so the edit still goes through if the column isn't deployed yet.
      const wasPrice = parseInt(formData.original_price);
      await supabase
        .from("products")
        .update({ original_price: wasPrice > parseInt(formData.price_ksh) ? wasPrice : null } as any)
        .eq("id", id)
        .eq("vendor_id", user?.id);

      // Price went down: let buyers with a price alert know (runs in the background).
      if (originalPrice.current != null && parseInt(formData.price_ksh) < originalPrice.current) {
        supabase.functions.invoke("notify-price-drop", { body: { productId: id } }).catch(() => {});
      }

      toast.success("Changes saved", { description: "Your listing is updated in the shop." });
      navigate("/vendor/products");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadingProduct) {
    return <FormSkeleton fields={7} />;
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
                    {parseInt(formData.price_ksh) > 300000 && (
                      <p className="text-xs text-destructive font-medium mt-1">Maximum allowed price is 300,000.</p>
                    )}
                    <div className="mt-3">
                      <Label htmlFor="original_price">Was price (Ksh, optional)</Label>
                      <Input
                        id="original_price"
                        type="number"
                        placeholder="Old price, shown struck through"
                        value={formData.original_price}
                        onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                      />
                      {formData.original_price && !(parseInt(formData.original_price) > parseInt(formData.price_ksh)) && (
                        <p className="text-xs text-destructive font-medium mt-1">The old price must be higher than the price. It won't be shown.</p>
                      )}
                    </div>
                    <PricingCalculator price={parseFloat(formData.price_ksh)} />
                  </div>

                  <div className="flex flex-col justify-center space-y-2 border rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="free_delivery"
                        checked={formData.free_delivery}
                        onChange={(e) => setFormData({ ...formData, free_delivery: e.target.checked })}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <Label htmlFor="free_delivery" className="font-medium cursor-pointer">Offers Free Delivery</Label>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Check this if you are covering the delivery cost for the buyer.
                    </p>
                    {formData.free_delivery && (
                      <p className="text-xs text-primary-strong ml-6 mt-1">
                        By marking free delivery, you commit to delivering this product at no extra cost. You cannot charge a delivery fee after a buyer purchases this item.
                      </p>
                    )}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value, subcategory: "" })}
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

                  <div>
                    <Label htmlFor="subcategory">Subcategory (Optional)</Label>
                    <Select
                      value={formData.subcategory}
                      onValueChange={(value) => setFormData({ ...formData, subcategory: value })}
                      disabled={!formData.category}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=" ">None</SelectItem>
                        {ALL_CATEGORIES.find(c => c.key === formData.category)?.subcategories.map((sub) => (
                          <SelectItem key={sub.key} value={sub.key}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Condition Selector, options change based on category */}
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
                        <SelectItem value="new">Brand New</SelectItem>
                        {formData.category === "electronics" || formData.category === "phones" ? (
                          <SelectItem value="refurbished">Refurbished</SelectItem>
                        ) : (
                          <SelectItem value="thrifted">Thrifted</SelectItem>
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
                        : "Available Sizes (EU, comma-separated)"}
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
                    <Alert className="bg-primary-soft border-primary/30">
                      <AlertTriangle size={16} strokeWidth={1.5} className=" text-primary-strong" />
                      <AlertDescription className="text-primary-strong text-sm">
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        {existingImages.map((url, index) => (
                          <div key={url + index} className="relative">
                            <img
                              src={url}
                              alt={`Product ${index + 1}`}
                              className="w-full h-28 object-cover rounded-lg bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => removeExistingImage(index)}
                              aria-label={`Remove photo ${index + 1}`}
                              className="absolute top-1.5 right-1.5 h-7 w-7 flex items-center justify-center bg-destructive text-destructive-foreground rounded-full text-base leading-none shadow"
                            >
                              ×
                            </button>
                            {index === 0 ? (
                              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => makeCover(index)}
                                className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-foreground shadow"
                              >
                                Make cover
                              </button>
                            )}
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
                    Up to 4 photos in total. Remove one with × to add another.
                  </p>

                  {imagePreview.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2 mt-4">New Images</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {imagePreview.map((preview, index) => (
                          <div key={index} className="relative">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-28 object-cover rounded-lg bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => removeNewImage(index)}
                              aria-label={`Remove new photo ${index + 1}`}
                              className="absolute top-1.5 right-1.5 h-7 w-7 flex items-center justify-center bg-destructive text-destructive-foreground rounded-full text-base leading-none shadow"
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
