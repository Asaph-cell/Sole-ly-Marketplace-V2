import { ListSkeleton } from "@/components/skeletons";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ChatInbox } from "@/components/messaging/ChatInbox";

// Guests can chat too (with a device guest id), so no sign-in redirect here.
const Messages = () => {
  const { loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ?conversation=<id> lets other pages deep-link straight into a chat.
  const selected = searchParams.get("conversation");
  const select = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("conversation", id);
    else next.delete("conversation");
    setSearchParams(next, { replace: true });
  };

  if (loading) {
    return <div className="container mx-auto p-4 sm:p-6"><ListSkeleton rows={7} /></div>;
  }

  return (
    <div data-layout="designed" className="bg-sunken">
      <main className="container mx-auto px-3 py-4 sm:px-6 sm:py-8">
        <h1 className="font-display text-3xl mb-4 sm:mb-6">Messages</h1>
        <ChatInbox selectedId={selected} onSelect={select} isVendor={false} className="h-[calc(100dvh-190px)] sm:h-[calc(100dvh-240px)]" />
      </main>
    </div>
  );
};

export default Messages;
