import { useEffect, useState } from "react";
import { ShieldCheck, X, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ActionButton } from "@/components/admin/AdminShared";
import { toast } from "@/lib/toast";

type Props = {
  vendorId: string;
  status: string | null;
  documents: { document_path?: string; document_type?: string } | null;
  submittedAt: string | null;
  onReviewed: () => void;
};

const DOC_LABEL: Record<string, string> = {
  national_id: "National ID",
  business_registration: "Business registration",
};

// Admin panel for a seller's pending verification document. The document sits
// in a private bucket, so it's shown through a short-lived signed URL.
export const VerificationReview = ({ vendorId, status, documents, submittedAt, onReviewed }: Props) => {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const path = documents?.document_path;

  useEffect(() => {
    if (!path) return;
    supabase.storage.from("vendor-verification").createSignedUrl(path, 60 * 10).then(({ data }) => {
      setDocUrl(data?.signedUrl ?? null);
    });
  }, [path]);

  if (status !== "pending") return null;

  const review = async (approve: boolean) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("review_vendor_verification", {
        vendor: vendorId, approve, reason: approve ? null : reason,
      });
      if (error) throw error;
      toast.success(approve ? "Seller verified" : "Sent back to the seller");
      onReviewed();
    } catch (err: any) {
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  const isPdf = path?.toLowerCase().endsWith(".pdf");

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 shadow-soft p-4 mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Verification waiting for review</p>
          <p className="text-xs text-muted-foreground">
            {DOC_LABEL[documents?.document_type ?? ""] ?? "Document"}
            {submittedAt && ` · sent ${formatDistanceToNow(new Date(submittedAt), { addSuffix: true })}`}
          </p>
        </div>
        {docUrl && (
          <a href={docUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2">
            Open full size <ExternalLink size={11} />
          </a>
        )}
      </div>

      {docUrl && !isPdf && (
        <img src={docUrl} alt="Submitted verification document" className="mt-3 max-h-72 rounded-lg border border-border object-contain bg-background" />
      )}
      {!docUrl && <p className="mt-3 text-xs text-muted-foreground">Loading document…</p>}

      {rejecting ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Tell the seller what to fix, e.g. the photo is blurry or cuts off the ID number"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <ActionButton label="Send back" variant="danger" icon={X} disabled={busy || !reason.trim()} onClick={() => review(false)} />
            <ActionButton label="Cancel" onClick={() => setRejecting(false)} disabled={busy} />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <ActionButton label="Approve" icon={ShieldCheck} disabled={busy || !docUrl} onClick={() => review(true)} />
          <ActionButton label="Reject" variant="danger" icon={X} disabled={busy} onClick={() => setRejecting(true)} />
        </div>
      )}
    </div>
  );
};
