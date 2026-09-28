import { useEffect } from "react";
import { ListSkeleton } from "@/components/skeletons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { ChatInbox } from "@/components/messaging/ChatInbox";

const VendorMessages = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Driven by ?conversation=<id> so other surfaces can deep-link straight
  // into a thread. The delivery inquiry banner needs this to open the chat
  // the buyer is actually waiting in, rather than dropping the vendor on an
  // unselected list.
  const selectedConversationId = searchParams.get("conversation");

  const setSelectedConversationId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("conversation", id);
    else next.delete("conversation");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="container mx-auto p-4 sm:p-6"><ListSkeleton rows={7} /></div>;
  }

  return (
    <div data-layout="designed" className="min-h-screen bg-sunken">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8">
          <h1 className="font-display text-3xl mb-4 sm:mb-6">Messages</h1>
          <ChatInbox
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
            isVendor
            className="h-[calc(100dvh-170px)] sm:h-[calc(100dvh-200px)]"
          />
        </main>
      </div>
    </div>
  );
};

export default VendorMessages;
