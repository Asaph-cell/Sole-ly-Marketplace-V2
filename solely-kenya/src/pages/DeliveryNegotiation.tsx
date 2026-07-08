/**
 * DeliveryNegotiation Page
 * 
 * The core negotiation UI — buyer and vendor chat to agree on a delivery fee.
 * Shows delivery details summary + chat thread with structured proposal cards.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin, Send, Check, ArrowRight, Truck, Package,
  MessageCircle, Loader2, RefreshCw, User, Store,
  ShieldCheck, CreditCard,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SneakerLoader } from "@/components/ui/SneakerLoader";

interface DeliveryAgreement {
  id: string;
  product_ids: string[];
  buyer_id: string;
  vendor_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  buyer_address: string;
  buyer_city: string;
  buyer_county: string;
  buyer_gps_lat: number | null;
  buyer_gps_lng: number | null;
  buyer_delivery_notes: string;
  delivery_fee_ksh: number;
  delivery_method: string | null;
  status: string;
  proposed_by: string | null;
  agreed_at: string | null;
  conversation_id: string;
  created_at: string;
}

interface NegMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  message_type: string;
  metadata: any;
  created_at: string;
  is_read: boolean;
}

const DELIVERY_METHODS = [
  "Boda Boda",
  "G4S",
  "Personal Delivery",
  "Matatu/Bus Parcel",
  "Courier Service",
  "Pick Up",
  "Other",
];

const DeliveryNegotiation = () => {
  const [searchParams] = useSearchParams();
  const agreementId = searchParams.get("agreementId");
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { removeItemsByVendor } = useCart();

  const [agreement, setAgreement] = useState<DeliveryAgreement | null>(null);
  const [messages, setMessages] = useState<NegMessage[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [vendorProfile, setVendorProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chat input
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Proposal input
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposedFee, setProposedFee] = useState("");
  const [proposedMethod, setProposedMethod] = useState("");

  // Checkout state
  const [processingCheckout, setProcessingCheckout] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load agreement + messages + products
  useEffect(() => {
    if (!agreementId || authLoading) return;
    if (!user) {
      navigate("/auth?redirect=/delivery-negotiation?agreementId=" + agreementId);
      return;
    }
    loadData();
  }, [agreementId, user, authLoading]);

  // Realtime message subscription
  useEffect(() => {
    if (!agreement?.conversation_id) return;

    const channel = supabase
      .channel(`neg-messages-${agreement.conversation_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${agreement.conversation_id}`,
        },
        (payload) => {
          setMessages(prev => {
            const newMsg = payload.new as NegMessage;
            // Deduplicate: skip if message already exists
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agreement?.conversation_id]);

  // Realtime agreement status subscription
  useEffect(() => {
    if (!agreementId) return;

    const channel = supabase
      .channel(`agreement-${agreementId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_agreements",
          filter: `id=eq.${agreementId}`,
        },
        (payload) => {
          setAgreement(payload.new as DeliveryAgreement);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [agreementId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch agreement
      const { data: agr, error: agrErr } = await supabase
        .from("delivery_agreements")
        .select("*")
        .eq("id", agreementId!)
        .single();
      if (agrErr) throw agrErr;
      setAgreement(agr);

      // Fetch messages
      if (agr.conversation_id) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", agr.conversation_id)
          .order("created_at", { ascending: true });
        setMessages(msgs || []);
      }

      // Fetch products
      if (agr.product_ids?.length > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name, price_ksh, images")
          .in("id", agr.product_ids);
        setProducts(prods || []);
      }

      // Fetch vendor profile
      const { data: vendor } = await supabase
        .from("profiles")
        .select("id, full_name, store_name")
        .eq("id", agr.vendor_id)
        .single();
      setVendorProfile(vendor);
    } catch (err) {
      console.error("Error loading negotiation:", err);
      toast.error("Failed to load negotiation details");
    } finally {
      setLoading(false);
    }
  };

  // Send a regular text message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !agreement?.conversation_id || !user) return;

    setSending(true);
    try {
      const isVendor = user.id === agreement.vendor_id;

      const { error } = await supabase.from("messages").insert({
        conversation_id: agreement.conversation_id,
        sender_id: user.id,
        sender_role: isVendor ? "vendor" : "user",
        message: newMessage.trim(),
        message_type: "text",
      });
      if (error) throw error;

      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", agreement.conversation_id);

      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Send a delivery fee proposal
  const handleSendProposal = async () => {
    const fee = parseFloat(proposedFee);
    if (isNaN(fee) || fee < 0) {
      toast.error("Please enter a valid delivery fee");
      return;
    }
    if (!agreement?.conversation_id || !user) return;

    setSending(true);
    try {
      const isVendor = user.id === agreement.vendor_id;

      // Insert proposal message
      await supabase.from("messages").insert({
        conversation_id: agreement.conversation_id,
        sender_id: user.id,
        sender_role: isVendor ? "vendor" : "user",
        message: `Proposed delivery fee: KES ${fee.toLocaleString()}${proposedMethod ? ` via ${proposedMethod}` : ""}`,
        message_type: "delivery_proposal",
        metadata: {
          delivery_fee: fee,
          delivery_method: proposedMethod || null,
        },
      });

      // Update agreement with latest proposal
      await supabase
        .from("delivery_agreements")
        .update({
          delivery_fee_ksh: fee,
          delivery_method: proposedMethod || agreement.delivery_method,
          proposed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agreement.id);

      setProposedFee("");
      setProposedMethod("");
      setShowProposalForm(false);
      toast.success("Proposal sent!");
    } catch (err) {
      console.error("Error sending proposal:", err);
      toast.error("Failed to send proposal");
    } finally {
      setSending(false);
    }
  };

  // Accept a delivery proposal
  const handleAcceptProposal = async (fee: number, method: string | null) => {
    if (!agreement || !user) return;

    setSending(true);
    try {
      // Update agreement to agreed
      await supabase
        .from("delivery_agreements")
        .update({
          status: "agreed",
          delivery_fee_ksh: fee,
          delivery_method: method || agreement.delivery_method,
          agreed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", agreement.id);

      const isVendor = user.id === agreement.vendor_id;

      // Send acceptance message
      await supabase.from("messages").insert({
        conversation_id: agreement.conversation_id,
        sender_id: user.id,
        sender_role: isVendor ? "vendor" : "user",
        message: `✅ Delivery fee agreed: KES ${fee.toLocaleString()}${method ? ` via ${method}` : ""}`,
        message_type: "delivery_accepted",
        metadata: { delivery_fee: fee, delivery_method: method },
      });

      if (isVendor) {
        toast.success("🎉 Delivery fee agreed! The buyer has been notified to proceed to checkout.");
      } else {
        toast.success("🎉 Delivery fee agreed! You can now proceed to checkout.");
      }
    } catch (err) {
      console.error("Error accepting proposal:", err);
      toast.error("Failed to accept proposal");
    } finally {
      setSending(false);
    }
  };

  if (authLoading || loading) {
    return <SneakerLoader message="Loading negotiation..." />;
  }

  if (!agreement) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-bold mb-2">Negotiation not found</h2>
        <p className="text-muted-foreground mb-4">This delivery agreement doesn't exist or has expired.</p>
        <Button onClick={() => navigate("/cart")}>Back to Cart</Button>
      </div>
    );
  }

  const isVendor = user?.id === agreement.vendor_id;
  const isBuyer = user?.id === agreement.buyer_id;
  const isAgreed = agreement.status === "agreed";
  const vendorName = vendorProfile?.store_name || vendorProfile?.full_name || "Vendor";
  const canPropose = !isAgreed && (isBuyer || isVendor);
  const latestProposal = agreement.proposed_by && agreement.delivery_fee_ksh > 0;
  const canAccept = latestProposal && agreement.proposed_by !== user?.id && !isAgreed;

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <MessageCircle size={24} strokeWidth={1.5} className="text-primary" />
              Delivery Negotiation
            </h1>
            <p className="text-sm text-muted-foreground">
              {isVendor ? `Buyer: ${agreement.buyer_name}` : `Vendor: ${vendorName}`}
            </p>
          </div>
          {isAgreed && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-sm px-3 py-1">
              ✅ Agreed — KES {agreement.delivery_fee_ksh.toLocaleString()}
            </Badge>
          )}
        </div>

        {/* Inline Checkout Section — replaces the old "Proceed to Checkout" button */}
        {isAgreed && isBuyer && (
          <InlineCheckout
            agreement={agreement}
            products={products}
            user={user!}
            vendorName={vendorName}
            processing={processingCheckout}
            setProcessing={setProcessingCheckout}
            removeItemsByVendor={removeItemsByVendor}
            navigate={navigate}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Delivery Details Summary */}
          <div className="lg:col-span-1 space-y-4">
            {/* Delivery Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin size={18} strokeWidth={1.5} className="text-primary" />
                  Delivery Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <User size={14} strokeWidth={1.5} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">{agreement.buyer_name}</p>
                    <p className="text-muted-foreground">{agreement.buyer_phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} strokeWidth={1.5} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p>{agreement.buyer_address}</p>
                    <p className="text-muted-foreground">{agreement.buyer_city}{agreement.buyer_county ? `, ${agreement.buyer_county}` : ""}</p>
                  </div>
                </div>
                {agreement.buyer_delivery_notes && (
                  <div className="bg-muted/50 rounded-lg p-2 text-xs text-muted-foreground">
                    📝 {agreement.buyer_delivery_notes}
                  </div>
                )}
                {agreement.buyer_gps_lat && agreement.buyer_gps_lng && (
                  <a
                    href={`https://www.google.com/maps?q=${agreement.buyer_gps_lat},${agreement.buyer_gps_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline flex items-center gap-1"
                  >
                    <MapPin size={12} strokeWidth={1.5} />
                    View on Google Maps
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Products Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package size={18} strokeWidth={1.5} className="text-primary" />
                  Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {products.map(product => (
                  <div key={product.id} className="flex gap-2 items-center">
                    <div className="w-10 h-10 rounded border overflow-hidden flex-shrink-0">
                      <img
                        src={product.images?.[0] || "/placeholder.svg"}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">KES {product.price_ksh?.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Current Proposal Status */}
            {latestProposal && !isAgreed && (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20">
                <CardContent className="py-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    💰 Latest proposal: KES {agreement.delivery_fee_ksh.toLocaleString()}
                    {agreement.delivery_method && ` via ${agreement.delivery_method}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Proposed by {agreement.proposed_by === user?.id ? "you" : isVendor ? "buyer" : "vendor"}
                  </p>
                  {canAccept && (
                    <Button
                      onClick={() => handleAcceptProposal(agreement.delivery_fee_ksh, agreement.delivery_method)}
                      disabled={sending}
                      className="w-full mt-2 gap-2 bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <Check size={16} strokeWidth={1.5} />
                      Accept KES {agreement.delivery_fee_ksh.toLocaleString()}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Chat Thread */}
          <div className="lg:col-span-2">
            <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageCircle size={40} strokeWidth={1} className="mx-auto mb-3 opacity-30" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      currentUserId={user?.id || ""}
                      onAccept={canAccept ? handleAcceptProposal : undefined}
                      onCounter={canPropose ? (fee, method) => {
                        setProposedFee(String(fee));
                        setProposedMethod(method || "");
                        setShowProposalForm(true);
                      } : undefined}
                      sending={sending}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Proposal Form (expandable) */}
              {canPropose && showProposalForm && (
                <div className="border-t bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Truck size={16} strokeWidth={1.5} className="text-primary" />
                      Propose Delivery Fee
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowProposalForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        min="0"
                        value={proposedFee}
                        onChange={e => setProposedFee(e.target.value)}
                        placeholder="Amount in KES"
                        className="text-base"
                      />
                    </div>
                    <Select value={proposedMethod} onValueChange={setProposedMethod}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        {DELIVERY_METHODS.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSendProposal}
                    disabled={sending || !proposedFee}
                    className="w-full gap-2"
                  >
                    {sending ? (
                      <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                    ) : (
                      <Send size={16} strokeWidth={1.5} />
                    )}
                    Send Proposal
                  </Button>
                </div>
              )}

              {/* Chat Input */}
              <div className="border-t p-3">
                {canPropose && !showProposalForm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mb-2 w-full gap-2 text-primary border-primary/30 hover:bg-primary/5"
                    onClick={() => setShowProposalForm(true)}
                  >
                    <Truck size={16} strokeWidth={1.5} />
                    Propose Delivery Fee
                  </Button>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={sending}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={sending || !newMessage.trim()} size="icon">
                    <Send size={16} strokeWidth={1.5} />
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Message Bubble Component ──────────────────────────────────────────

const MessageBubble = ({
  message,
  currentUserId,
  onAccept,
  onCounter,
  sending,
}: {
  message: NegMessage;
  currentUserId: string;
  onAccept?: (fee: number, method: string | null) => void;
  onCounter?: (fee: number, method: string | null) => void;
  sending: boolean;
}) => {
  const isOwn = message.sender_id === currentUserId;

  // System messages
  if (message.message_type === "system") {
    return (
      <div className="flex justify-center">
        <div className="bg-muted/60 rounded-lg px-4 py-2 max-w-[85%] text-center">
          <p className="text-xs text-muted-foreground whitespace-pre-line">{message.message}</p>
        </div>
      </div>
    );
  }

  // Delivery proposal card
  if (message.message_type === "delivery_proposal") {
    const fee = message.metadata?.delivery_fee || 0;
    const method = message.metadata?.delivery_method;

    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <Card className={`max-w-[80%] border-2 ${isOwn ? "border-primary/30 bg-primary/5" : "border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/20"}`}>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Truck size={16} strokeWidth={1.5} className="text-primary" />
              <span className="text-sm font-semibold">
                {isOwn ? "Your Proposal" : "Delivery Proposal"}
              </span>
            </div>
            <div className="bg-background/80 rounded-lg p-3">
              <p className="text-lg font-bold">KES {fee.toLocaleString()}</p>
              {method && (
                <p className="text-xs text-muted-foreground mt-1">
                  via {method}
                </p>
              )}
            </div>
            {!isOwn && onAccept && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                  onClick={() => onAccept(fee, method)}
                  disabled={sending}
                >
                  <Check size={14} strokeWidth={1.5} />
                  Accept
                </Button>
                {onCounter && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => onCounter(fee, method)}
                  >
                    <RefreshCw size={14} strokeWidth={1.5} />
                    Counter
                  </Button>
                )}
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Delivery accepted card
  if (message.message_type === "delivery_accepted") {
    const fee = message.metadata?.delivery_fee || 0;
    const method = message.metadata?.delivery_method;

    return (
      <div className="flex justify-center">
        <Card className="max-w-[85%] border-2 border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20">
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-green-600 dark:text-green-400 font-bold text-lg">
              ✅ Delivery Fee Agreed!
            </p>
            <p className="text-xl font-bold">KES {fee.toLocaleString()}</p>
            {method && <p className="text-sm text-muted-foreground">via {method}</p>}
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Delivery rejected card
  if (message.message_type === "delivery_rejected") {
    return (
      <div className="flex justify-center">
        <Card className="max-w-[85%] border-2 border-red-300 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20">
          <CardContent className="p-3 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium text-sm">
              ❌ {message.message}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Regular text message
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <Card className={`max-w-[75%] ${isOwn ? "bg-primary text-primary-foreground" : ""}`}>
        <CardContent className="p-3">
          <p className="text-sm break-words whitespace-pre-line">{message.message}</p>
          <span className={`text-[10px] mt-1 block ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </CardContent>
      </Card>
    </div>
  );
};

// ── InlineCheckout Component ──────────────────────────────────────────
// Shown to the buyer once the delivery fee is agreed. Creates the order
// and redirects to IntaSend without needing to go through /checkout.

const InlineCheckout = ({
  agreement,
  products,
  user,
  vendorName,
  processing,
  setProcessing,
  removeItemsByVendor,
  navigate,
}: {
  agreement: DeliveryAgreement;
  products: any[];
  user: User;
  vendorName: string;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  removeItemsByVendor: (vendorId: string) => void;
  navigate: ReturnType<typeof import("react-router-dom").useNavigate>;
}) => {
  const subtotal = products.reduce((sum, p) => sum + (p.price_ksh || 0), 0);
  const total = subtotal + agreement.delivery_fee_ksh;

  const handleCheckout = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const commissionRate = 6;
      const subtotalRounded = Number(subtotal.toFixed(2));
      const deliveryFee = Number(agreement.delivery_fee_ksh.toFixed(2));
      const finalTotal = Number((subtotalRounded + deliveryFee).toFixed(2));
      const commissionAmount = Number((subtotalRounded * (commissionRate / 100)).toFixed(2));
      const payoutAmount = Number((finalTotal - commissionAmount).toFixed(2));

      // 1. Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          vendor_id: agreement.vendor_id,
          subtotal_ksh: subtotalRounded,
          shipping_fee_ksh: deliveryFee,
          total_ksh: finalTotal,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          payout_amount: payoutAmount,
          status: "pending_payment",
        })
        .select()
        .single();

      if (orderError || !order) throw new Error(orderError?.message || "Failed to create order");

      // 2. Insert order items (one per product, quantity 1)
      const orderItems = products.map((p) => ({
        order_id: order.id,
        product_id: p.id,
        product_name: p.name,
        product_snapshot: { images: p.images, price_ksh: p.price_ksh },
        quantity: 1,
        unit_price_ksh: Number(p.price_ksh),
        line_total_ksh: Number(p.price_ksh),
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(itemsError.message || "Failed to save order items");
      }

      // 3. Insert shipping details from agreement
      const { error: shippingError } = await supabase.from("order_shipping_details").insert({
        order_id: order.id,
        recipient_name: agreement.buyer_name,
        phone: agreement.buyer_phone,
        email: agreement.buyer_email || null,
        address_line1: agreement.buyer_address,
        city: agreement.buyer_city,
        county: agreement.buyer_county || null,
        country: "Kenya",
        delivery_notes: agreement.buyer_delivery_notes || null,
        delivery_type: "delivery",
        gps_latitude: agreement.buyer_gps_lat,
        gps_longitude: agreement.buyer_gps_lng,
      });

      if (shippingError) {
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(shippingError.message || "Failed to save shipping details");
      }

      // 4. Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          gateway: "intasend",
          status: "pending",
          amount_ksh: finalTotal,
          currency: "KES",
        })
        .select()
        .single();

      if (paymentError || !payment) {
        await supabase.from("order_shipping_details").delete().eq("order_id", order.id);
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(paymentError?.message || "Failed to create payment record");
      }

      // 5. Mark agreement as used
      await supabase
        .from("delivery_agreements")
        .update({ status: "used", updated_at: new Date().toISOString() })
        .eq("id", agreement.id);

      // 6. Initiate IntaSend payment
      const { data: intasendResponse, error: intasendError } = await supabase.functions.invoke(
        "intasend-initiate-payment",
        {
          body: {
            orderId: order.id,
            successUrl: `${window.location.origin}/orders/${order.id}?payment_success=true`,
            cancelUrl: `${window.location.origin}/orders/${order.id}?cancelled=true`,
          },
        }
      );

      if (intasendError || !intasendResponse?.success || !intasendResponse?.url) {
        await supabase.from("payments").delete().eq("id", payment.id);
        await supabase.from("order_shipping_details").delete().eq("order_id", order.id);
        await supabase.from("order_items").delete().eq("order_id", order.id);
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(intasendError?.message || intasendResponse?.error || "Failed to initiate payment");
      }

      removeItemsByVendor(agreement.vendor_id);
      toast.success("Opening secure payment page...");
      window.location.href = intasendResponse.url;
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-900/10 mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
          <ShieldCheck size={18} strokeWidth={1.5} />
          Ready to Pay — Delivery Agreed!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-background/80 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Products subtotal</span>
            <span className="font-medium">KES {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Delivery via {agreement.delivery_method || "negotiated"}
            </span>
            <span className="font-medium">KES {agreement.delivery_fee_ksh.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold text-base">
            <span>Total</span>
            <span className="text-green-700 dark:text-green-400">KES {total.toLocaleString()}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Delivering to <strong>{agreement.buyer_name}</strong> · {agreement.buyer_address},{" "}
          {agreement.buyer_city}
        </p>
        <Button
          className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={handleCheckout}
          disabled={processing}
        >
          {processing ? (
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <CreditCard size={16} strokeWidth={1.5} />
          )}
          {processing ? "Processing..." : `Pay KES ${total.toLocaleString()} Securely`}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DeliveryNegotiation;
