import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link2, Copy, Trash2, Plus, CheckCircle, Share2, EyeOff, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";

const VendorPaymentLinks = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Link State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [linkType, setLinkType] = useState<"product" | "custom">("product");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLinks();
      fetchProducts();
    }
  }, [user]);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from("payment_links")
      .select(`*, product:product_id(name, price_ksh, images)`)
      .eq("vendor_id", user?.id)
      .order("created_at", { ascending: false });

    if (!error && data) setLinks(data);
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price_ksh, stock")
      .eq("vendor_id", user?.id)
      .eq("status", "active")
      .gt("stock", 0)
      .order("created_at", { ascending: false });
    
    if (data) setProducts(data);
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (linkType === "custom" && (!customTitle || !customPrice)) {
      toast.error("Please enter a title and price for the custom link");
      return;
    }
    
    if (linkType === "product" && !selectedProductId) {
      toast.error("Please select a product");
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        vendor_id: user.id,
        delivery_fee_ksh: deliveryFee ? parseFloat(deliveryFee) : 0,
        is_active: true,
      };

      if (linkType === "product") {
        payload.product_id = selectedProductId;
      } else {
        payload.custom_title = customTitle;
        payload.custom_price_ksh = parseFloat(customPrice);
      }

      const { error } = await supabase.from("payment_links").insert(payload);

      if (error) throw error;
      
      toast.success("Payment link generated!");
      setIsDialogOpen(false);
      resetForm();
      fetchLinks();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setLinkType("product");
    setSelectedProductId("");
    setCustomTitle("");
    setCustomPrice("");
    setDeliveryFee("");
  };

  const toggleLinkStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("payment_links")
      .update({ is_active: !currentStatus })
      .eq("id", id);
      
    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Link ${!currentStatus ? 'activated' : 'deactivated'}`);
      setLinks(links.map(l => l.id === id ? { ...l, is_active: !currentStatus } : l));
    }
  };

  const copyToClipboard = (id: string) => {
    const url = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link copied!");
  };

  const shareToWhatsApp = (link: any) => {
    const url = `${window.location.origin}/pay/${link.id}`;
    const title = link.product_id ? link.product?.name : link.custom_title;
    const price = link.product_id ? link.product?.price_ksh : link.custom_price_ksh;
    
    const msg = encodeURIComponent(
      `Hey! Here is the secure payment link for *${title}* (KES ${price.toLocaleString()}) 🛍️\n\nYour payment will be held securely in Sole-ly Escrow until you confirm delivery 🔒\n\nPay here: 👉 ${url}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-muted/30 overflow-x-hidden">
      <SEO title="Payment Links - Vendor Dashboard" />
      <VendorNavbar />
      
      <div className="flex">
        <VendorSidebar />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Secure Payment Links</h1>
              <p className="text-sm text-muted-foreground mt-1">Generate trust-building checkout links for your Instagram or WhatsApp buyers.</p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus size={16} /> New Payment Link
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create Payment Link</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateLink} className="space-y-4 pt-4">
                  
                  <div className="space-y-2">
                    <Label>Link Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        type="button" 
                        variant={linkType === "product" ? "default" : "outline"} 
                        onClick={() => setLinkType("product")}
                        className="w-full"
                      >
                        <Package size={14} className="mr-2" /> Existing Product
                      </Button>
                      <Button 
                        type="button" 
                        variant={linkType === "custom" ? "default" : "outline"} 
                        onClick={() => setLinkType("custom")}
                        className="w-full"
                      >
                        <Tag size={14} className="mr-2" /> Custom Item
                      </Button>
                    </div>
                  </div>

                  {linkType === "product" ? (
                    <div className="space-y-2">
                      <Label>Select Product</Label>
                      <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an active product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} (KES {p.price_ksh})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Item Title</Label>
                        <Input 
                          placeholder="e.g., Custom Nike Air Force 1" 
                          value={customTitle} 
                          onChange={(e) => setCustomTitle(e.target.value)} 
                          required={linkType === "custom"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Price (KES)</Label>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="e.g., 5000" 
                          value={customPrice} 
                          onChange={(e) => setCustomPrice(e.target.value)} 
                          required={linkType === "custom"}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Delivery Fee (Optional)</Label>
                    <Input 
                      type="number" 
                      min="0" 
                      placeholder="e.g., 300" 
                      value={deliveryFee} 
                      onChange={(e) => setDeliveryFee(e.target.value)} 
                    />
                    <p className="text-[11px] text-muted-foreground">Leave blank if free delivery or if the buyer pays the rider directly.</p>
                  </div>

                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? "Generating..." : "Generate Secure Link"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Item</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Total (KES)</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs">Status</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground uppercase tracking-wider text-xs text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading links...</td></tr>
                  ) : links.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Link2 className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-muted-foreground">You haven't generated any secure links yet.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    links.map((link) => {
                      const isProduct = !!link.product_id;
                      const title = isProduct ? link.product?.name : link.custom_title;
                      const price = isProduct ? link.product?.price_ksh : link.custom_price_ksh;
                      const total = price + (link.delivery_fee_ksh || 0);

                      return (
                        <tr key={link.id} className={`hover:bg-muted/30 transition-colors ${!link.is_active ? 'opacity-60' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-foreground">{title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {isProduct ? "Product Link" : "Custom Link"} 
                              {link.delivery_fee_ksh > 0 && ` • +KES ${link.delivery_fee_ksh} Delivery`}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold">
                            {total.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${link.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                              {link.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => copyToClipboard(link.id)}
                                disabled={!link.is_active}
                              >
                                {copiedId === link.id ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                <span className="sr-only sm:not-sr-only sm:ml-2">Copy</span>
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 border-transparent"
                                onClick={() => shareToWhatsApp(link)}
                                disabled={!link.is_active}
                              >
                                <Share2 size={14} />
                                <span className="sr-only sm:not-sr-only sm:ml-2">WhatsApp</span>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={link.is_active ? "text-muted-foreground hover:text-destructive" : "text-emerald-600 hover:text-emerald-700"}
                                onClick={() => toggleLinkStatus(link.id, link.is_active)}
                                title={link.is_active ? "Deactivate Link" : "Activate Link"}
                              >
                                {link.is_active ? <EyeOff size={16} /> : <CheckCircle size={16} />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default VendorPaymentLinks;
