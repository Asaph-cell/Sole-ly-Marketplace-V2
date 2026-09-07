/**
 * AdminReports
 *
 * The queue for infringement and counterfeit complaints filed through
 * /report-listing. Enforcement itself already existed via admin-action
 * (pause_product, delete_product, revoke_vendor); this page is the
 * missing half, putting a report next to the buttons that act on it and
 * recording what was decided.
 *
 * Status is what makes this defensible under review: every report ends
 * up either actioned or rejected, with a note saying why, so the trail
 * shows a complaint was received AND what happened next.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SearchBar, ActionButton, StatusPill, EmptyState } from "@/components/admin/AdminShared";
import { ShieldAlert, ExternalLink, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminAction } from "@/hooks/useAdminAction";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ListingReport {
    id: string;
    created_at: string;
    report_type: string;
    product_id: string | null;
    product_short_code: string | null;
    listing_url: string | null;
    reporter_name: string;
    reporter_email: string;
    reporter_organization: string | null;
    reporter_role: string;
    description: string;
    evidence_url: string | null;
    good_faith: boolean;
    accuracy_declaration: boolean;
    status: string;
    admin_notes: string | null;
    reviewed_at: string | null;
}

const TYPE_LABEL: Record<string, string> = {
    counterfeit: "Counterfeit",
    copyright: "Copyright",
    trademark: "Trademark",
    publicity: "Name / likeness",
    stolen: "Stolen goods",
    other: "Other",
};

const ROLE_LABEL: Record<string, string> = {
    rights_holder: "Rights owner",
    representative: "Representative",
    buyer: "Buyer / visitor",
    other: "Other",
};

const FILTERS = ["new", "reviewing", "actioned", "rejected", "all"] as const;

const AdminReports = () => {
    const { toast } = useToast();
    const { adminAction } = useAdminAction();
    const [loading, setLoading] = useState(true);
    const [reports, setReports] = useState<ListingReport[]>([]);
    const [filter, setFilter] = useState<(typeof FILTERS)[number]>("new");
    const [search, setSearch] = useState("");
    const [notes, setNotes] = useState<Record<string, string>>({});

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("listing_reports")
            .select("*")
            .order("created_at", { ascending: false });
        if (error) {
            console.error("Error loading listing reports:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setReports((data as ListingReport[]) ?? []);
        }
        setLoading(false);
    };

    const setStatus = async (report: ListingReport, status: string) => {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase
            .from("listing_reports")
            .update({
                status,
                admin_notes: notes[report.id] ?? report.admin_notes,
                reviewed_by: userData.user?.id ?? null,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", report.id);

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
        }
        toast({ title: "Updated", description: `Report marked ${status}.` });
        load();
    };

    // Taking the listing down and closing the report are one motion in
    // practice, so pausing also marks the report actioned.
    const pauseAndAction = async (report: ListingReport) => {
        if (!report.product_id) {
            toast({
                title: "No linked product",
                description: "This report has no resolved listing. Find it via the link, then pause it from Products.",
                variant: "destructive",
            });
            return;
        }
        const ok = await adminAction("pause_product", report.product_id);
        if (ok) await setStatus(report, "actioned");
    };

    const visible = reports
        .filter(r => (filter === "all" ? true : r.status === filter))
        .filter(r => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                r.reporter_name.toLowerCase().includes(q) ||
                r.reporter_email.toLowerCase().includes(q) ||
                (r.reporter_organization ?? "").toLowerCase().includes(q) ||
                (r.product_short_code ?? "").toLowerCase().includes(q) ||
                r.description.toLowerCase().includes(q)
            );
        });

    const newCount = reports.filter(r => r.status === "new").length;

    return (
        <AdminLayout>
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">Listing Reports</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Counterfeit and infringement complaints filed from /report-listing.
                    {newCount > 0 && <span className="text-destructive font-medium"> {newCount} awaiting review.</span>}
                </p>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {FILTERS.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-semibold border transition-all capitalize",
                            filter === f
                                ? "bg-foreground text-background border-foreground"
                                : "bg-background text-foreground border-border hover:border-foreground/40"
                        )}
                    >
                        {f}
                        {f !== "all" && ` (${reports.filter(r => r.status === f).length})`}
                    </button>
                ))}
            </div>

            <SearchBar
                placeholder="Search reporter, organisation, product code, description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
            />

            {loading ? (
                <SneakerLoader message="Loading reports..." />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon={ShieldAlert}
                    title="No reports here"
                    subtitle={
                        filter === "new"
                            ? "Nothing is waiting on you. New reports appear here as soon as they're filed."
                            : "Nothing matches this filter."
                    }
                />
            ) : (
                <div className="space-y-4">
                    {visible.map(report => (
                        <div key={report.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wide">
                                            {TYPE_LABEL[report.report_type] ?? report.report_type}
                                        </span>
                                        <StatusPill status={report.status} />
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold">
                                        {report.reporter_name}
                                        {report.reporter_organization && (
                                            <span className="font-normal text-muted-foreground"> · {report.reporter_organization}</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {ROLE_LABEL[report.reporter_role] ?? report.reporter_role}
                                        {" · "}
                                        <a href={`mailto:${report.reporter_email}`} className="text-primary underline">
                                            {report.reporter_email}
                                        </a>
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {report.product_id && (
                                        <Link to={`/product/${report.product_id}`} target="_blank">
                                            <ActionButton label="View listing" icon={ExternalLink} />
                                        </Link>
                                    )}
                                    {report.listing_url && !report.product_id && (
                                        <a href={report.listing_url} target="_blank" rel="noopener noreferrer">
                                            <ActionButton label="Open link" icon={ExternalLink} />
                                        </a>
                                    )}
                                    <a href={`mailto:${report.reporter_email}?subject=Your report to Solely`}>
                                        <ActionButton label="Reply" icon={Mail} />
                                    </a>
                                </div>
                            </div>

                            <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded-lg p-3 mb-3">
                                {report.description}
                            </p>

                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mb-3">
                                {report.product_short_code && <span>Code: <strong>{report.product_short_code}</strong></span>}
                                {report.evidence_url && (
                                    <a href={report.evidence_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                        Supporting evidence
                                    </a>
                                )}
                                <span>
                                    Declarations:{" "}
                                    {report.good_faith && report.accuracy_declaration
                                        ? "both given"
                                        : "incomplete"}
                                </span>
                            </div>

                            {report.status === "new" || report.status === "reviewing" ? (
                                <>
                                    <Textarea
                                        rows={2}
                                        placeholder="What did you decide, and why? Saved with the report."
                                        className="mb-3 text-sm"
                                        value={notes[report.id] ?? report.admin_notes ?? ""}
                                        onChange={e => setNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <ActionButton
                                            label="Pause listing & mark actioned"
                                            variant="danger"
                                            onClick={() => pauseAndAction(report)}
                                        />
                                        {report.status === "new" && (
                                            <ActionButton label="Mark reviewing" onClick={() => setStatus(report, "reviewing")} />
                                        )}
                                        <ActionButton label="Mark actioned" onClick={() => setStatus(report, "actioned")} />
                                        <ActionButton label="Reject" onClick={() => setStatus(report, "rejected")} />
                                    </div>
                                </>
                            ) : (
                                <div className="text-xs text-muted-foreground border-t border-border pt-3">
                                    {report.admin_notes && <p className="mb-1">Note: {report.admin_notes}</p>}
                                    {report.reviewed_at && (
                                        <p>
                                            Closed {formatDistanceToNow(new Date(report.reviewed_at), { addSuffix: true })}
                                        </p>
                                    )}
                                    <button
                                        onClick={() => setStatus(report, "reviewing")}
                                        className="text-primary underline mt-2"
                                    >
                                        Reopen
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminReports;
