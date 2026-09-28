import { useEffect, useState } from "react";
import { ListSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { ConversationList } from "@/components/messaging/ConversationList";
import { MessageThread } from "@/components/messaging/MessageThread";

const Messages = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  useEffect(() => {
    // Guests are allowed to use in-app messaging with a local guestId
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="container mx-auto p-4 sm:p-6"><ListSkeleton rows={7} /></div>;
  }

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">My Messages</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-250px)]">
          <Card className="md:col-span-1 overflow-y-auto">
            <ConversationList
              onSelectConversation={setSelectedConversationId}
              selectedConversationId={selectedConversationId}
              isVendor={false}
            />
          </Card>
          <Card className="md:col-span-2 flex flex-col">
            {selectedConversationId ? (
              <MessageThread conversationId={selectedConversationId} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to view messages
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Messages;
