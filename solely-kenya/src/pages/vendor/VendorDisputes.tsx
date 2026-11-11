import { useEffect, useMemo, useState } from "react";
import { ListSkeleton } from "@/components/skeletons";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { VendorNavbar } from "@/components/vendor/VendorNavbar";
import { VendorSidebar } from "@/components/vendor/VendorSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ImagePlus, RefreshCw } from "lucide-react";
import { uploadEvidence } from "@/lib/disputeEvidence";
import { toast } from "@/lib/toast";
import { DisputePanel } from "@/components/disputes/DisputePanel";
import { useOrderTimers } from "@/lib/orderFlow";

interface Dispute {
    id: string;
    order_id: string;
    status: string;
    stage: string | null;
    opened_at: string;
    vendor_response: string | null;
    vendor_evidence_urls: string[] | null;
    order?: {
        total_ksh: number;
        subtotal_ksh: number;
        refunded_ksh: number | null;
        order_items: { id: string; product_name: string; quantity: number }[];
    };
}

const isResolved = (d: Dispute) => d.status.startsWith("resolved") || d.status === "closed";

/**
 * Every problem raised on this vendor's orders, each with the same panel
 * the order page shows: one sentence about what's happening and only the
 * buttons that apply now.
 */
const VendorDisputes = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [disputes, setDisputes] = useState<Dispute[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [tab, setTab] = useState<"open" | "resolved">("open");
    const [sideFor, setSideFor] = useState<Dispute | null>(null);
    const [response, setResponse] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const { timers } = useOrderTimers(useMemo(() => disputes.filter((d) => !isResolved(d)).map((d) => d.order_id), [disputes]), disputes);

    useEffect(() => {
        if (!loading && !user) navigate("/auth");
    }, [user, loading, navigate]);

    const loadDisputes = async () => {
        if (!user) return;
        setLoadingData(true);
        const { data, error } = await supabase
            .from("disputes")
            .select(`id, order_id, status, stage, opened_at, vendor_response, vendor_evidence_urls,
                order:order_id (total_ksh, subtotal_ksh, refunded_ksh, order_items(id, product_name, quantity))`)
            .eq("vendor_id", user.id)
            .order("opened_at", { ascending: false });
        if (error) console.error("Error loading disputes:", error);
        setDisputes(((data as unknown) as Dispute[]) || []);
        setLoadingData(false);
    };

    useEffect(() => {
        if (user) loadDisputes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Optional: the vendor's side with photos, for when Solely has to decide.
    const submitSide = async () => {
        if (!sideFor || response.trim().length < 3) return;
        setSubmitting(true);
        try {
            const uploaded: string[] = [];
            for (const f of files) {
                try { uploaded.push(await uploadEvidence("vendor", sideFor.id, f)); }
                catch (e) { console.warn("Upload error:", e); }
            }
            const { error } = await supabase
                .from("disputes")
                .update({
                    vendor_response: response.trim(),
                    vendor_response_at: new Date().toISOString(),
                    vendor_evidence_urls: [...(sideFor.vendor_evidence_urls ?? []), ...uploaded],
                })
                .eq("id", sideFor.id);
            if (error) throw error;
            toast.success("Sent to Solely", { description: "This is shown to the team if they need to decide." });
            setSideFor(null);
            setResponse("");
            setFiles([]);
            loadDisputes();
        } catch (e) {
            toast.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const shown = disputes.filter((d) => (tab === "open" ? !isResolved(d) : isResolved(d)));
    const openCount = disputes.filter((d) => !isResolved(d)).length;

    if (loading) {
        return <div className="container mx-auto p-4 sm:p-6"><ListSkeleton rows={5} /></div>;
    }

    return (
        <div className="min-h-screen bg-muted/30">
            <VendorNavbar />
            <div className="flex">
                <VendorSidebar />
                <main className="flex-1 min-w-0 p-4 md:p-8 max-w-3xl">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <h1 className="font-display text-3xl leading-tight sm:text-4xl">Problems</h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {openCount > 0
                                    ? "Respond quickly. If you don't, the buyer is refunded automatically."
                                    : "No open problems on your orders."}
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={loadDisputes} disabled={loadingData} className="shrink-0 gap-2">
                            <RefreshCw size={16} strokeWidth={1.5} className={loadingData ? "animate-spin" : ""} />
                            Refresh
                        </Button>
                    </div>

                    <Tabs value={tab} onValueChange={(v) => setTab(v as "open" | "resolved")}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="open" className="gap-2">
                                Open
                                {openCount > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-destructive text-white leading-none">{openCount}</span>}
                            </TabsTrigger>
                            <TabsTrigger value="resolved">Sorted</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {loadingData ? (
                        <ListSkeleton rows={3} />
                    ) : shown.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                                <CheckCircle2 size={28} className="text-success" />
                                <p className="font-medium">{tab === "open" ? "Nothing needs you" : "Nothing here yet"}</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {shown.map((d) => (
                                <Card key={d.id}>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span>Order #{d.order_id.slice(0, 8)} · KES {Number(d.order?.total_ksh ?? 0).toLocaleString()}</span>
                                            <span>{formatDistanceToNow(new Date(d.opened_at), { addSuffix: true })}</span>
                                        </div>
                                        <DisputePanel
                                            orderId={d.order_id}
                                            role="vendor"
                                            timers={timers[d.order_id]}
                                            items={d.order?.order_items ?? []}
                                            subtotal={Number(d.order?.subtotal_ksh ?? 0) - Number(d.order?.refunded_ksh ?? 0)}
                                            onChanged={loadDisputes}
                                        />
                                        {!isResolved(d) && (
                                            <button className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                                                onClick={() => { setSideFor(d); setResponse(d.vendor_response ?? ""); setFiles([]); }}>
                                                {d.vendor_response ? "Update your side for Solely" : "Send Solely your side (with photos)"}
                                            </button>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </main>
            </div>

            <Dialog open={!!sideFor} onOpenChange={(o) => !o && setSideFor(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Your side</DialogTitle>
                        <DialogDescription>Only needed if Solely has to decide. Photos of what you sent help a lot.</DialogDescription>
                    </DialogHeader>
                    <Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={4} placeholder="What happened, from your side" />
                    <label className="inline-flex items-center gap-1.5 text-sm text-primary-strong cursor-pointer">
                        <ImagePlus size={16} /> {files.length ? `${files.length} photo${files.length === 1 ? "" : "s"} added` : "Add photos"}
                        <input type="file" accept="image/*" multiple className="hidden"
                            onChange={(e) => e.target.files && setFiles(Array.from(e.target.files).slice(0, 6))} />
                    </label>
                    <Button className="w-full" disabled={submitting || response.trim().length < 3} onClick={submitSide}>
                        {submitting ? "Sending..." : "Send to Solely"}
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VendorDisputes;
