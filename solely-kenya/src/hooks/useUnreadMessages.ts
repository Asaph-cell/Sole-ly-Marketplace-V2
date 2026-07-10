import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook that returns the total unread message count for the current user.
 * Subscribes to real-time INSERT and UPDATE events on the messages table
 * so the count stays fresh without manual polling.
 */
export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnread = async () => {
      // Get all conversations where this user participates (as vendor or buyer)
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id}`);

      if (!convs || convs.length === 0) {
        setUnreadCount(0);
        return;
      }

      const convIds = convs.map((c) => c.id);

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .eq("is_read", false)
        .neq("sender_id", user.id);

      setUnreadCount(count || 0);
    };

    fetchUnread();

    // Subscribe to new messages AND read-status updates
    const channel = supabase
      .channel("global-unread-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          // Only re-fetch if someone else sent the message
          if (payload.new?.sender_id !== user.id) {
            fetchUnread();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          // When is_read flips to true, re-fetch to decrement badge
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return unreadCount;
};
