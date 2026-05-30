import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { ShoeSizeSelector } from "@/components/ShoeSizeSelector";
import { AlertTriangle, ExternalLink, Store } from "lucide-react";
import { CartSuggestions } from "@/components/CartSuggestions";

const Cart = () => {
  const { items, updateQuantity, updateSize, removeItem, clearCart, getInvalidSizeItems } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [vendorProfiles, setVendorProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchVendors = async () => {
      const vendorIds = [...new Set(items.map(i => i.vendorId))];
      if (vendorIds.length === 0) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('id, store_name')
        .in('id', vendorIds);
        
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(p => map[p.id] = p);
        setVendorProfiles(map);
      }
    };
    fetchVendors();
  }, [items]);

  const deliveryEstimate = useMemo(() => {
    if (items.length === 0) return null;
    return `Estimated delivery 2-5 business days once vendor ships`;
  }, [items.length]);

  const groupedItems = useMemo(() => {
    return items.reduce((acc, item) => {
      if (!acc[item.vendorId]) {
        acc[item.vendorId] = [];
      }
      acc[item.vendorId].push(item);
      return acc;
    }, {} as Record<string, typeof items>);
  }, [items]);

  const handleCheckout = (vendorId: string) => {
    const vendorItems = groupedItems[vendorId];
    if (!vendorItems || vendorItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    const missingSizes = vendorItems.some(
      (item) => item.availableSizes && item.availableSizes.length > 0 && !item.size
    );

    if (missingSizes) {
      toast.error("Please select a shoe size for all items before checkout");
      return;
    }

    const missingColors = vendorItems.some(
      (item) => item.availableColors && item.availableColors.length > 0 && !item.color
    );

    if (missingColors) {
      toast.error("Please select a color for all items before checkout");
      return;
    }

    const invalidItems = getInvalidSizeItems().filter(i => i.vendorId === vendorId);
    if (invalidItems.length > 0) {
      toast.error(`Size ${invalidItems[0].size} is not available for ${invalidItems[0].name}. Please select an available size or check other shops.`);
      return;
    }

    if (!authLoading && !user) {
      toast.info("Please sign in to proceed to checkout");
      navigate(`/auth?redirect=/checkout?vendorId=${vendorId}`);
      return;
    }

    navigate(`/checkout?vendorId=${vendorId}`);
  };

  const cartProductIds = useMemo(() => [...new Set(items.map(i => i.productId))], [items]);

  return (
    <div className="min-h-screen bg-muted/20 overflow-x-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Shopping Cart</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Secure payments, escrow protection, trusted vendors.</p>
          </div>
          {items.length > 0 && (
            <Button variant="ghost" onClick={clearCart} className="text-sm min-h-[44px]">Clear Cart</Button>
          )}
        </div>

        {items.length === 0 ? (
          <Card className="p-6 sm:p-10 text-center">
            <CardTitle className="mb-3 sm:mb-4 text-lg sm:text-xl">Your cart is empty</CardTitle>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Browse the marketplace and add your next pair of kicks.</p>
            <Button asChild className="min-h-[48px] tap-active">
              <Link to="/shop">Continue shopping</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([vendorId, vendorItems]) => {
              const vendorName = vendorProfiles[vendorId]?.store_name || `Vendor #${vendorId.slice(0, 6)}`;
              const vendorSubtotal = vendorItems.reduce((sum, item) => sum + item.quantity * item.priceKsh, 0);
              const vendorQuantity = vendorItems.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div key={vendorId} className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Store size={20} strokeWidth={1.5} className=" text-primary" />
                      <h2 className="text-lg font-semibold">{vendorName}</h2>
                    </div>
                    {vendorItems.map((item) => (
                      <Card key={`${item.productId}-${item.size}-${item.color}`}>
                        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4">
                          <div className="w-24 h-24 rounded-lg border overflow-hidden flex-shrink-0">
                            <img
                              src={item.imageUrl || "/placeholder.svg"}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="text-lg font-semibold">{item.name}</h3>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">KES {(item.priceKsh * item.quantity).toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">KES {item.priceKsh.toLocaleString()} each</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">Quantity</span>
                                <Input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={item.quantity}
                                  onChange={(event) => updateQuantity(item.productId, Number(event.target.value), item.size, item.color)}
                                  className="w-20"
                                />
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => removeItem(item.productId, item.size, item.color)}>
                                Remove
                              </Button>
                            </div>
                            <div className="pt-2 border-t space-y-2">
                              {item.availableSizes && item.availableSizes.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">Available sizes: </span>
                                  {item.availableSizes.join(", ")}
                                </div>
                              )}
                              {item.color && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span className="font-medium">Color: </span>
                                  {item.color}
                                </div>
                              )}
                              {!item.color && item.availableColors && item.availableColors.length > 0 && (
                                <p className="text-xs text-destructive mt-1">⚠️ Color required before checkout</p>
                              )}
                              <ShoeSizeSelector
                                selectedSize={item.size}
                                onSizeChange={(size) => updateSize(item.productId, size, item.size, item.color)}
                              />
                              {!item.size && item.availableSizes && item.availableSizes.length > 0 && (
                                <p className="text-xs text-destructive">⚠️ Size required for shoes before checkout</p>
                              )}
                              {item.size && item.availableSizes && item.availableSizes.length > 0 && !item.availableSizes.includes(item.size) && (
                                <Alert variant="destructive" className="py-2 px-3">
                                  <AlertTriangle size={16} strokeWidth={1.5}  />
                                  <AlertTitle className="text-sm font-medium">Size {item.size} not available</AlertTitle>
                                  <AlertDescription className="text-xs space-y-2">
                                    <p>This shoe is not available in size {item.size}.</p>
                                    <p><strong>Available sizes:</strong> {item.availableSizes.join(", ")}</p>
                                    <Link
                                      to={`/shop?size=${item.size}`}
                                      className="inline-flex items-center gap-1 text-primary-foreground underline hover:no-underline font-medium"
                                    >
                                      Find size {item.size} in other shops <ExternalLink strokeWidth={1.5} className="h-3 w-3" />
                                    </Link>
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="space-y-4 pt-10 lg:pt-11">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Checkout from {vendorName}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span>Items ({vendorQuantity})</span>
                          <span>KES {vendorSubtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Platform fee</span>
                          <span>KES 0</span>
                        </div>
                        <div className="pt-4 border-t flex items-center justify-between">
                          <span className="text-base font-semibold">Subtotal</span>
                          <span className="text-xl font-bold">KES {vendorSubtotal.toLocaleString()}</span>
                        </div>
                        {deliveryEstimate && (
                          <Badge variant="outline" className="w-full justify-center py-2 text-center text-xs">
                            {deliveryEstimate}
                          </Badge>
                        )}
                        <Button className="w-full min-h-[48px] tap-active" onClick={() => handleCheckout(vendorId)}>
                          Checkout this Vendor
                        </Button>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Buyer Protection</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-2 pb-4">
                        <p>Every payment is held securely by Solely until you confirm delivery.</p>
                        <p>Full refunds on fraud, wrong or damaged deliveries.</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && <CartSuggestions cartProductIds={cartProductIds} />}
      </div>
    </div>
  );
};

export default Cart;
