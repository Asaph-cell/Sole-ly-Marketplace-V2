import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Truck, Check, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { generateUUID } from "@/utils/uuid";

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
  message_type?: string;
  metadata?: any;
  created_at: string;
  is_read: boolean;
}

interface MessageThreadProps {
  conversationId: string;
}

export const MessageThread = ({ conversationId }: MessageThreadProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Resolve current user ID once, not per bubble
  useEffect(() => {
    const resolveUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        setCurrentUserId(user.id);
      } else {
        const existing = localStorage.getItem("guestId");
        let normalized = existing || "";
        if (normalized && normalized.startsWith('guest:')) {
          normalized = normalized.replace(/^guest:/, '');
          localStorage.setItem('guestId', normalized);
        }
        const id = normalized || generateUUID();
        if (!existing) localStorage.setItem("guestId", id);
        setCurrentUserId(id);
      }
    };
    resolveUser();
  }, []);

  useEffect(() => {
    loadMessages();
    markMessagesAsRead();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages((current) => {
            // Deduplicate: check if message already exists
            const newMsg = payload.new as Message;
            if (current.some(m => m.id === newMsg.id)) return current;
            return [...current, newMsg];
          });
          markMessagesAsRead();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let userId = user?.id as string | undefined;
      if (!userId) {
        const existing = localStorage.getItem("guestId");
        let normalized = existing || "";
        if (normalized && normalized.startsWith('guest:')) {
          normalized = normalized.replace(/^guest:/, '');
          localStorage.setItem('guestId', normalized);
        }
        userId = normalized || generateUUID();
        if (!existing) localStorage.setItem("guestId", userId);
      }

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let senderId = user?.id as string | undefined;
      let senderRole = 'user';
      if (!senderId) {
        const existing = localStorage.getItem("guestId");
        let normalized = existing || "";
        if (normalized && normalized.startsWith('guest:')) {
          normalized = normalized.replace(/^guest:/, '');
          localStorage.setItem('guestId', normalized);
        }
        senderId = normalized || generateUUID();
        if (!existing) localStorage.setItem("guestId", senderId);
        senderRole = 'guest';
      }

      const { data: conversation } = await supabase
        .from('conversations')
        .select('vendor_id, buyer_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) throw new Error('Conversation not found');

      const isVendor = conversation.vendor_id === senderId;

      const { error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: senderId,
          sender_role: isVendor ? 'vendor' : senderRole,
          message: newMessage.trim()
        }]);

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading messages...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={currentUserId || ""}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !newMessage.trim()}>
            <Send size={16} strokeWidth={1.5}  />
          </Button>
        </div>
      </form>
    </div>
  );
};

// Issue #4: currentUserId is now passed as a prop — no more per-bubble auth calls
// Issue #7: supports structured message types (delivery_proposal, delivery_accepted, etc.)
const MessageBubble = ({ message, currentUserId }: { message: Message; currentUserId: string }) => {
  const isOwn = message.sender_id === currentUserId;

  // System messages — centered info style
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
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <Card className={`max-w-[70%] p-3 ${isOwn ? 'bg-primary text-primary-foreground' : ''}`}>
        <p className="text-sm break-words whitespace-pre-line">{message.message}</p>
        <span className={`text-xs mt-1 block ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </span>
      </Card>
    </div>
  );
};
