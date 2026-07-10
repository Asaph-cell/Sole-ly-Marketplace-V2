import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";

interface Conversation {
  id: string;
  vendor_id: string;
  buyer_id: string | null;
  created_at: string;
  updated_at: string;
  delivery_agreement_id: string | null;
  last_message?: {
    message: string;
    created_at: string;
    is_read: boolean;
  };
  other_user?: {
    full_name: string | null;
    store_name: string | null;
  };
  unread_count: number;
  delivery_status: string | null;
}

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
  isVendor: boolean;
}

export const ConversationList = ({ 
  onSelectConversation, 
  selectedConversationId,
  isVendor 
}: ConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();

    // Subscribe to conversation updates
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Re-fetch when is_read status changes so badges update
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Use guestId for unauthenticated users
      let currentUserId = user?.id as string | undefined;
      if (!currentUserId) {
        const existing = localStorage.getItem("guestId");
        currentUserId = existing || crypto.randomUUID();
        if (!existing) localStorage.setItem("guestId", currentUserId);
      }

      // Fetch conversations where user is a participant (either buyer OR vendor)
      // The isVendor prop controls display, not filtering — users see ALL their conversations
      const { data: convData, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`buyer_id.eq.${currentUserId},vendor_id.eq.${currentUserId}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      if (!convData || convData.length === 0) {
        setConversations([]);
        return;
      }

      const convIds = convData.map(c => c.id);

      // Batch fetch: last message per conversation
      // Fetch the 2 most recent messages per conversation so we can pick the latest
      const { data: allRecentMessages } = await supabase
        .from('messages')
        .select('conversation_id, message, created_at, is_read, sender_id')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });

      // Build lookup: conversation_id -> latest message
      const lastMessageMap: Record<string, { message: string; created_at: string; is_read: boolean }> = {};
      // Build lookup: conversation_id -> unread count
      const unreadCountMap: Record<string, number> = {};

      if (allRecentMessages) {
        for (const msg of allRecentMessages) {
          // First message we see for each conversation is the latest (ordered desc)
          if (!lastMessageMap[msg.conversation_id]) {
            lastMessageMap[msg.conversation_id] = {
              message: msg.message,
              created_at: msg.created_at,
              is_read: msg.is_read,
            };
          }
          // Count unread from others
          if (!msg.is_read && msg.sender_id !== currentUserId) {
            unreadCountMap[msg.conversation_id] = (unreadCountMap[msg.conversation_id] || 0) + 1;
          }
        }
      }

      // Batch fetch: other user profiles
      // For each conversation, the "other user" is whoever ISN'T the current user
      const otherUserIds = [...new Set(convData.map(c => {
        if (c.vendor_id === currentUserId) return c.buyer_id;
        return c.vendor_id;
      }).filter(Boolean))];
      const profileMap: Record<string, { full_name: string | null; store_name: string | null }> = {};
      
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, store_name')
          .in('id', otherUserIds as string[]);
        
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.id] = { full_name: p.full_name, store_name: p.store_name };
          }
        }
      }

      // Batch fetch: delivery agreement statuses
      const agreementIds = [...new Set(convData.map(c => c.delivery_agreement_id).filter(Boolean))];
      const agreementMap: Record<string, string> = {};
      
      if (agreementIds.length > 0) {
        const { data: agreements } = await supabase
          .from('delivery_agreements')
          .select('id, status')
          .in('id', agreementIds as string[]);
        
        if (agreements) {
          for (const a of agreements) {
            agreementMap[a.id] = a.status;
          }
        }
      }

      // Assemble conversations with all data
      const conversationsWithDetails: Conversation[] = convData.map(conv => {
        // Show the other participant's name (not yourself)
        const otherUserId = conv.vendor_id === currentUserId ? conv.buyer_id : conv.vendor_id;
        return {
          ...conv,
          other_user: otherUserId ? profileMap[otherUserId] || null : null,
          last_message: lastMessageMap[conv.id] || null,
          unread_count: unreadCountMap[conv.id] || 0,
          delivery_status: conv.delivery_agreement_id 
            ? agreementMap[conv.delivery_agreement_id] || null 
            : null,
        };
      });

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted-foreground">Loading conversations...</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No conversations yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <Card
          key={conv.id}
          className={`p-4 cursor-pointer transition-colors hover:bg-accent ${
            selectedConversationId === conv.id ? 'bg-accent' : ''
          }`}
          onClick={() => {
            // Delivery conversations → go to full negotiation page with propose/accept/counter
            if (conv.delivery_agreement_id) {
              navigate(`/delivery-negotiation?agreementId=${conv.delivery_agreement_id}`);
            } else {
              onSelectConversation(conv.id);
            }
          }}
        >
          <div className="flex items-start gap-3">
            <Avatar>
              <AvatarFallback>
                {conv.other_user?.full_name?.[0] || conv.other_user?.store_name?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold truncate">
                  {conv.other_user?.store_name || conv.other_user?.full_name || 'Unknown User'}
                </p>
                {conv.last_message && (
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>
              {conv.last_message && (
                <p className="text-sm text-muted-foreground truncate">
                  {conv.last_message.message}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {conv.unread_count > 0 && (
                  <span className="inline-block px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                    {conv.unread_count} new
                  </span>
                )}
                {conv.delivery_status && (
                  <Badge
                    variant={conv.delivery_status === 'agreed' ? 'default' : 'secondary'}
                    className={`text-[10px] ${
                      conv.delivery_status === 'agreed'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : conv.delivery_status === 'negotiating'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                        : ''
                    }`}
                  >
                    {conv.delivery_status === 'negotiating' && '💬 Negotiating'}
                    {conv.delivery_status === 'agreed' && '✅ Fee Agreed'}
                    {conv.delivery_status === 'used' && '📦 Order Placed'}
                    {conv.delivery_status === 'expired' && '⏰ Expired'}
                  </Badge>
                )}
                {/* Issue #8: Link to negotiation page for delivery conversations */}
                {conv.delivery_agreement_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-primary gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/delivery-negotiation?agreementId=${conv.delivery_agreement_id}`);
                    }}
                  >
                    <ExternalLink size={10} strokeWidth={1.5} />
                    View Negotiation
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
