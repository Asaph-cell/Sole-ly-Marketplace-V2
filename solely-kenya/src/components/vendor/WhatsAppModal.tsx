import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export const WhatsAppModal = ({ open, onClose, userId }: WhatsAppModalProps) => {
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ whatsapp_number: whatsappNumber })
        .eq("id", userId);

      if (error) throw error;

      // Add vendor role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "vendor" });

      if (roleError && !roleError.message.includes("duplicate")) {
        throw roleError;
      }

      toast.success("WhatsApp number saved! You can now start selling.");
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Your Vendor Profile</DialogTitle>
          <DialogDescription>
            Please provide your WhatsApp number so buyers can contact you when they want to place orders.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="whatsapp">WhatsApp Number</Label>
            <Input
              id="whatsapp"
              type="tel"
              placeholder="254700000000"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Save & Continue"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
