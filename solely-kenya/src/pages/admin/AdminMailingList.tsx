import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchBar, EmptyState } from "@/components/admin/AdminShared";
import { useToast } from "@/hooks/use-toast";
import { Mail, Users, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { formatDistanceToNow } from "date-fns";

interface MailingUser {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "vendor" | "customer";
  created_at: string;
}

const AdminMailingList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<MailingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "vendor" | "customer">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [showComposer, setShowComposer] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;
      
      const vendorIds = new Set(
        roles?.filter(r => r.role === "vendor" || r.role === "revoked_vendor").map(r => r.user_id) || []
      );

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const mailingUsers: MailingUser[] = (profiles || []).map(p => ({
        ...p,
        role: vendorIds.has(p.id) ? "vendor" : "customer"
      }));

      setUsers(mailingUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      toast({ title: "Error", description: "Failed to load mailing list", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadUsers();
  }, [user]);

  const filteredUsers = users.filter(u => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const name = (u.full_name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    
    return name.includes(query) || email.includes(query);
  });

  const validEmails = filteredUsers.filter(u => u.email && u.email.trim() !== "");

  const toggleSelectAll = () => {
    if (selectedIds.size === validEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validEmails.map(u => u.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const sendEmail = async () => {
    if (!subject || !message || selectedIds.size === 0) return;
    
    setSending(true);
    try {
      const targetEmails = users
        .filter(u => selectedIds.has(u.id) && u.email)
        .map(u => u.email);

      // We call our send-announcement edge function but pass 'custom' and a list of emails?
      // Wait, send-announcement currently only supports 'all', 'vendors', 'customers'.
      // We should update it to support 'custom' with an array of emails, or we can just iterate client side.
      // But iterating client-side might expose the resend key? No, edge function handles resend.
      // Let's invoke the function. We will need to update send-announcement to accept 'customEmails'.
      
      const response = await supabase.functions.invoke("send-announcement", {
        body: { 
          subject: subject, 
          htmlContent: message, 
          targetAudience: "custom",
          customEmails: targetEmails
        },
      });

      if (response.error) {
        let errMessage = response.error.message;
        if (response.error.context && typeof response.error.context.json === 'function') {
          try {
            const errJson = await response.error.context.json();
            if (errJson && errJson.error) errMessage = errJson.error;
          } catch (e) { /* ignore */ }
        }
        throw new Error(errMessage);
      }

      toast({ title: "Sent!", description: response.data?.message || `Sent to ${selectedIds.size} recipients.` });
      setSubject("");
      setMessage("");
      setShowComposer(false);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminLayout pageTitle="Mailing List">
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchBar 
            placeholder="Search by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {["all", "vendor", "customer"].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role as any)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium border transition-colors capitalize",
                roleFilter === role
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-muted/30 p-3 rounded-lg border border-border">
        <div className="flex items-center gap-3">
          <input 
            type="checkbox" 
            checked={validEmails.length > 0 && selectedIds.size === validEmails.length}
            onChange={toggleSelectAll}
            className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            disabled={validEmails.length === 0}
          />
          <span className="text-xs font-medium">
            {selectedIds.size} selected
          </span>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          disabled={selectedIds.size === 0}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 transition-opacity"
        >
          <Mail size={14} />
          Compose Email
        </button>
      </div>

      {showComposer && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 animate-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Send size={14} className="text-primary" />
              New Message
            </h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              To: {selectedIds.size} recipients
            </span>
          </div>
          
          <input
            className="w-full px-3 py-2 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background mb-3 transition"
            placeholder="Subject line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <textarea
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-muted text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background min-h-[150px] resize-y transition mb-3"
            placeholder="Write your message... (HTML supported)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowComposer(false)}
              className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              onClick={sendEmail}
              disabled={sending || !subject || !message}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2 disabled:opacity-50 transition"
            >
              {sending ? (
                <div className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
              ) : null}
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <SneakerLoader message="Loading directory..." fullScreen={false} />
      ) : validEmails.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState 
            icon={Users}
            title="No users found"
            subtitle="Try adjusting your search or filters"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_1fr_100px] gap-4 p-3 bg-muted/20 text-xs font-medium text-muted-foreground">
            <div className="w-4 ml-1"></div>
            <div>User</div>
            <div>Email</div>
            <div className="text-right">Role</div>
          </div>
          
          {filteredUsers.map(u => {
            const hasEmail = Boolean(u.email && u.email.trim() !== "");
            return (
              <div 
                key={u.id} 
                className={cn(
                  "grid grid-cols-[auto_1fr_1fr_100px] gap-4 p-3 items-center transition-colors",
                  hasEmail ? "hover:bg-muted/40" : "opacity-60 bg-muted/10",
                  selectedIds.has(u.id) && "bg-primary/5"
                )}
                onClick={() => hasEmail && toggleSelect(u.id)}
              >
                <div className="w-4 ml-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    disabled={!hasEmail}
                    className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
                
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center text-[10px] font-medium text-primary">
                    {(u.full_name || "U")[0].toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-foreground truncate">
                      {u.full_name || "Unknown User"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-foreground truncate">
                  {u.email || <span className="text-muted-foreground italic">No email</span>}
                </div>

                <div className="text-right">
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium capitalize",
                    u.role === "vendor" 
                      ? "bg-blue-500/10 text-blue-500" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {u.role}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminMailingList;
