import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
    AlertTriangle, Eye, MessageSquare, Upload, RefreshCw, Clock,
    ShieldAlert, CheckCircle2, CircleDot, ArrowRight, ImageIcon,
    FileText, X, Sparkles, Scale
} from "lucide-react";
import { toast } from "sonner";

interface Dispute {
    id: string;
    order_id: string;
    reason: string;
    description: string;
    status: string;
    opened_at: string;
    resolved_at: string | null;
    resolution_notes: string | null;
    vendor_evidence_urls: string[] | null;
    vendor_response: string | null;
    vendor_response_at: string | null;
    order?: { total_ksh: number; created_at: string };
}

/* ─── Timeline Step Indicator ────────────────────────────────────── */
const DisputeTimeline = ({ dispute }: { dispute: Dispute }) => {
    const steps = [
        { key: "opened", label: "Opened", icon: CircleDot, done: true },
        {
            key: "responded",
            label: "You Responded",
            icon: MessageSquare,
            done: !!dispute.vendor_response,
        },
        {
            key: "review",
            label: "Admin Review",
            icon: Scale,
            done: dispute.status === "under_review" || dispute.status.startsWith("resolved") || dispute.status === "closed",
        },
        {
            key: "resolved",
            label: "Resolved",
            icon: CheckCircle2,
            done: dispute.status.startsWith("resolved") || dispute.status === "closed",
        },
    ];

    return (
        <div className="flex items-center justify-between w-full py-4">
            {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive =
                    !step.done &&
                    (idx === 0 || steps[idx - 1].done);
                return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-initial">
                        <div className="flex flex-col items-center gap-1.5">
                            <div
                                className={`
                                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                                    ${step.done
                                        ? "bg-green-500/15 text-green-600 dark:text-green-400 ring-2 ring-green-500/30"
                                        : isActive
                                            ? "bg-primary/15 text-primary ring-2 ring-primary/40 animate-pulse"
                                            : "bg-muted text-muted-foreground"
                                    }
                                `}
                            >
                                <Icon className="h-4.5 w-4.5" />
                            </div>
                            <span className={`text-[11px] font-medium text-center leading-tight max-w-[72px] ${step.done ? "text-green-600 dark:text-green-400" : isActive ? "text-primary" : "text-muted-foreground"}`}>
                                {step.label}
                            </span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className={`flex-1 h-[2px] mx-2 mt-[-18px] rounded-full transition-all duration-500 ${steps[idx + 1].done || (isActive && idx === steps.findIndex(s => !s.done) - 1) ? "bg-green-500/40" : "bg-border"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/* ─── Evidence Lightbox ──────────────────────────────────────────── */
const EvidenceLightbox = ({ urls, onClose }: { urls: string[]; onClose: () => void }) => {
    const [current, setCurrent] = useState(0);
    if (!urls.length) return null;
    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black/95 border-0">
                <div className="relative min-h-[400px] flex items-center justify-center">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 text-white/70 hover:text-white z-10"
                        onClick={onClose}
                    >
                        <X size={20} strokeWidth={1.5}  />
                    </Button>
                    {/\.(jpg|jpeg|png|gif|webp)/i.test(urls[current]) ? (
                        <img
                            src={urls[current]}
                            alt={`Evidence ${current + 1}`}
                            className="max-h-[70vh] max-w-full object-contain"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-3 text-white/60">
                            <FileText strokeWidth={1.5} className="h-16 w-16" />
                            <a href={urls[current]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                Open File
                            </a>
                        </div>
                    )}
                    {urls.length > 1 && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                            {urls.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrent(i)}
                                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-white scale-125" : "bg-white/40 hover:bg-white/60"}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

/* ─── Main Component ─────────────────────────────────────────────── */
const VendorDisputes = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [responseOpen, setResponseOpen] = useState(false);
    const [response, setResponse] = useState("");
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState("open");
    const [lightboxUrls, setLightboxUrls] = useState<string[] | null>(null);

    useEffect(() => {
        if (!loading && !user) navigate("/auth");
    }, [user, loading, navigate]);

    useEffect(() => {
        if (user) loadDisputes();
    }, [user]);

    const loadDisputes = async () => {
        setLoadingData(true);
        try {
            const { data, error } = await supabase
                .from("disputes")
                .select(`*, order:order_id (total_ksh, created_at)`)
                .eq("vendor_id", user?.id)
                .order("opened_at", { ascending: false });
            if (error) throw error;
            setDisputes((data as any[]) || []);
        } catch (error) {
            console.error("Error loading disputes:", error);
        } finally {
            setLoadingData(false);
        }
    };

    const handleSubmitResponse = async () => {
        if (!selectedDispute || !response.trim()) {
            toast.error("Please enter a response");
            return;
        }
        setSubmitting(true);
        try {
            const uploadedUrls: string[] = [];
            if (evidenceFiles.length > 0) {
                for (const file of evidenceFiles) {
                    const fileName = `${Date.now()}-${file.name}`;
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from("dispute-evidence")
                        .upload(`vendor/${selectedDispute.id}/${fileName}`, file);
                    if (uploadError) {
                        console.warn("Upload error:", uploadError);
                    } else if (uploadData) {
                        const { data: urlData } = supabase.storage
                            .from("dispute-evidence")
                            .getPublicUrl(uploadData.path);
                        uploadedUrls.push(urlData.publicUrl);
                    }
                }
            }

            const existingNotes = selectedDispute.resolution_notes || "";
            const vendorResponseText = `[VENDOR RESPONSE - ${new Date().toLocaleDateString()}]\n${response}\n${uploadedUrls.length > 0 ? `\nEvidence: ${uploadedUrls.join(", ")}` : ""}`;

            const { error } = await supabase
                .from("disputes")
                .update({
                    vendor_response: response,
                    vendor_response_at: new Date().toISOString(),
                    vendor_evidence_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
                    resolution_notes: existingNotes
                        ? `${existingNotes}\n\n---\n\n${vendorResponseText}`
                        : vendorResponseText,
                    status: "under_review",
                })
                .eq("id", selectedDispute.id);

            if (error) throw error;

            toast.success("Response submitted! Admin will review your case.");
            setResponseOpen(false);
            setResponse("");
            setEvidenceFiles([]);
            setSelectedDispute(null);
            loadDisputes();
        } catch (error: any) {
            console.error("Submit error:", error);
            toast.error(error.message || "Failed to submit response");
        } finally {
            setSubmitting(false);
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

    const getStatusConfig = (status: string) => {
        const map: Record<string, { color: string; bg: string; label: string }> = {
            open: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Needs Response" },
            under_review: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Under Review" },
            resolved_refund: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Refunded" },
            resolved_release: { color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "Released" },
            closed: { color: "text-gray-500", bg: "bg-gray-500/10 border-gray-500/20", label: "Closed" },
        };
        return map[status] || { color: "text-gray-500", bg: "bg-gray-500/10 border-gray-500/20", label: status };
    };

    const filteredDisputes = disputes.filter((d) => {
        if (activeTab === "open") return d.status === "open" || d.status === "under_review";
        return d.status.startsWith("resolved") || d.status === "closed";
    });

    const openCount = disputes.filter((d) => d.status === "open").length;
    const reviewCount = disputes.filter((d) => d.status === "under_review").length;
    const resolvedCount = disputes.filter((d) => d.status.startsWith("resolved")).length;

    if (loading) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
            <VendorNavbar />
            <div className="flex">
                <VendorSidebar />
                <main className="flex-1 p-4 md:p-8 max-w-[1400px]">
                    {/* Header */}
                    <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/10">
                                    <ShieldAlert size={24} strokeWidth={1.5} className=" text-red-500" />
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Disputes</h1>
                            </div>
                            <p className="text-muted-foreground ml-[52px]">
                                View and respond to customer complaints
                            </p>
                        </div>
                        <Button variant="outline" onClick={loadDisputes} disabled={loadingData} className="gap-2 shrink-0">
                            <RefreshCw size={16} strokeWidth={1.5} className={` ${loadingData ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>

                    {/* Alert Banner */}
                    {openCount > 0 && (
                        <div className="mb-6 relative overflow-hidden rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/5 via-red-500/10 to-orange-500/5 p-4 md:p-5">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.08),transparent_70%)]" />
                            <div className="relative flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-red-500/10 shrink-0">
                                    <AlertTriangle size={20} strokeWidth={1.5} className=" text-red-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-red-700 dark:text-red-300">
                                        Action Required — {openCount} open dispute{openCount > 1 ? "s" : ""}
                                    </h3>
                                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                                        Please respond with your side of the story and any evidence you have. Unresponded disputes may be resolved in the buyer's favor.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                        {[
                            { label: "Needs Response", value: openCount, icon: AlertTriangle, gradient: "from-red-500/10 to-rose-500/5", iconColor: "text-red-500", valueColor: "text-red-600 dark:text-red-400", ring: "ring-red-500/10" },
                            { label: "Under Review", value: reviewCount, icon: Clock, gradient: "from-amber-500/10 to-yellow-500/5", iconColor: "text-amber-500", valueColor: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/10" },
                            { label: "Resolved", value: resolvedCount, icon: CheckCircle2, gradient: "from-green-500/10 to-emerald-500/5", iconColor: "text-green-500", valueColor: "text-green-600 dark:text-green-400", ring: "ring-green-500/10" },
                            { label: "Total", value: disputes.length, icon: Scale, gradient: "from-primary/10 to-primary/5", iconColor: "text-primary", valueColor: "text-foreground", ring: "ring-primary/10" },
                        ].map(({ label, value, icon: Icon, gradient, iconColor, valueColor, ring }) => (
                            <Card key={label} className={`relative overflow-hidden border-0 shadow-sm ring-1 ${ring}`}>
                                <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                                <CardContent className="relative p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                                        <Icon className={`h-4 w-4 ${iconColor}`} />
                                    </div>
                                    <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="open" className="gap-2">
                                Active
                                {(openCount + reviewCount) > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white leading-none">
                                        {openCount + reviewCount}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="resolved">Resolved / Closed</TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab}>
                            {loadingData ? (
                                <Card>
                                    <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                                        <RefreshCw strokeWidth={1.5} className="h-8 w-8 animate-spin text-muted-foreground" />
                                        <p className="text-muted-foreground">Loading disputes…</p>
                                    </CardContent>
                                </Card>
                            ) : filteredDisputes.length === 0 ? (
                                <Card className="border-dashed">
                                    <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                                        <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5">
                                            <Sparkles strokeWidth={1.5} className="h-10 w-10 text-green-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg mb-1">
                                                {activeTab === "open" ? "No active disputes" : "No resolved disputes yet"}
                                            </h3>
                                            <p className="text-sm text-muted-foreground max-w-sm">
                                                {activeTab === "open"
                                                    ? "You're all clear! Keep delivering great products and service. 🎉"
                                                    : "Resolved disputes will appear here for your records."
                                                }
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-3">
                                    {filteredDisputes.map((dispute) => {
                                        const config = getStatusConfig(dispute.status);
                                        return (
                                            <Card
                                                key={dispute.id}
                                                className={`group hover:shadow-md transition-all duration-200 border ${dispute.status === "open" ? "border-red-500/20 bg-red-500/[0.02]" : ""}`}
                                            >
                                                <CardContent className="p-4 md:p-5">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        {/* Left: Info */}
                                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                                            <div className={`p-2.5 rounded-xl shrink-0 border ${config.bg}`}>
                                                                {dispute.status === "open" ? (
                                                                    <AlertTriangle size={20} strokeWidth={1.5} className={` ${config.color}`} />
                                                                ) : dispute.status === "under_review" ? (
                                                                    <Clock size={20} strokeWidth={1.5} className={` ${config.color}`} />
                                                                ) : (
                                                                    <CheckCircle2 size={20} strokeWidth={1.5} className={` ${config.color}`} />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                    <span className="font-mono text-sm font-semibold">
                                                                        #{dispute.order_id.slice(0, 8)}
                                                                    </span>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {formatReason(dispute.reason)}
                                                                    </Badge>
                                                                    <Badge className={`text-xs border ${config.bg} ${config.color} hover:opacity-90`}>
                                                                        {config.label}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-sm text-muted-foreground truncate">
                                                                    {dispute.description || "No description provided"}
                                                                </p>
                                                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock strokeWidth={1.5} className="h-3 w-3" />
                                                                        {new Date(dispute.opened_at).toLocaleDateString()}
                                                                    </span>
                                                                    {dispute.order && (
                                                                        <span className="font-medium">
                                                                            KES {dispute.order.total_ksh?.toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Actions */}
                                                        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="gap-1.5"
                                                                onClick={() => {
                                                                    setSelectedDispute(dispute);
                                                                    setDetailOpen(true);
                                                                }}
                                                            >
                                                                <Eye size={14} strokeWidth={1.5}  />
                                                                View
                                                            </Button>
                                                            {dispute.status === "open" && (
                                                                <Button
                                                                    size="sm"
                                                                    className="gap-1.5 bg-gradient-to-r from-primary to-primary/90"
                                                                    onClick={() => {
                                                                        setSelectedDispute(dispute);
                                                                        setResponseOpen(true);
                                                                    }}
                                                                >
                                                                    <MessageSquare size={14} strokeWidth={1.5}  />
                                                                    Respond
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* ─── Detail Modal ──────────────────────────────── */}
                    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                        <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-red-500/10">
                                        <ShieldAlert size={20} strokeWidth={1.5} className=" text-red-500" />
                                    </div>
                                    Dispute Details
                                </DialogTitle>
                                <DialogDescription>
                                    Order #{selectedDispute?.order_id.slice(0, 8)}
                                </DialogDescription>
                            </DialogHeader>

                            {selectedDispute && (
                                <div className="space-y-5">
                                    {/* Timeline */}
                                    <div className="bg-muted/30 rounded-xl p-4 border">
                                        <DisputeTimeline dispute={selectedDispute} />
                                    </div>

                                    {/* Status + Reason */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {(() => {
                                            const c = getStatusConfig(selectedDispute.status);
                                            return (
                                                <Badge className={`border ${c.bg} ${c.color}`}>
                                                    {c.label}
                                                </Badge>
                                            );
                                        })()}
                                        <Badge variant="outline">{formatReason(selectedDispute.reason)}</Badge>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                                            <Clock strokeWidth={1.5} className="h-3 w-3" />
                                            {new Date(selectedDispute.opened_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {/* Order Amount */}
                                    {selectedDispute.order && (
                                        <div className="bg-gradient-to-r from-muted/60 to-muted/30 p-4 rounded-xl border flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground">Order Amount</span>
                                            <span className="text-xl font-bold">
                                                KES {selectedDispute.order.total_ksh?.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Customer Complaint */}
                                    <div>
                                        <Label className="text-sm font-medium mb-2 block">Customer's Complaint</Label>
                                        <div className="relative p-4 rounded-xl bg-red-500/5 border border-red-500/15">
                                            <div className="absolute top-3 right-3">
                                                <AlertTriangle size={16} strokeWidth={1.5} className=" text-red-400/50" />
                                            </div>
                                            <p className="text-sm leading-relaxed pr-6">
                                                {selectedDispute.description || "No description provided"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Your Response */}
                                    {selectedDispute.vendor_response && (
                                        <div>
                                            <Label className="text-sm font-medium mb-2 block">Your Response</Label>
                                            <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/15">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle2 size={16} strokeWidth={1.5} className=" text-green-500" />
                                                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                                        Responded {selectedDispute.vendor_response_at &&
                                                            `on ${new Date(selectedDispute.vendor_response_at).toLocaleDateString()}`}
                                                    </span>
                                                </div>
                                                <p className="text-sm leading-relaxed">
                                                    {selectedDispute.vendor_response}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Evidence */}
                                    {selectedDispute.vendor_evidence_urls && selectedDispute.vendor_evidence_urls.length > 0 && (
                                        <div>
                                            <Label className="text-sm font-medium mb-2 block">Your Evidence</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {selectedDispute.vendor_evidence_urls.map((url, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setLightboxUrls(selectedDispute.vendor_evidence_urls)}
                                                        className="relative aspect-square rounded-lg overflow-hidden border hover:ring-2 ring-primary/50 transition-all group"
                                                    >
                                                        {/\.(jpg|jpeg|png|gif|webp)/i.test(url) ? (
                                                            <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                        ) : (
                                                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted">
                                                                <FileText size={24} strokeWidth={1.5} className=" text-muted-foreground" />
                                                                <span className="text-[10px] text-muted-foreground">File {idx + 1}</span>
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                            <Eye size={20} strokeWidth={1.5} className=" text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Resolution Info */}
                                    {selectedDispute.resolved_at && selectedDispute.resolution_notes && (
                                        <div className="border-t pt-4">
                                            <Label className="text-sm font-medium mb-2 block">Admin Resolution</Label>
                                            <div className="p-4 rounded-xl bg-muted/50 border text-sm whitespace-pre-wrap">
                                                {selectedDispute.resolution_notes}
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Resolved on {new Date(selectedDispute.resolved_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}

                                    {/* CTA */}
                                    {selectedDispute.status === "open" && (
                                        <Button
                                            className="w-full gap-2 h-11 bg-gradient-to-r from-primary to-primary/90"
                                            onClick={() => {
                                                setDetailOpen(false);
                                                setResponseOpen(true);
                                            }}
                                        >
                                            <MessageSquare size={16} strokeWidth={1.5}  />
                                            Submit Your Response
                                        </Button>
                                    )}
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

                    {/* ─── Response Modal ────────────────────────────── */}
                    <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <MessageSquare size={20} strokeWidth={1.5} className=" text-primary" />
                                    </div>
                                    Respond to Dispute
                                </DialogTitle>
                                <DialogDescription>
                                    Provide your side of the story and any evidence to support your case. The admin will review both sides before making a decision.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-5">
                                {/* Customer complaint preview */}
                                {selectedDispute && (
                                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-sm">
                                        <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Customer says:</p>
                                        <p className="text-muted-foreground italic line-clamp-3">
                                            "{selectedDispute.description || "No description"}"
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <Label htmlFor="response" className="mb-2 block font-medium">Your Response *</Label>
                                    <Textarea
                                        id="response"
                                        placeholder="Explain what happened from your perspective…"
                                        value={response}
                                        onChange={(e) => setResponse(e.target.value)}
                                        rows={5}
                                        className="resize-none"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="evidence" className="mb-1 block font-medium">Upload Evidence (Optional)</Label>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Screenshots, delivery receipts, chat logs, or other proof
                                    </p>
                                    <div className="relative">
                                        <Input
                                            id="evidence"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setEvidenceFiles(Array.from(e.target.files));
                                                }
                                            }}
                                        />
                                    </div>
                                    {evidenceFiles.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {evidenceFiles.map((f, i) => (
                                                <Badge key={i} variant="secondary" className="gap-1.5 text-xs">
                                                    <ImageIcon strokeWidth={1.5} className="h-3 w-3" />
                                                    {f.name.length > 20 ? f.name.slice(0, 17) + "…" : f.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-amber-500/5 border border-amber-500/15 p-3.5 rounded-xl text-sm text-amber-700 dark:text-amber-300 flex items-start gap-3">
                                    <AlertTriangle size={16} strokeWidth={1.5} className=" shrink-0 mt-0.5" />
                                    <div>
                                        <strong>Important:</strong> Your response will be sent to the admin for review. Be honest and provide as much detail as possible.
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                            setResponseOpen(false);
                                            setResponse("");
                                            setEvidenceFiles([]);
                                        }}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-[2] gap-2 bg-gradient-to-r from-primary to-primary/90"
                                        onClick={handleSubmitResponse}
                                        disabled={submitting || !response.trim()}
                                    >
                                        {submitting ? (
                                            <>
                                                <RefreshCw size={16} strokeWidth={1.5} className=" animate-spin" />
                                                Submitting…
                                            </>
                                        ) : (
                                            <>
                                                <ArrowRight size={16} strokeWidth={1.5}  />
                                                Submit Response
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Lightbox */}
                    {lightboxUrls && (
                        <EvidenceLightbox urls={lightboxUrls} onClose={() => setLightboxUrls(null)} />
                    )}
                </main>
            </div>
        </div>
    );
};

export default VendorDisputes;
