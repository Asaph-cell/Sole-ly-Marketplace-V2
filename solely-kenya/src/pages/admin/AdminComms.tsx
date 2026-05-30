import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { Send, MessageSquare, CheckCheck, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface FeedbackItem {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

const AdminComms = () => {
  const { toast } = useToast();
  
  // Announcements
  const [audience, setAudience] = useState("All users");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  
  // Feedback
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(true);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      const { data, error } = await supabase
        .from("company_feedback")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      setFeedback(data || []);
    } catch (error) {
      console.error("Error loading feedback:", error);
    } finally {
      setLoadingFeedback(false);
    }
  };

  const markImplemented = async (id: string) => {
    try {
      const { error } = await supabase
        .from("company_feedback")
        .update({ status: 'implemented' })
        .eq("id", id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Feedback marked as implemented" });
      loadFeedback();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteFeedback = async (id: string) => {
    try {
      const { error } = await supabase.from("company_feedback").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Feedback removed" });
      loadFeedback();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const sendAnnouncement = async () => {
    if (!subject || !message) return;
    
    setSending(true);
    try {
      const targetMap: Record<string, string> = {
        "All users": "all",
        "Vendors": "vendors",
        "Buyers": "customers"
      };
      
      const response = await supabase.functions.invoke("send-announcement", {
        body: { 
          subject: subject, 
          htmlContent: message, 
          targetAudience: targetMap[audience] || "all"
        },
      });

      if (response.error) {
        let errMessage = response.error.message;
        
        // Attempt to parse the exact error from the edge function
        if (response.error.context && typeof response.error.context.json === 'function') {
          try {
            const errJson = await response.error.context.json();
            if (errJson && errJson.error) {
              errMessage = errJson.error;
            }
          } catch (e) {
            // Ignore parsing error
          }
        }
        throw new Error(errMessage);
      }

      toast({ title: "Sent!", description: response.data?.message || "Announcement broadcasted successfully." });
      setSubject("");
      setMessage("");
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout pageTitle="Comms">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Announcement composer */}
        <div className="rounded-xl border border-border bg-card p-4 h-fit">
          <p className="text-xs font-medium text-foreground mb-3">
            Send announcement
          </p>

          {/* Audience selector */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {["All users", "Vendors", "Buyers"].map(opt => (
              <button
                key={opt}
                onClick={() => setAudience(opt)}
                className={cn(
                  "py-1.5 rounded-lg text-xs font-medium border transition-colors text-center",
                  audience === opt
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {opt}
              </button>
            ))}
          </div>

          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background mb-2.5 transition"
            placeholder="Subject line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <textarea
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background min-h-[100px] resize-y transition"
            placeholder="Write your message... (HTML supported)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button
            onClick={sendAnnouncement}
            disabled={sending || !subject || !message}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-70"
          >
            {sending ? (
              <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : (
              <Send size={13} strokeWidth={2} />
            )}
            Send to {audience.toLowerCase()}
          </button>
        </div>

        {/* Feedback list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-medium text-foreground">
              Community feedback
            </p>
          </div>

          <div className="divide-y divide-border">
            {loadingFeedback ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : feedback.length === 0 ? (
              <EmptyState 
                icon={MessageSquare} 
                title="No feedback yet" 
                subtitle="User suggestions will appear here" 
              />
            ) : (
              feedback.map(item => {
                const isImplemented = item.status === 'implemented';
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    <MessageSquare
                      size={14}
                      strokeWidth={1.5}
                      className={cn(
                        "flex-shrink-0 mt-0.5",
                        isImplemented ? "text-success" : "text-muted-foreground"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs text-foreground leading-relaxed",
                        isImplemented && "line-through text-muted-foreground"
                      )}>
                        "{item.message}"
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {isImplemented && (
                          <StatusPill status="implemented" />
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          Anonymous · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-shrink-0">
                      {!isImplemented && (
                        <button
                          onClick={() => markImplemented(item.id)}
                          className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          aria-label="Mark as implemented"
                        >
                          <CheckCheck size={12} strokeWidth={2} className="text-success" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteFeedback(item.id)}
                        className="w-6 h-6 rounded-md border border-destructive/20 bg-destructive/5 flex items-center justify-center hover:bg-destructive/15 transition-colors"
                        aria-label="Delete feedback"
                      >
                        <Trash2 size={12} strokeWidth={2} className="text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
};

export default AdminComms;
