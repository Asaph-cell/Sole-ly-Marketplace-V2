import { createContext, ReactNode, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getChatUserId } from "@/lib/chat";

// Who's online, via Supabase Realtime presence (no database writes). Every
// open tab joins one shared channel and announces its user id; everyone else
// sees the set of ids currently connected.

type PresenceState = { online: Set<string>; me: string | null };
const PresenceContext = createContext<PresenceState>({ online: new Set(), me: null });

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PresenceState>({ online: new Set(), me: null });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const join = async () => {
      const { id } = await getChatUserId();
      if (cancelled) return;
      channel = supabase.channel("presence:online", { config: { presence: { key: id } } });
      channel
        .on("presence", { event: "sync" }, () => {
          const ids = new Set(Object.keys(channel!.presenceState()));
          setState({ online: ids, me: id });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") await channel!.track({ at: Date.now() });
        });
    };
    void join();

    // Re-join under the new id when someone signs in or out.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        if (channel) supabase.removeChannel(channel);
        void join();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return <PresenceContext.Provider value={state}>{children}</PresenceContext.Provider>;
};

export const useIsOnline = (userId: string | null | undefined) => {
  const { online } = useContext(PresenceContext);
  return !!userId && online.has(userId);
};

/**
 * Typing indicator for one conversation, over a broadcast channel.
 * Returns whether the other person is typing and a notify() to call on keystrokes.
 */
export const useTyping = (conversationId: string | null, myId: string | null) => {
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!conversationId || !myId) return;
    const channel = supabase.channel(`typing:${conversationId}`);
    channel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId === myId) return;
        setOtherTyping(true);
        clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(() => setOtherTyping(false), 3500);
      })
      .on("broadcast", { event: "stop" }, ({ payload }) => {
        if (payload?.userId !== myId) setOtherTyping(false);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      clearTimeout(clearTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setOtherTyping(false);
    };
  }, [conversationId, myId]);

  const notify = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || now - lastSent.current < 2000) return;
    lastSent.current = now;
    void channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: myId } });
  }, [myId]);

  const stop = useCallback(() => {
    lastSent.current = 0;
    void channelRef.current?.send({ type: "broadcast", event: "stop", payload: { userId: myId } });
  }, [myId]);

  return { otherTyping, notify, stop };
};
