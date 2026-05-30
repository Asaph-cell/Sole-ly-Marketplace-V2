import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Shield, User, Store } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  sender_role: "buyer" | "vendor" | "admin";
  message: string;
  created_at: string;
}

export const DisputeChat = ({ disputeId, currentUserRole }: { disputeId: string, currentUserRole: "buyer" | "vendor" | "admin" }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("dispute_messages")
        .select("*")
        .eq("dispute_id", disputeId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
      }
      setLoading(false);
      scrollToBottom();
    };

    fetchMessages();

    const channel = supabase
      .channel(`dispute_chat_${disputeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dispute_messages",
          filter: `dispute_id=eq.${disputeId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const msgText = newMessage.trim();
    setNewMessage("");

    const { error } = await supabase.from("dispute_messages").insert({
      dispute_id: disputeId,
      sender_id: user.id,
      sender_role: currentUserRole,
      message: msgText,
    });

    if (error) {
      console.error("Error sending message:", error);
      // fallback in case UI didn't update
      setNewMessage(msgText);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") return <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase"><Shield size={10} /> Admin</span>;
    if (role === "vendor") return <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded uppercase"><Store size={10} /> Vendor</span>;
    return <span className="flex items-center gap-1 text-[10px] font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase"><User size={10} /> Buyer</span>;
  };

  if (loading) {
    return <div className="p-4 text-center text-sm text-muted-foreground">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-[400px] border rounded-xl bg-card overflow-hidden">
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">Resolution Center Chat</h3>
        <p className="text-xs text-muted-foreground">All parties can view this conversation.</p>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No messages yet. Start the conversation.
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {!isMe && getRoleBadge(msg.sender_role)}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isMe && getRoleBadge(msg.sender_role)}
                </div>
                <div 
                  className={`px-3 py-2 rounded-2xl max-w-[85%] text-sm ${
                    isMe 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : msg.sender_role === "admin" 
                        ? "bg-red-500/10 border border-red-500/20 rounded-tl-sm text-foreground"
                        : "bg-muted rounded-tl-sm text-foreground"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t bg-muted/10 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim()}>
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
};
