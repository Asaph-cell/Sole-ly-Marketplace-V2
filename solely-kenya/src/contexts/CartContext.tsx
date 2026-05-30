import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type CartItem = {
  productId: string;
  vendorId: string;
  name: string;
  priceKsh: number;
  imageUrl?: string | null;
  quantity: number;
  size?: string; // Selected shoe size (EU format)
  availableSizes?: string[]; // Sizes available for this product
  color?: string; // Selected product color
  availableColors?: string[]; // Colors available for this product
};

interface CartContextValue {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string, size?: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, size?: string, color?: string) => void;
  updateSize: (productId: string, newSize: string, oldSize?: string, color?: string) => void;
  updateColor: (productId: string, newColor: string, size?: string, oldColor?: string) => void;
  clearCart: () => void;
  removeItemsByVendor: (vendorId: string) => void;
  hasAllSizes: () => boolean; // Check if all items have sizes selected (if required)
  hasAllColors: () => boolean; // Check if all items have colors selected (if required)
  hasAllValidSizes: () => boolean; // Check if all selected sizes are available

  getInvalidSizeItems: () => CartItem[]; // Get items with sizes not in available list
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = "solely_cart_v1";

const loadInitialCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item.productId && item.vendorId && item.priceKsh >= 0);
  } catch (error) {
    console.error("Failed to parse cart from storage", error);
    return [];
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(loadInitialCart);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  /* 
    Helper to generate unique ID for cart items. 
    If you add "Product A" twice with same size/color, it merges.
    If you add "Product A" with different size/color, it's separate.
  */
  const getCartItemId = (item: Partial<CartItem>) => {
    return `${item.productId}-${item.size || 'nosize'}-${item.color || 'nocolor'}`;
  };

  const addItem: CartContextValue["addItem"] = (item, quantity = 1) => {
    setItems((current) => {

      // Check for existing item with SAME variants
      const existingIndex = current.findIndex(
        (c) => c.productId === item.productId && c.size === item.size && c.color === item.color
      );

      if (existingIndex > -1) {
        const newItems = [...current];
        const existingItem = newItems[existingIndex];
        // Calculate new quantity, capped at 10
        newItems[existingIndex] = {
          ...existingItem,
          quantity: Math.min(existingItem.quantity + quantity, 10)
        };
        return newItems;
      }

      // Add new item
      return [...current, { ...item, quantity: Math.max(1, Math.min(quantity, 10)) }];
    });
  };

  /* 
    NOTICE: removeItem, updateQuantity, etc. previously dependent ONLY on productId.
    They must now depend on the specific item variant (size/color).
    HOWEVER, the context interface defined `removeItem: (productId: string) => void`.
    To fix this properly without breaking the interface, we normally change the interface.
    But for now, I will modify the implementation to find the item, 
    but wait... the UI calls these functions. 
    If I change the signature, I must update the UI.

    CURRENT INTERFACE:
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void; 
    
    This interface is fundamentally broken for variants. 
    I MUST update the type definition on lines 22-25 first.
    
    Let's check line 22-25 in the original file. 
    Ah, I can't see lines 22-25 in this replace block, but I know they exist from the view_file.
    
    I will handle the logic update here assuming I will Fix the interface in a separate or larger edit if needed.
    Actually, to be safe and clean, I should simply update the logic to potentially remove ALL variants of that product? 
    No, that's bad UX. "Remove item" usually comes from a specific row in the cart.
    
    Strategy: 
    1. Update the Context Interface to accept `cartItemId` or additional params.
    2. But since I can't change all usages in one go easily (Cart.tsx, Product.tsx), 
       I will cheat slightly for now: 
       If `removeItem` receives a `productId`, it's ambiguous.
       
       ACTUALLY, the best way is to standardise that `removeItem` takes `item: CartItem` or we create a synthetic ID.
       
       Let's look at `Cart.tsx` later. For now, I'll implement the logic using a `cartItemId` notion internal to the item list,
       and I'll have to modify the Interface lines in a second pass if I can't fit it here.
       
       Wait, this tool allows replacing a block. I can replace the interface definition too if it's in range?
       Lines 1-187 cover the whole file. 
       YES. I should update the interface.

       Refactoring Plan:
       1. Change `removeItem` and `updateQuantity` to take `productId`, `size`, `color`? 
          Or simpler: specific unique key?
          Let's stick to passing `item` or `size` and `color` as optional distinguishing params.
          
          Actually, let's keep it simple. `items` in cart page will map to rows. Each row has unique size/color.
          The `CartItem` itself doesn't have a unique ID property.
          
          I will add `removeItem(productId, size, color)` signature.
  */

  const removeItem: CartContextValue["removeItem"] = (productId, size, color) => {
    setItems((current) => current.filter((item) =>
      !(item.productId === productId && item.size === size && item.color === color)
    ));
  };

  const updateQuantity: CartContextValue["updateQuantity"] = (productId, quantity, size, color) => {
    setItems((current) =>
      current.map((item) => {
        if (item.productId === productId && item.size === size && item.color === color) {
          return { ...item, quantity: Math.max(1, Math.min(quantity, 10)) };
        }
        return item;
      }).filter((item) => item.quantity > 0)
    );
  };

  const updateSize: CartContextValue["updateSize"] = (productId, newSize, oldSize, color) => {
    setItems((current) =>
      current.map((item) => {
        // Find specific item to update
        if (item.productId === productId && item.size === oldSize && item.color === color) {
          return { ...item, size: newSize };
        }
        return item;
      })
    );
  };

  const updateColor: CartContextValue["updateColor"] = (productId, newColor, size, oldColor) => {
    setItems((current) =>
      current.map((item) => {
        if (item.productId === productId && item.size === size && item.color === oldColor) {
          return { ...item, color: newColor };
        }
        return item;
      })
    );
  };

  const hasAllSizes = (): boolean => {
    return items.length > 0 && items.every((item) => {
      if (item.availableSizes && item.availableSizes.length > 0) {
        return item.size && item.size.trim() !== "";
      }
      return true;
    });
  };

  const hasAllColors = (): boolean => {
    return items.length > 0 && items.every((item) => {
      if (item.availableColors && item.availableColors.length > 0) {
        return item.color && item.color.trim() !== "";
      }
      return true;
    });
  };

  const hasAllValidSizes = (): boolean => {
    return items.every((item) => {
      if (!item.availableSizes || item.availableSizes.length === 0) return true;
      if (!item.size) return false;
      return item.availableSizes.includes(item.size);
    });
  };

  const getInvalidSizeItems = (): CartItem[] => {
    return items.filter((item) => {
      if (!item.availableSizes || item.availableSizes.length === 0) return false;
      if (!item.size) return false;
      return !item.availableSizes.includes(item.size);
    });
  };

  const clearCart = () => setItems([]);

  const removeItemsByVendor: CartContextValue["removeItemsByVendor"] = (vendorId) => {
    setItems((current) => current.filter((item) => item.vendorId !== vendorId));
  };

  const { totalQuantity, subtotal } = useMemo(() => {
    const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.quantity * item.priceKsh, 0);
    return { totalQuantity: quantity, subtotal: total };
  }, [items]);

  const value: CartContextValue = {
    items,
    totalQuantity,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    updateSize,
    clearCart,
    hasAllSizes,
    hasAllColors,
    hasAllValidSizes,
    getInvalidSizeItems,
    updateColor,
    removeItemsByVendor,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};


