import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { generateUUID } from "@/utils/uuid";

interface Message {
  id: string;
  message: string;
  sender_id: string;
  sender_role: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
          setMessages((current) => [...current, payload.new as Message]);
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
      let currentUserId = user?.id as string | undefined;
      if (!currentUserId) {
        const existing = localStorage.getItem("guestId");
        let normalized = existing || "";
        if (normalized && normalized.startsWith('guest:')) {
          normalized = normalized.replace(/^guest:/, '');
          localStorage.setItem('guestId', normalized);
        }
        currentUserId = normalized || generateUUID();
        if (!existing) localStorage.setItem("guestId", currentUserId);
      }

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
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
      let currentUserId = user?.id as string | undefined;
      let senderRole = 'user';
      if (!currentUserId) {
        const existing = localStorage.getItem("guestId");
        let normalized = existing || "";
        if (normalized && normalized.startsWith('guest:')) {
          normalized = normalized.replace(/^guest:/, '');
          localStorage.setItem('guestId', normalized);
        }
        currentUserId = normalized || generateUUID();
        if (!existing) localStorage.setItem("guestId", currentUserId);
        senderRole = 'guest';
      }

      const { data: conversation } = await supabase
        .from('conversations')
        .select('vendor_id, buyer_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) throw new Error('Conversation not found');

      const isVendor = conversation.vendor_id === currentUserId;

      const { error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          sender_id: currentUserId,
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
            <MessageBubble key={msg.id} message={msg} />
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

const MessageBubble = ({ message }: { message: Message }) => {
  const [isOwn, setIsOwn] = useState(false);

  useEffect(() => {
    const checkOwnership = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwn(user?.id === message.sender_id);
    };
    checkOwnership();
  }, [message.sender_id]);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <Card className={`max-w-[70%] p-3 ${isOwn ? 'bg-primary text-primary-foreground' : ''}`}>
        <p className="text-sm break-words">{message.message}</p>
        <span className={`text-xs mt-1 block ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
        </span>
      </Card>
    </div>
  );
};
