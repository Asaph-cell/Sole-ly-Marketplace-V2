import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquareHeart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

const Feedback = () => {
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    try {
      // Tag the message with where it came from (e.g. a specific email
      // campaign's ?source= link) so admins can tell context apart in the
      // Community Feedback list without a separate column.
      const { error } = await supabase.from("company_feedback").insert({
        message: source ? `[${source}] ${message.trim()}` : message.trim(),
      });
      if (error) throw error;
      setSubmitted(true);
      setMessage("");
    } catch (err) {
      console.error("Feedback error:", err);
      toast.error("Couldn't send that just now, please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12">
      <SEO
        title="Share Your Feedback"
        description="Tell the Solely team what's working, what isn't, and what would make Solely better for you."
        canonical="https://solelymarketplace.com/feedback"
      />
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquareHeart size={28} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">We're listening</h1>
            <p className="text-lg text-muted-foreground">
              Tell us honestly, what's working, what's not, and what would make Solely better for you. Our team reads every response.
            </p>
          </div>

          <Card className="border-2 shadow-card">
            <CardContent className="pt-6">
              {submitted ? (
                <div className="text-center py-8">
                  <CheckCircle2 size={40} strokeWidth={1.5} className="text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2">Thank you!</h3>
                  <p className="text-muted-foreground">
                    Your feedback has been sent straight to our team. We genuinely appreciate you taking the time.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <Textarea
                    placeholder="Write as much or as little as you'd like..."
                    rows={8}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? "Sending..." : "Send Feedback"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Feedback;
