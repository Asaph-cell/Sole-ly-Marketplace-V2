import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Package, Truck, CheckCircle, AlertCircle } from "lucide-react";

export function ManualTrackingUpdate({ orderId, onUpdate }: { orderId: string, onUpdate?: () => void }) {
  const [status, setStatus] = useState("packed");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!status) return;

    setIsSubmitting(true);
    try {
      let proof_image_url = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${orderId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('dispute-evidence')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('dispute-evidence')
          .getPublicUrl(filePath);
          
        proof_image_url = data.publicUrl;
      }

      const { error } = await supabase
        .from('order_tracking_events')
        .insert({
          order_id: orderId,
          status,
          location,
          note,
          proof_image_url
        });

      if (error) throw error;

      toast.success("Tracking updated successfully!");
      setStatus("packed");
      setLocation("");
      setNote("");
      setFile(null);
      if (onUpdate) onUpdate();

    } catch (error: any) {
      console.error("Error updating tracking:", error);
      toast.error(error.message || "Failed to update tracking");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Update Tracking Status</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Status Milestone</Label>
            <Select value={status} onValueChange={setStatus} required>
              <SelectTrigger>
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="packed">
                  <div className="flex items-center gap-2"><Package className="h-4 w-4"/> Order Packed</div>
                </SelectItem>
                <SelectItem value="in_transit">
                  <div className="flex items-center gap-2"><Truck className="h-4 w-4"/> Dispatched / In Transit</div>
                </SelectItem>
                <SelectItem value="out_for_delivery">
                  <div className="flex items-center gap-2"><Truck className="h-4 w-4"/> Out for Delivery</div>
                </SelectItem>
                <SelectItem value="delivered">
                  <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4"/> Delivered</div>
                </SelectItem>
                <SelectItem value="delayed">
                  <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/> Delayed</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Current Location (Optional)</Label>
            <Input 
              value={location} 
              onChange={e => setLocation(e.target.value)} 
              placeholder="e.g. Nairobi CBD, EasyCoach terminal" 
            />
          </div>

          <div className="space-y-2">
            <Label>Note (Optional)</Label>
            <Textarea 
              value={note} 
              onChange={e => setNote(e.target.value)} 
              placeholder="e.g. Waybill #12345, Driver phone: 0722..." 
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Proof Photo (Recommended)</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="file" 
                accept="image/*" 
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Upload a picture of the parcel or courier receipt to protect yourself in case of a dispute.
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Add Update
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
