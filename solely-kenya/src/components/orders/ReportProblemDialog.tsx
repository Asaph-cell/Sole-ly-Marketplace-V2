import { useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { uploadEvidence } from "@/lib/disputeEvidence";
import { PROBLEM_OPTIONS, orderAction, type ProblemCategory } from "@/lib/orderFlow";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  items: { id: string; product_name: string; quantity: number }[];
  onReported: (next: string) => void;
}

/**
 * Two short steps: pick what happened (one tap), then only the details
 * that problem needs. Everything else - who decides, deadlines, refunds -
 * is worked out on the server and explained afterwards in one sentence.
 */
export function ReportProblemDialog({ open, onOpenChange, orderId, items, onReported }: Props) {
  const [category, setCategory] = useState<ProblemCategory | null>(null);
  const [description, setDescription] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const reset = () => { setCategory(null); setDescription(""); setMissing([]); setFiles([]); };
  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const option = PROBLEM_OPTIONS.find((o) => o.value === category);
  const needsPhotos = category && !["item_not_received", "missing_items"].includes(category);
  const ready = category === "missing_items" ? missing.length > 0 : description.trim().length >= 5;

  const submit = async () => {
    if (!category) return;
    setSending(true);
    try {
      const evidence: string[] = [];
      for (const f of files) {
        try { evidence.push(await uploadEvidence("buyer", orderId, f)); }
        catch (e) { console.warn("Evidence upload failed:", e); }
      }
      const res = await orderAction<{ next: string }>("report_problem", orderId, {
        category, description: description.trim(), missingItemIds: missing, evidence,
      });
      close(false);
      onReported(res.next);
    } catch (e) {
      toast.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        {!category ? (
          <>
            <DialogHeader>
              <DialogTitle>What went wrong?</DialogTitle>
              <DialogDescription>Your payment stays held, and the seller isn't paid, until it's sorted.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
              {PROBLEM_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setCategory(o.value)}
                  className="w-full flex items-center gap-3 text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.hint}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <button type="button" onClick={() => setCategory(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit">
                <ChevronLeft size={14} /> Back
              </button>
              <DialogTitle>{option?.label}</DialogTitle>
            </DialogHeader>

            {category === "missing_items" ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Tick what didn't come.</p>
                {items.map((i) => (
                  <label key={i.id} className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer">
                    <Checkbox checked={missing.includes(i.id)}
                      onCheckedChange={(c) => setMissing((m) => (c ? [...m, i.id] : m.filter((x) => x !== i.id)))} />
                    <span className="text-sm">{i.quantity}× {i.product_name}</span>
                  </label>
                ))}
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Anything else? (optional)" />
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} autoFocus
                  placeholder={category === "item_not_received" ? "e.g. Nobody delivered anything to me" : "Tell us what happened"} />
                {needsPhotos && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                          {f.name.slice(0, 18)}
                          <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label="Remove photo"><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-sm text-primary-strong cursor-pointer">
                      <ImagePlus size={16} /> Add photos (helps sort it faster)
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => e.target.files && setFiles((fs) => [...fs, ...Array.from(e.target.files!)].slice(0, 6))} />
                    </label>
                  </div>
                )}
              </div>
            )}

            <Button className="w-full h-10" disabled={!ready || sending} onClick={submit}>
              {sending ? "Sending..." : "Report problem"}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
