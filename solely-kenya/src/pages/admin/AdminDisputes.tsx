import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    RefreshCw, Scale, CheckCircle2,
    ChevronRight, SplitSquareHorizontal
} from "lucide-react";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { DisputeChat } from "@/components/disputes/DisputeChat";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Dispute {
    id: string;
    order_id: string;
    customer_id: string;
    vendor_id: string;
    reason: string;
    description: string;
    status: string;
    opened_at: string;
    resolved_at: string | null;
    resolution_notes: string | null;
    evidence_images?: string[];
    customer?: { full_name: string; email: string };
    vendor?: { full_name: string; email: string; store_name: string };
    order?: { total_ksh: number; created_at: string };
}

const AdminDisputes = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [isAdmin, setIsAdmin] = useState(false);
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
    const [resolving, setResolving] = useState(false);
    const [resolutionNotes, setResolutionNotes] = useState("");
    const [filter, setFilter] = useState("all");
    const [showResolutionDialog, setShowResolutionDialog] = useState(false);
    const [resolutionType, setResolutionType] = useState<'full_refund_penalty' | 'partial_refund' | 'release_funds' | null>(null);
    const [partialAmount, setPartialAmount] = useState("");

    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) return;
            const { data } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .eq("role", "admin")
                .single();

            if (data) {
                setIsAdmin(true);
                loadDisputes();
            } else {
                navigate("/");
            }
        };
        if (!loading) checkAdmin();
    }, [user, loading, navigate]);

    const loadDisputes = async () => {
        setLoadingData(true);
        try {
            const { data, error } = await supabase
                .from("disputes")
                .select(`
                    *,
                    customer:profiles!customer_id(full_name, email),
                    vendor:profiles!vendor_id(full_name, email, store_name),
                    order:orders(total_ksh, created_at)
                `)
                .order("opened_at", { ascending: false });

            if (error) throw error;
            setDisputes(data as any);
        } catch (error: any) {
            toast({ title: "Error", description: "Failed to load disputes", variant: "destructive" });
        } finally {
            setLoadingData(false);
        }
    };

    const handleResolve = async () => {
        if (!selectedDispute || !resolutionType) return;
        setResolving(true);
        try {
            let action: "refund" | "release" | "close" | "partial_refund" = "close";
            let applyPenalty = false;
            let partialRefundAmt = undefined;

            if (resolutionType === 'full_refund_penalty') {
                action = "refund";
                applyPenalty = true;
            } else if (resolutionType === 'partial_refund') {
                action = "partial_refund";
                partialRefundAmt = parseFloat(partialAmount);
                if (isNaN(partialRefundAmt) || partialRefundAmt <= 0) {
                    throw new Error("Invalid partial refund amount");
                }
            } else if (resolutionType === 'release_funds') {
                action = "release";
            }

            const newStatus = (action === "refund" || action === "partial_refund") ? "resolved_refund" : action === "release" ? "resolved_release" : "closed";

            const { error: disputeError } = await supabase
                .from("disputes")
                .update({
                    status: newStatus,
                    resolved_at: new Date().toISOString(),
                    resolved_by: user?.id,
                    resolution_notes: resolutionNotes || null,
                })
                .eq("id", selectedDispute.id);
            if (disputeError) throw disputeError;

            if (action === "refund" || action === "partial_refund") {
                const { data: refundResult, error: refundError } = await supabase.functions.invoke("process-refund", {
                    body: {
                        orderId: selectedDispute.order_id,
                        disputeId: selectedDispute.id,
                        reason: selectedDispute.reason,
                        refundAmount: partialRefundAmt
                    },
                });
                if (refundError) throw new Error(refundError.message || "Failed to process refund");
                if (!refundResult?.success) throw new Error(refundResult?.error || "Refund processing failed");

                if (applyPenalty) {
                    await supabase.from("vendor_ratings").insert({
                        vendor_id: selectedDispute.vendor_id,
                        order_id: selectedDispute.order_id,
                        buyer_id: selectedDispute.customer_id, 
                        rating: 1,
                        review: "System generated penalty: Dispute resolved in favor of buyer due to defective/fake item or non-delivery."
                    });
                }

                toast({
                    title: action === "partial_refund" ? "Partial Refund Initiated" : "Full Refund Initiated",
                    description: refundResult.alreadyRefunded
                        ? "This payment was already refunded"
                        : "Refund has been initiated via IntaSend. Customer will receive funds shortly.",
                });
            } else if (action === "release") {
                await supabase
                    .from("escrow_transactions")
                    .update({ status: "released", released_at: new Date().toISOString() })
                    .eq("order_id", selectedDispute.order_id);
                await supabase
                    .from("orders")
                    .update({ status: "completed" })
                    .eq("id", selectedDispute.order_id);
                toast({ title: "Success", description: "Payment released to vendor" });
            } else {
                toast({ title: "Success", description: "Dispute closed" });
            }

            await supabase.functions.invoke("notify-dispute-update", {
                body: { disputeId: selectedDispute.id },
            });

            setShowResolutionDialog(false);
            setResolutionNotes("");
            setPartialAmount("");
            setResolutionType(null);
            
            setDisputes(prev => prev.map(d => 
                d.id === selectedDispute.id 
                    ? { ...d, status: newStatus, resolution_notes: resolutionNotes }
                    : d
            ));
            setSelectedDispute({ ...selectedDispute, status: newStatus, resolution_notes: resolutionNotes });
            
        } catch (error: any) {
            toast({ title: "Error", description: error.message || "Failed to resolve dispute", variant: "destructive" });
        } finally {
            setResolving(false);
        }
    };

    const filteredDisputes = disputes.filter(d => {
        if (filter === "all") return true;
        if (filter === "resolved") return d.status.startsWith("resolved");
        return d.status === filter;
    });

    const formatCurrency = (val: number) => `KES ${val.toLocaleString()}`;

    if (loading || !isAdmin) {
        return <SneakerLoader message="Loading disputes..." />;
    }

    return (
        <AdminLayout pageTitle="Disputes">
            {loadingData ? (
                <SneakerLoader message="Loading..." fullScreen={false} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    {/* Left Column - Dispute List */}
                    <div className="flex flex-col">
                        {/* Filter pills */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-3">
                            {[
                                { id: "all", label: "All" },
                                { id: "open", label: "Open" },
                                { id: "under_review", label: "In Review" },
                                { id: "resolved", label: "Resolved" }
                            ].map(f => (
                                <button 
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={cn(
                                        "flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                                        filter === f.id
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {filteredDisputes.length === 0 ? (
                            <div className="rounded-xl border border-border bg-card">
                                <EmptyState 
                                    icon={Scale} 
                                    title="No disputes yet" 
                                    subtitle="All clear — no open cases" 
                                />
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border bg-card divide-y divide-border">
                                {filteredDisputes.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => setSelectedDispute(d)}
                                        className={cn(
                                            "w-full flex items-start gap-2.5 px-4 py-3 text-left hover:bg-muted/40 transition-colors",
                                            selectedDispute?.id === d.id && "bg-muted/60"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5",
                                            d.status === "open" && "bg-destructive",
                                            d.status === "under_review" && "bg-primary",
                                            d.status.startsWith("resolved") && "bg-success",
                                        )} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs font-medium text-foreground truncate">
                                                    #{d.order_id.substring(0, 8)} · {d.reason.replace(/_/g, " ")}
                                                </p>
                                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                                    {formatDistanceToNow(new Date(d.opened_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                {d.customer?.full_name} vs {d.vendor?.store_name || d.vendor?.full_name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {formatCurrency(d.order?.total_ksh || 0)}
                                            </p>
                                        </div>
                                        <ChevronRight size={13} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0 mt-1 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Detail Panel */}
                    <div>
                        {selectedDispute ? (
                            <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col h-full md:max-h-[80vh]">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                                    <div>
                                        <p className="text-xs font-medium text-foreground">
                                            #{selectedDispute.order_id.substring(0, 8)} · {selectedDispute.reason.replace(/_/g, " ")}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            {selectedDispute.customer?.full_name} vs {selectedDispute.vendor?.store_name || selectedDispute.vendor?.full_name} · {formatCurrency(selectedDispute.order?.total_ksh || 0)}
                                        </p>
                                    </div>
                                    <StatusPill status={selectedDispute.status} />
                                </div>

                                {/* Chat thread */}
                                <div className="flex-1 min-h-[300px] flex flex-col">
                                    <DisputeChat disputeId={selectedDispute.id} currentUserRole="admin" currentUserId={user?.id || ""} />
                                </div>

                                {/* Resolution actions */}
                                {!selectedDispute.status.startsWith("resolved") && selectedDispute.status !== "closed" && (
                                    <div className="px-4 py-3 border-t border-border shrink-0">
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
                                            Resolution
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                            {[
                                                { icon: RefreshCw, label: "Full refund + penalize vendor", type: "full_refund_penalty" as const, color: "text-primary" },
                                                { icon: SplitSquareHorizontal, label: "Partial refund", type: "partial_refund" as const, color: "text-primary" },
                                                { icon: CheckCircle2, label: "Release funds to vendor", type: "release_funds" as const, color: "text-success" },
                                            ].map(action => (
                                                <button
                                                    key={action.label}
                                                    onClick={() => {
                                                        setResolutionType(action.type);
                                                        setShowResolutionDialog(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground text-left hover:bg-muted transition-colors w-full"
                                                >
                                                    <action.icon size={13} strokeWidth={1.5} className={action.color} />
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border bg-card h-full">
                                <EmptyState 
                                    icon={Scale}
                                    title="Select a dispute"
                                    subtitle="Click on a dispute from the list to view details"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Resolution Dialog */}
            <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {resolutionType === 'full_refund_penalty' && "Issue Full Refund & Penalize"}
                            {resolutionType === 'partial_refund' && "Issue Partial Refund"}
                            {resolutionType === 'release_funds' && "Release Funds to Vendor"}
                        </DialogTitle>
                        <DialogDescription>
                            {resolutionType === 'full_refund_penalty' && "The buyer will receive a full refund via IntaSend. The vendor will receive a 1-star penalty rating automatically."}
                            {resolutionType === 'partial_refund' && "Specify how much should be refunded to the buyer. The remaining balance will be released to the vendor."}
                            {resolutionType === 'release_funds' && "The dispute will be closed in favor of the vendor. The full payment will be released to their account."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {resolutionType === 'partial_refund' && (
                            <div className="space-y-2">
                                <Label>Refund Amount (KES)</Label>
                                <Input 
                                    type="number" 
                                    placeholder={`Max: ${selectedDispute?.order?.total_ksh}`}
                                    value={partialAmount}
                                    onChange={e => setPartialAmount(e.target.value)}
                                    max={selectedDispute?.order?.total_ksh}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Resolution Notes (Internal)</Label>
                            <Textarea 
                                placeholder="Explain why this decision was made..."
                                value={resolutionNotes}
                                onChange={e => setResolutionNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowResolutionDialog(false)}>Cancel</Button>
                        <Button 
                            variant="default"
                            onClick={handleResolve}
                            disabled={resolving || (resolutionType === 'partial_refund' && !partialAmount)}
                        >
                            {resolving ? "Processing..." : "Confirm Resolution"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
};

export default AdminDisputes;
