import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
    ChevronRight, SplitSquareHorizontal, XCircle, AlertTriangle
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
    buyer_evidence_urls?: string[] | null;
    vendor_evidence_urls?: string[] | null;
    vendor_response?: string | null;
    vendor_response_at?: string | null;
    customer?: { full_name: string; email: string };
    vendor?: { full_name: string; email: string; store_name: string };
    order?: { total_ksh: number; created_at: string };
}

type ResolutionType = 'full_refund_penalty' | 'partial_refund' | 'release_funds' | 'close_dismiss';

const AdminDisputes = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [searchParams] = useSearchParams();
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
    const [resolving, setResolving] = useState(false);
    const [resolutionNotes, setResolutionNotes] = useState("");
    const [filter, setFilter] = useState("all");
    const [showResolutionDialog, setShowResolutionDialog] = useState(false);
    const [resolutionType, setResolutionType] = useState<ResolutionType | null>(null);
    const [partialAmount, setPartialAmount] = useState("");
    const [priorDisputeCount, setPriorDisputeCount] = useState<number | null>(null);

    useEffect(() => {
        loadDisputes();
    }, []);

    useEffect(() => {
        if (!selectedDispute) {
            setPriorDisputeCount(null);
            return;
        }
        setPriorDisputeCount(null);
        supabase
            .from("disputes")
            .select("*", { count: "exact", head: true })
            .eq("vendor_id", selectedDispute.vendor_id)
            .neq("id", selectedDispute.id)
            .then(({ count }) => setPriorDisputeCount(count ?? 0));
    }, [selectedDispute?.id, selectedDispute?.vendor_id]);

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

            const disputeIdParam = searchParams.get("dispute");
            if (disputeIdParam) {
                const match = (data as any)?.find((d: Dispute) => d.id === disputeIdParam);
                if (match) setSelectedDispute(match);
            }
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
            const actionMap: Record<ResolutionType, "refund" | "release" | "close" | "partial_refund"> = {
                full_refund_penalty: "refund",
                partial_refund: "partial_refund",
                release_funds: "release",
                close_dismiss: "close",
            };
            const action = actionMap[resolutionType];

            let partialRefundAmt: number | undefined;
            if (action === "partial_refund") {
                partialRefundAmt = parseFloat(partialAmount);
                if (isNaN(partialRefundAmt) || partialRefundAmt <= 0) {
                    throw new Error("Invalid partial refund amount");
                }
            }

            const { data, error } = await supabase.functions.invoke("resolve-dispute", {
                body: {
                    disputeId: selectedDispute.id,
                    action,
                    partialRefundAmount: partialRefundAmt,
                    applyVendorPenalty: action === "refund",
                    resolutionNotes: resolutionNotes || undefined,
                },
            });

            if (error) {
                let msg = error.message;
                if (error.context && typeof error.context.json === "function") {
                    try {
                        const errJson = await error.context.json();
                        if (errJson?.error) msg = errJson.error;
                    } catch (_) { /* ignore */ }
                }
                throw new Error(msg);
            }
            if (!data?.success) throw new Error(data?.error || "Failed to resolve dispute");

            const messages: Record<string, string> = {
                resolved_refund: action === "partial_refund"
                    ? "Buyer refunded and vendor's remaining share released."
                    : "Refund initiated via IntaSend.",
                resolved_release: "Payment released to vendor.",
                closed: "Dispute dismissed - order restored to its prior status.",
            };
            toast({ title: "Success", description: messages[data.disputeStatus] || "Dispute resolved" });

            setShowResolutionDialog(false);
            setResolutionNotes("");
            setPartialAmount("");
            setResolutionType(null);

            setDisputes(prev => prev.map(d =>
                d.id === selectedDispute.id
                    ? { ...d, status: data.disputeStatus, resolution_notes: resolutionNotes }
                    : d
            ));
            setSelectedDispute({ ...selectedDispute, status: data.disputeStatus, resolution_notes: resolutionNotes });

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
                                        {priorDisputeCount !== null && priorDisputeCount > 0 && (
                                            <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-0.5 flex items-center gap-1">
                                                <AlertTriangle size={11} strokeWidth={2} />
                                                {priorDisputeCount} other dispute{priorDisputeCount === 1 ? "" : "s"} involving this vendor
                                            </p>
                                        )}
                                    </div>
                                    <StatusPill status={selectedDispute.status} />
                                </div>

                                {/* Evidence & vendor response */}
                                {(selectedDispute.buyer_evidence_urls?.length || selectedDispute.vendor_evidence_urls?.length || selectedDispute.vendor_response) && (
                                    <div className="px-4 py-3 border-b border-border shrink-0 space-y-3">
                                        {selectedDispute.buyer_evidence_urls && selectedDispute.buyer_evidence_urls.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
                                                    Buyer evidence
                                                </p>
                                                <div className="flex gap-1.5 overflow-x-auto">
                                                    {selectedDispute.buyer_evidence_urls.map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                            <img src={url} alt={`Buyer evidence ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedDispute.vendor_evidence_urls && selectedDispute.vendor_evidence_urls.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">
                                                    Vendor evidence
                                                </p>
                                                <div className="flex gap-1.5 overflow-x-auto">
                                                    {selectedDispute.vendor_evidence_urls.map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                                            <img src={url} alt={`Vendor evidence ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selectedDispute.vendor_response && (
                                            <div>
                                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1">
                                                    Vendor's response
                                                    {selectedDispute.vendor_response_at && (
                                                        <span className="normal-case font-normal"> · {formatDistanceToNow(new Date(selectedDispute.vendor_response_at), { addSuffix: true })}</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-foreground bg-muted/50 rounded-lg p-2.5">
                                                    {selectedDispute.vendor_response}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

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
                                                { icon: XCircle, label: "Close / Dismiss (no action)", type: "close_dismiss" as const, color: "text-muted-foreground" },
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
                            {resolutionType === 'close_dismiss' && "Close / Dismiss Dispute"}
                        </DialogTitle>
                        <DialogDescription>
                            {resolutionType === 'full_refund_penalty' && "The buyer will receive a full refund via IntaSend. The vendor will receive a 1-star penalty rating automatically."}
                            {resolutionType === 'partial_refund' && "Specify how much should be refunded to the buyer. The remaining balance will be released to the vendor automatically."}
                            {resolutionType === 'release_funds' && "The dispute will be closed in favor of the vendor. The full payment will be released to their account."}
                            {resolutionType === 'close_dismiss' && "No money moves either way. The order returns to the status it had before this dispute was filed, and continues normally from there."}
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
