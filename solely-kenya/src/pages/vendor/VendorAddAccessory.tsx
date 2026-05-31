import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { toast } from "sonner";
import { ACCESSORY_TYPES } from "@/lib/accessoryTypes";

const VendorAddAccessory = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price_ksh: "",
        stock: "",
        brand: "",
        accessory_type: "",
        condition: "new",
        condition_notes: "",
        free_delivery: false,
    });
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreview, setImagePreview] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            navigate("/auth");
        }
    }, [user, loading, navigate]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + imageFiles.length > 4) {
            toast.error("Maximum 4 images allowed");
            return;
        }

        setImageFiles([...imageFiles, ...files]);

        // Create preview URLs
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setImagePreview([...imagePreview, ...newPreviews]);
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
            // Upload images
            const imageUrls = await uploadImages();

            const safeCondition = formData.condition === "thrifted" ? "good" : formData.condition;

            const { error } = await supabase.from("products").insert({
                vendor_id: user?.id,
                name: formData.name,
                description: formData.description,
                price_ksh: parseInt(formData.price_ksh),
                stock: parseInt(formData.stock),
                brand: formData.brand || null,
                category: "accessories", // Always set to accessories
                accessory_type: formData.accessory_type,
                status: "active",
                images: imageUrls,
                condition: safeCondition,
                condition_notes: formData.condition_notes || null,
                free_delivery: formData.free_delivery,
            });

            if (error) throw error;

            toast.success("Accessory is now live on the marketplace!");
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
                    <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Add Shoe Accessory</h1>

                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Accessory Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Accessory Type */}
                                <div>
                                    <Label htmlFor="accessory_type">Accessory Type *</Label>
                                    <Select
                                        value={formData.accessory_type}
                                        onValueChange={(value) => setFormData({ ...formData, accessory_type: value })}
                                        required
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select accessory type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ACCESSORY_TYPES.map((type) => (
                                                <SelectItem key={type.key} value={type.key}>
                                                    {type.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Product Name */}
                                <div>
                                    <Label htmlFor="name">Product Name</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Premium Suede Brush, Professional Polish"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Give your product a descriptive name to stand out
                                    </p>
                                </div>

                                {/* Description */}
                                <div>
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        placeholder="Describe the product features, materials, and benefits..."
                                    />
                                </div>

                                {/* Price and Stock */}
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

                                {/* Brand */}
                                <div>
                                    <Label htmlFor="brand">Brand (Optional)</Label>
                                    <Input
                                        id="brand"
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        placeholder="e.g., Kiwi, Jason Markk, Angelus"
                                    />
                                </div>

                                {/* Condition */}
                                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                                    <div>
                                        <Label htmlFor="condition" className="text-base font-medium">Product Condition *</Label>
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
                                                        New - Brand new, unused
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="thrifted">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                                        Thrifted - Pre-owned / Used
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {formData.condition !== "new" && (
                                        <div>
                                            <Label htmlFor="condition_notes">Condition Details (Optional)</Label>
                                            <Textarea
                                                id="condition_notes"
                                                placeholder="Describe the condition, any wear, or remaining quantity..."
                                                value={formData.condition_notes}
                                                onChange={(e) => setFormData({ ...formData, condition_notes: e.target.value })}
                                                rows={2}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Images */}
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
                                        📸 <strong>Tip:</strong> Clear photos showing the product packaging and details attract more buyers!
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

                                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                                    <p className="text-sm text-green-800">
                                        ✅ Your accessory will go <strong>live immediately</strong> after submission! Make sure your details and images are accurate.
                                    </p>
                                </div>

                                <Button type="submit" className="w-full" disabled={submitting || uploading}>
                                    {uploading ? "Uploading Images..." : submitting ? "Adding Accessory..." : "Add Accessory"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    );
};

export default VendorAddAccessory;
