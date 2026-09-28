import { MessageCircle } from "lucide-react";
import { ConversationList } from "@/components/messaging/ConversationList";
import { MessageThread } from "@/components/messaging/MessageThread";

// List + thread side by side on desktop; on phones the list fills the screen
// and opening a chat swaps to the thread (with a back button).
export const ChatInbox = ({
  selectedId,
  onSelect,
  isVendor,
  className = "",
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isVendor: boolean;
  className?: string;
}) => (
  <div className={`grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-3xl border border-border bg-background shadow-card md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] ${className}`}>
    <aside className={`min-h-0 min-w-0 border-border md:border-r ${selectedId ? "hidden md:block" : "block"}`}>
      <ConversationList onSelectConversation={onSelect} selectedConversationId={selectedId} isVendor={isVendor} />
    </aside>
    {/* On phones an open chat takes the whole screen, like a chat app, so the
        message box is never pushed below the fold by the site header. */}
    <section className={`min-h-0 min-w-0 ${selectedId ? "fixed inset-0 z-[60] bg-background md:static md:z-auto md:block" : "hidden md:block"}`}>
      {selectedId ? (
        <MessageThread key={selectedId} conversationId={selectedId} onBack={() => onSelect(null)} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-sunken p-8 text-center text-muted-foreground">
          <MessageCircle size={32} strokeWidth={1.5} className="text-foreground/30" />
          <p className="text-sm">Choose a conversation to start chatting</p>
        </div>
      )}
    </section>
  </div>
);
