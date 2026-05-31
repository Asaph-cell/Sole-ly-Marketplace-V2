import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Card } from "@/components/ui/card";
import { ConversationList } from "@/components/messaging/ConversationList";
import { MessageThread } from "@/components/messaging/MessageThread";

const VendorMessages = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <VendorNavbar />
      <div className="flex">
        <VendorSidebar />
        <main className="flex-1 p-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Messages</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
            <Card className="md:col-span-1 overflow-y-auto">
              <ConversationList
                onSelectConversation={setSelectedConversationId}
                selectedConversationId={selectedConversationId}
                isVendor={true}
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
    </div>
  );
};

export default VendorMessages;
