import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Mail, CheckCircle, XCircle, Eye, RefreshCw } from "lucide-react";
import { SneakerLoader } from "@/components/ui/SneakerLoader";

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
    buyer_evidence_urls: string[] | null;
    vendor_evidence_urls: string[] | null;
    vendor_response: string | null;
    vendor_response_at: string | null;
    // Joined data
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
    const [detailOpen, setDetailOpen] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [resolutionNotes, setResolutionNotes] = useState("");
    const [activeTab, setActiveTab] = useState("open");

    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) {
                navigate("/auth");
                return;
            }

            const { data } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .eq("role", "admin")
                .single();

            if (!data) {
                navigate("/");
                toast({
                    title: "Access Denied",
                    description: "You don't have permission to access this page",
                    variant: "destructive",
                });
                return;
            }

            setIsAdmin(true);
            loadDisputes();
        };

        if (!loading) {
            checkAdmin();
        }
    }, [user, loading, navigate]);

    const loadDisputes = async () => {
        setLoadingData(true);
        try {
            const { data, error } = await supabase
                .from("disputes")
                .select(`
          *,
          customer:customer_id (full_name, email),
          vendor:vendor_id (full_name, email, store_name),
          order:order_id (total_ksh, created_at)
        `)
                .order("opened_at", { ascending: false });

            if (error) throw error;
            setDisputes((data as any[]) || []);
        } catch (error) {
            console.error("Error loading disputes:", error);
            toast({
                title: "Error",
                description: "Failed to load disputes",
                variant: "destructive",
            });
        } finally {
            setLoadingData(false);
        }
    };

    const handleResolve = async (action: "refund" | "release" | "close") => {
        if (!selectedDispute) return;

        setResolving(true);
        try {
            const newStatus =
                action === "refund" ? "resolved_refund" :
                    action === "release" ? "resolved_release" : "closed";

            // 1. Update dispute
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

            // 2. Process based on action
            if (action === "refund") {
                // Call process-refund Edge Function to initiate IntaSend refund
                const { data: refundResult, error: refundError } = await supabase.functions.invoke("process-refund", {
                    body: {
                        orderId: selectedDispute.order_id,
                        disputeId: selectedDispute.id,
                        reason: selectedDispute.reason,
                    },
                });

                if (refundError) {
                    console.error("Refund error:", refundError);
                    throw new Error(refundError.message || "Failed to process refund");
                }

                if (!refundResult?.success) {
                    throw new Error(refundResult?.error || "Refund processing failed");
                }

                // Note: process-refund already updates escrow and order status
                toast({
                    title: "Refund Initiated",
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

                toast({
                    title: "Success",
                    description: "Payment released to vendor",
                });
            } else {
                toast({
                    title: "Success",
                    description: "Dispute closed",
                });
            }

            // 3. Send email notification
            await supabase.functions.invoke("notify-dispute-update", {
                body: { disputeId: selectedDispute.id },
            });

            setDetailOpen(false);
            setSelectedDispute(null);
            setResolutionNotes("");
            loadDisputes();
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to resolve dispute",
                variant: "destructive",
            });
        } finally {
            setResolving(false);
        }
    };

    const formatReason = (reason: string) => {
        const labels: Record<string, string> = {
            no_delivery: "Did not receive",
            wrong_item: "Wrong item",
            damaged: "Damaged",
            other: "Other",
        };
        return labels[reason] || reason;
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            open: "bg-red-500",
            under_review: "bg-yellow-500",
            resolved_refund: "bg-blue-500",
            resolved_release: "bg-green-500",
            closed: "bg-gray-500",
        };
        return colors[status] || "bg-gray-400";
    };

    const formatStatus = (status: string) => {
        return status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    };

    const filteredDisputes = disputes.filter(d => {
        if (activeTab === "open") return d.status === "open" || d.status === "under_review";
        if (activeTab === "resolved") return d.status.startsWith("resolved");
        return d.status === "closed";
    });

    if (loading || !isAdmin) {
        return <SneakerLoader message="Loading disputes..." />;
    }

    return (
        <div className="min-h-screen bg-background">
            <VendorNavbar />
            <main className="container mx-auto p-6 lg:p-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Dispute Management</h1>
                        <p className="text-muted-foreground">Review and resolve customer disputes</p>
                    </div>
                    <Button variant="outline" onClick={loadDisputes} disabled={loadingData}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingData ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border-red-500/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Open Disputes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {disputes.filter(d => d.status === "open").length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-yellow-500/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Under Review</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-yellow-600">
                                {disputes.filter(d => d.status === "under_review").length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {disputes.filter(d => d.status.startsWith("resolved")).length}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Total</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{disputes.length}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="open">
                            Open ({disputes.filter(d => d.status === "open" || d.status === "under_review").length})
                        </TabsTrigger>
                        <TabsTrigger value="resolved">Resolved</TabsTrigger>
                        <TabsTrigger value="closed">Closed</TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab}>
                        <Card>
                            <CardContent className="pt-6">
                                {loadingData ? (
                                    <SneakerLoader message="Loading disputes..." size="sm" fullScreen={false} />
                                ) : filteredDisputes.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No {activeTab} disputes
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Order</TableHead>
                                                <TableHead>Customer</TableHead>
                                                <TableHead>Vendor</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Opened</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredDisputes.map((dispute) => (
                                                <TableRow key={dispute.id}>
                                                    <TableCell className="font-mono">
                                                        #{dispute.order_id.slice(0, 8)}
                                                        {dispute.order && (
                                                            <div className="text-xs text-muted-foreground">
                                                                KES {dispute.order.total_ksh?.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>{dispute.customer?.full_name || "N/A"}</div>
                                                        <div className="text-xs text-muted-foreground">{dispute.customer?.email}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>{dispute.vendor?.store_name || dispute.vendor?.full_name || "N/A"}</div>
                                                        <div className="text-xs text-muted-foreground">{dispute.vendor?.email}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{formatReason(dispute.reason)}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={`${getStatusColor(dispute.status)} text-white border-0`}>
                                                            {formatStatus(dispute.status)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {new Date(dispute.opened_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setSelectedDispute(dispute);
                                                                setDetailOpen(true);
                                                            }}
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            View
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Detail Modal */}
                <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                Dispute Details
                            </DialogTitle>
                            <DialogDescription>
                                Order #{selectedDispute?.order_id.slice(0, 8)} • Opened {selectedDispute && new Date(selectedDispute.opened_at).toLocaleDateString()}
                            </DialogDescription>
                        </DialogHeader>

                        {selectedDispute && (
                            <div className="space-y-6">
                                {/* Status */}
                                <div className="flex items-center gap-2">
                                    <Badge className={`${getStatusColor(selectedDispute.status)} text-white border-0`}>
                                        {formatStatus(selectedDispute.status)}
                                    </Badge>
                                    <Badge variant="outline">{formatReason(selectedDispute.reason)}</Badge>
                                </div>

                                {/* Customer & Vendor Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Customer</CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm">
                                            <p className="font-medium">{selectedDispute.customer?.full_name}</p>
                                            <p className="text-muted-foreground">{selectedDispute.customer?.email}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm">Vendor</CardTitle>
                                        </CardHeader>
                                        <CardContent className="text-sm">
                                            <p className="font-medium">{selectedDispute.vendor?.store_name || selectedDispute.vendor?.full_name}</p>
                                            <p className="text-muted-foreground">{selectedDispute.vendor?.email}</p>
                                            {selectedDispute.vendor?.email && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="mt-2"
                                                    asChild
                                                >
                                                    <a href={`mailto:${selectedDispute.vendor.email}?subject=Dispute%20%23${selectedDispute.order_id.slice(0, 8)}&body=Dear%20Vendor,%0A%0ARegarding%20order%20%23${selectedDispute.order_id.slice(0, 8)}...`}>
                                                        <Mail className="h-4 w-4 mr-1" />
                                                        Email Vendor
                                                    </a>
                                                </Button>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Order Amount */}
                                {selectedDispute.order && (
                                    <div className="bg-muted p-4 rounded-lg">
                                        <p className="text-sm text-muted-foreground">Order Amount</p>
                                        <p className="text-xl font-bold">KES {selectedDispute.order.total_ksh?.toLocaleString()}</p>
                                    </div>
                                )}

                                {/* Description */}
                                <div>
                                    <Label className="text-sm font-medium">Customer Description</Label>
                                    <p className="mt-1 p-3 bg-muted rounded-lg text-sm">
                                        {selectedDispute.description || "No description provided"}
                                    </p>
                                </div>

                                {/* Buyer Evidence Section */}
                                {selectedDispute.buyer_evidence_urls && selectedDispute.buyer_evidence_urls.length > 0 && (
                                    <div className="border-t pt-4">
                                        <Label className="text-sm font-medium">Buyer Evidence</Label>
                                        <p className="text-xs text-muted-foreground mt-1 mb-2">
                                            Buyer submitted {selectedDispute.buyer_evidence_urls.length} evidence file(s)
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedDispute.buyer_evidence_urls.map((url, idx) => (
                                                <a
                                                    key={idx}
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block"
                                                >
                                                    {/\.(jpg|jpeg|png|gif|webp)/i.test(url) ? (
                                                        <img
                                                            src={url}
                                                            alt={`Buyer Evidence ${idx + 1}`}
                                                            className="w-full h-32 object-cover rounded-lg border hover:border-primary transition-colors"
                                                        />
                                                    ) : (
                                                        <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors">
                                                            <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                                            <span className="text-sm">View Evidence {idx + 1}</span>
                                                        </div>
                                                    )}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Vendor Response Section */}
                                <div className="border-t pt-4">
                                    <Label className="text-sm font-medium">Vendor Response</Label>
                                    {selectedDispute.vendor_response ? (
                                        <div className="mt-2 space-y-3">
                                            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                                    <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                                        Vendor Responded {selectedDispute.vendor_response_at &&
                                                            `on ${new Date(selectedDispute.vendor_response_at).toLocaleDateString()}`}
                                                    </span>
                                                </div>
                                                <p className="text-sm">{selectedDispute.vendor_response}</p>
                                            </div>
                                            {selectedDispute.vendor_evidence_urls && selectedDispute.vendor_evidence_urls.length > 0 && (
                                                <>
                                                    <p className="text-xs text-muted-foreground">
                                                        Vendor submitted {selectedDispute.vendor_evidence_urls.length} evidence file(s)
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {selectedDispute.vendor_evidence_urls.map((url, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="block"
                                                            >
                                                                {/\.(jpg|jpeg|png|gif|webp)/i.test(url) ? (
                                                                    <img
                                                                        src={url}
                                                                        alt={`Vendor Evidence ${idx + 1}`}
                                                                        className="w-full h-32 object-cover rounded-lg border hover:border-primary transition-colors"
                                                                    />
                                                                ) : (
                                                                    <div className="p-4 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors">
                                                                        <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                                                        <span className="text-sm">View Evidence {idx + 1}</span>
                                                                    </div>
                                                                )}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="mt-2 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                                ⚠️ Vendor has not yet submitted a response.
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Consider contacting the vendor via email before making a decision.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Resolution Actions */}
                                {(selectedDispute.status === "open" || selectedDispute.status === "under_review") && (
                                    <div className="border-t pt-6 space-y-4">
                                        <div className="bg-muted/30 p-4 rounded-lg border border-border">
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <Mail className="h-4 w-4" />
                                                Step 1: Communication
                                            </h3>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Communicate with both parties before making a final decision.
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Button variant="outline" className="h-auto py-3 flex flex-col items-center justify-center gap-1 hover:bg-primary/5 hover:text-primary border-dashed" asChild>
                                                    <a href={`mailto:${selectedDispute.customer?.email}?subject=Dispute Update for Order #${selectedDispute.order_id.slice(0, 8)}&body=Dear ${selectedDispute.customer?.full_name},%0A%0ARegarding your dispute for order #${selectedDispute.order_id.slice(0, 8)}...`}>
                                                        <span className="font-medium flex items-center gap-2 text-sm"><Mail className="h-3 w-3" /> Email Customer</span>
                                                        <span className="text-xs text-muted-foreground">{selectedDispute.customer?.email}</span>
                                                    </a>
                                                </Button>
                                                <Button variant="outline" className="h-auto py-3 flex flex-col items-center justify-center gap-1 hover:bg-primary/5 hover:text-primary border-dashed" asChild>
                                                    <a href={`mailto:${selectedDispute.vendor?.email}?subject=Dispute Inquiry for Order #${selectedDispute.order_id.slice(0, 8)}&body=Dear ${selectedDispute.vendor?.store_name || "Vendor"},%0A%0ARegarding the dispute for order #${selectedDispute.order_id.slice(0, 8)}...`}>
                                                        <span className="font-medium flex items-center gap-2 text-sm"><Mail className="h-3 w-3" /> Email Vendor</span>
                                                        <span className="text-xs text-muted-foreground">{selectedDispute.vendor?.email}</span>
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                                <CheckCircle className="h-4 w-4" />
                                                Step 2: Final Resolution
                                            </h3>
                                            <div className="mb-4">
                                                <Label htmlFor="notes" className="mb-1 block">Resolution Notes (Required for decision)</Label>
                                                <Textarea
                                                    id="notes"
                                                    placeholder="Explain your decision. This will be saved in the dispute record."
                                                    value={resolutionNotes}
                                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                                    rows={3}
                                                    className="resize-none"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => handleResolve("refund")}
                                                    disabled={resolving || !resolutionNotes.trim()}
                                                    className="h-auto py-4 flex flex-col gap-1"
                                                >
                                                    <div className="flex items-center gap-2 font-bold text-base">
                                                        <XCircle className="h-5 w-5" />
                                                        Refund Customer
                                                    </div>
                                                    <span className="text-xs opacity-90 font-normal">
                                                        Return funds to buyer & close dispute
                                                    </span>
                                                </Button>

                                                <Button
                                                    className="bg-green-600 hover:bg-green-700 h-auto py-4 flex flex-col gap-1"
                                                    onClick={() => handleResolve("release")}
                                                    disabled={resolving || !resolutionNotes.trim()}
                                                >
                                                    <div className="flex items-center gap-2 font-bold text-base">
                                                        <CheckCircle className="h-5 w-5" />
                                                        Release to Vendor
                                                    </div>
                                                    <span className="text-xs opacity-90 font-normal">
                                                        Pay vendor & close dispute
                                                    </span>
                                                </Button>
                                            </div>
                                            {!resolutionNotes.trim() && (
                                                <p className="text-xs text-center text-muted-foreground mt-2">
                                                    Please enter resolution notes to enable the decision buttons.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Resolution Info (if resolved) */}
                                {selectedDispute.resolved_at && (
                                    <div className="border-t pt-4">
                                        <p className="text-sm text-muted-foreground">
                                            Resolved on {new Date(selectedDispute.resolved_at).toLocaleDateString()}
                                        </p>
                                        {selectedDispute.resolution_notes && (
                                            <p className="mt-2 p-3 bg-muted rounded-lg text-sm">
                                                {selectedDispute.resolution_notes}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
};

export default AdminDisputes;

