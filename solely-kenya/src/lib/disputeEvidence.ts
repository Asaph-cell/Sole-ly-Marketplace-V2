import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Dispute evidence and tracking proof photos live in the private
// "dispute-evidence" bucket. Rows store either the object path (new uploads)
// or the old public URL (uploads from before the bucket went private); both
// are resolved to short-lived signed URLs for display.

const BUCKET = "dispute-evidence";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type EvidenceKind = "buyer" | "vendor" | "tracking";

/** Object path inside the bucket for a stored value (path or legacy public URL). */
export const evidencePath = (stored: string): string => {
  const marker = `/${BUCKET}/`;
  const i = stored.indexOf(marker);
  if (i === -1) return stored;
  return decodeURIComponent(stored.slice(i + marker.length).split("?")[0]);
};

/** Upload path: {uploader}/{kind}/{orderOrDisputeId}/{file}. Storage policies rely on this layout. */
export const evidenceUploadPath = (uploaderId: string, kind: EvidenceKind, refId: string, fileName: string) => {
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-80);
  return `${uploaderId}/${kind}/${refId}/${Date.now()}-${safe}`;
};

/** Upload a file and return the stored value (the object path). */
export const uploadEvidence = async (kind: EvidenceKind, refId: string, file: File): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload evidence");
  const path = evidenceUploadPath(user.id, kind, refId, file.name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
};

/** Signed URLs for stored evidence values, in the same order. Empty string until loaded or if unreadable. */
export const useSignedEvidence = (stored: (string | null | undefined)[] | null | undefined): string[] => {
  const values = (stored ?? []).filter((s): s is string => !!s);
  const key = values.join("|");
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!values.length) { setUrls([]); return; }
    let cancelled = false;
    supabase.storage
      .from(BUCKET)
      .createSignedUrls(values.map(evidencePath), SIGNED_URL_TTL)
      .then(({ data }) => {
        if (!cancelled) setUrls(values.map((_, i) => data?.[i]?.signedUrl ?? ""));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
};
