/**
 * ReportListing Page
 *
 * The intake route for infringement and counterfeit complaints.
 *
 * Deliberately reachable without an account. A brand owner's
 * representative is not going to create a shopping account to file a
 * notice, and a buyer who spots a fake usually reports it before they
 * ever sign up. The report writes straight to listing_reports, which is
 * admin-only to read.
 *
 * Prefills from ?product=<id|short_code> so "Report this listing" on a
 * product page arrives with the listing already identified.
 */

import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldAlert, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";

const REPORT_TYPES = [
    { value: "counterfeit", label: "Counterfeit or replica of a brand I own or represent" },
    { value: "copyright", label: "My photos, images or written content are being used" },
    { value: "trademark", label: "My trademark or brand name is being misused" },
    { value: "publicity", label: "My name, image or likeness is being used without permission" },
    { value: "stolen", label: "The item listed is stolen property" },
    { value: "other", label: "Another intellectual property or proprietary right" },
];

const REPORTER_ROLES = [
    { value: "rights_holder", label: "I own the right" },
    { value: "representative", label: "I represent the owner (agent, lawyer, brand protection)" },
    { value: "buyer", label: "I'm a buyer or visitor who spotted it" },
    { value: "other", label: "Other" },
];

const ReportListing = () => {
    const [searchParams] = useSearchParams();
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [form, setForm] = useState({
        report_type: "",
        product_short_code: "",
        listing_url: "",
        reporter_name: "",
        reporter_email: "",
        reporter_organization: "",
        reporter_role: "",
        description: "",
        evidence_url: "",
        good_faith: false,
        accuracy_declaration: false,
    });

    // The product id is resolved separately from what the reporter typed:
    // they may paste a short code, a full URL, or nothing at all.
    const [productId, setProductId] = useState<string | null>(null);

    useEffect(() => {
        const ref = searchParams.get("product");
        if (!ref) return;

        setForm(prev => ({
            ...prev,
            product_short_code: ref,
            listing_url: `${window.location.origin}/product/${ref}`,
        }));

        // Resolve to a real product row where we can, so the admin queue can
        // link straight to the listing. A miss is not an error: the report is
        // still worth filing with just the URL and description.
        (async () => {
            const isUuid = /^[0-9a-f-]{36}$/i.test(ref);
            const { data } = await supabase
                .from("products")
                .select("id")
                .eq(isUuid ? "id" : "short_code", ref)
                .maybeSingle();
            if (data?.id) setProductId(data.id);
        })();
    }, [searchParams]);

    const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

    const validate = () => {
        if (!form.report_type) return "Please choose what you're reporting.";
        if (!form.reporter_role) return "Please tell us your relationship to the right.";
        if (!form.reporter_name.trim()) return "Please enter your name.";
        if (!/^\S+@\S+\.\S+$/.test(form.reporter_email.trim())) return "Please enter a valid email address.";
        if (form.description.trim().length < 30)
            return "Please describe the problem in a little more detail, so we can act on it.";
        if (!form.product_short_code.trim() && !form.listing_url.trim())
            return "Please identify the listing, by its link or its product code.";
        if (!form.good_faith || !form.accuracy_declaration)
            return "Please confirm both declarations at the bottom of the form.";
        return null;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const problem = validate();
        if (problem) {
            toast.error(problem);
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase.from("listing_reports").insert({
                report_type: form.report_type,
                product_id: productId,
                product_short_code: form.product_short_code.trim() || null,
                listing_url: form.listing_url.trim() || null,
                reporter_name: form.reporter_name.trim(),
                reporter_email: form.reporter_email.trim(),
                reporter_organization: form.reporter_organization.trim() || null,
                reporter_role: form.reporter_role,
                description: form.description.trim(),
                evidence_url: form.evidence_url.trim() || null,
                good_faith: form.good_faith,
                accuracy_declaration: form.accuracy_declaration,
            });
            if (error) throw error;
            setSubmitted(true);
            window.scrollTo(0, 0);
        } catch (err: any) {
            console.error("Error filing listing report:", err);
            toast.error(err.message || "We couldn't file that report. Please email us instead.");
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-muted/30 py-12">
                <SEO
                    title="Report Received"
                    description="Your report about a listing on Solely has been received."
                    canonical="https://solelymarketplace.com/report-listing"
                />
                <div className="container mx-auto px-4 max-w-2xl">
                    <Card className="p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-bold mb-3">Report received</h1>
                        <p className="text-muted-foreground mb-6">
                            Thank you. Our team reviews reports within <strong>2 business days</strong>. If we
                            need anything further we'll email you at{" "}
                            <strong>{form.reporter_email}</strong>.
                        </p>
                        <p className="text-sm text-muted-foreground mb-6">
                            Where a listing breaches our policies we remove it, and we act against
                            vendors who repeat the behaviour, up to permanently revoking their
                            account and withholding funds held in escrow.
                        </p>
                        <Button asChild>
                            <Link to="/">Back to Home</Link>
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 py-12">
            <SEO
                title="Report a Listing"
                description="Report a counterfeit listing or content that infringes your copyright, trademark or other rights on Solely. No account needed."
                canonical="https://solelymarketplace.com/report-listing"
                breadcrumbs={[
                    { name: "Home", url: "/" },
                    { name: "Report a Listing", url: "/report-listing" },
                ]}
            />

            <div className="container mx-auto px-4 max-w-3xl">
                <Link to="/">
                    <Button variant="ghost" className="mb-6">
                        <ArrowLeft size={16} strokeWidth={1.5} className="mr-2" />
                        Back to Home
                    </Button>
                </Link>

                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldAlert className="w-7 h-7 text-amber-600" />
                    </div>
                    <h1 className="text-3xl font-bold mb-3">Report a Listing</h1>
                    <p className="text-muted-foreground max-w-xl mx-auto">
                        Use this form to report a counterfeit item, or content that infringes your
                        copyright, trademark or other rights. You do not need an account, and you do
                        not need to have bought anything.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="text-xl">What are you reporting?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div>
                                <Label className="mb-2 block">Type of report *</Label>
                                <Select value={form.report_type} onValueChange={v => set("report_type", v)}>
                                    <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
                                    <SelectContent>
                                        {REPORT_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="listing_url" className="mb-2 block">Link to the listing</Label>
                                <Input
                                    id="listing_url"
                                    placeholder="https://solelymarketplace.com/product/..."
                                    value={form.listing_url}
                                    onChange={e => set("listing_url", e.target.value)}
                                />
                            </div>

                            <div>
                                <Label htmlFor="product_short_code" className="mb-2 block">
                                    Or the product code
                                </Label>
                                <Input
                                    id="product_short_code"
                                    placeholder="Shown on the product page"
                                    value={form.product_short_code}
                                    onChange={e => set("product_short_code", e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Give us the link or the code, whichever you have. One is enough.
                                </p>
                            </div>

                            <div>
                                <Label htmlFor="description" className="mb-2 block">
                                    Describe the problem *
                                </Label>
                                <Textarea
                                    id="description"
                                    rows={6}
                                    placeholder="Tell us what right is affected and how this listing infringes it. If you're reporting a counterfeit, what shows the item is not genuine?"
                                    value={form.description}
                                    onChange={e => set("description", e.target.value)}
                                />
                            </div>

                            <div>
                                <Label htmlFor="evidence_url" className="mb-2 block">
                                    Link to supporting evidence
                                </Label>
                                <Input
                                    id="evidence_url"
                                    placeholder="Trademark registration, your original photos, an official product page..."
                                    value={form.evidence_url}
                                    onChange={e => set("evidence_url", e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle className="text-xl">About you</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div>
                                <Label className="mb-2 block">Your relationship to the right *</Label>
                                <Select value={form.reporter_role} onValueChange={v => set("reporter_role", v)}>
                                    <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
                                    <SelectContent>
                                        {REPORTER_ROLES.map(r => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="reporter_name" className="mb-2 block">Full name *</Label>
                                    <Input
                                        id="reporter_name"
                                        value={form.reporter_name}
                                        onChange={e => set("reporter_name", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="reporter_email" className="mb-2 block">Email *</Label>
                                    <Input
                                        id="reporter_email"
                                        type="email"
                                        value={form.reporter_email}
                                        onChange={e => set("reporter_email", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="reporter_organization" className="mb-2 block">
                                    Company or organisation
                                </Label>
                                <Input
                                    id="reporter_organization"
                                    value={form.reporter_organization}
                                    onChange={e => set("reporter_organization", e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="mb-6">
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="good_faith"
                                    checked={form.good_faith}
                                    onCheckedChange={v => set("good_faith", v === true)}
                                    className="mt-1"
                                />
                                <Label htmlFor="good_faith" className="text-sm font-normal leading-relaxed cursor-pointer">
                                    I believe in good faith that the use described is not authorised by the
                                    rights owner, its agent, or the law.
                                </Label>
                            </div>
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="accuracy_declaration"
                                    checked={form.accuracy_declaration}
                                    onCheckedChange={v => set("accuracy_declaration", v === true)}
                                    className="mt-1"
                                />
                                <Label htmlFor="accuracy_declaration" className="text-sm font-normal leading-relaxed cursor-pointer">
                                    The information in this report is accurate, and I am the rights owner or
                                    authorised to act on their behalf.
                                </Label>
                            </div>

                            <p className="text-xs text-muted-foreground pt-2">
                                We share the substance of a report with the vendor so they can respond.
                                Knowingly filing a false report is itself a breach of our terms.
                            </p>
                        </CardContent>
                    </Card>

                    <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                        {submitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Filing report...</>
                        ) : (
                            "Submit report"
                        )}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground mt-4">
                        Prefer email? Write to{" "}
                        <a href="mailto:contact@solelymarketplace.com" className="text-primary underline">
                            contact@solelymarketplace.com
                        </a>{" "}
                        with the same details.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ReportListing;
