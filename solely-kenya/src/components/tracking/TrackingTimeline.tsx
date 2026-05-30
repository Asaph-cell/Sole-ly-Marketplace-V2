import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, Package, Truck, CheckCircle, Clock } from "lucide-react";

type TrackingEvent = {
  id: string;
  status: string;
  location: string | null;
  note: string | null;
  proof_image_url: string | null;
  created_at: string;
};

export function TrackingTimeline({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("order_tracking_events")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setEvents(data || []);
      } catch (err) {
        console.error("Error fetching tracking events:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();

    const channel = supabase.channel(`tracking_${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_tracking_events", filter: `order_id=eq.${orderId}` }, (payload) => {
        setEvents(prev => [payload.new as TrackingEvent, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  if (loading) {
    return <div className="flex justify-center p-4 mt-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (events.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "packed": return <Package className="h-4 w-4 text-primary" />;
      case "in_transit":
      case "out_for_delivery": return <Truck className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
      case "delivered": return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusTitle = (status: string) => {
    switch (status) {
      case "packed": return "Order Packed";
      case "in_transit": return "In Transit";
      case "out_for_delivery": return "Out for Delivery";
      case "delivered": return "Delivered";
      case "delayed": return "Delayed";
      default: return status.replace(/_/g, " ");
    }
  };

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 mt-4">
      <h3 className="font-semibold text-sm mb-4">Tracking History</h3>
      <div className="relative flex flex-col gap-0">
        <div className="absolute left-[17px] top-[18px] bottom-[18px] w-[2px] bg-border" />
        
        {events.map((event, index) => {
          const isLatest = index === 0;
          return (
            <div key={event.id} className="relative z-10 flex items-start gap-4 pb-6 last:pb-0">
              <div className={`w-9 h-9 shrink-0 rounded-full border-2 flex items-center justify-center bg-background
                ${isLatest ? 'border-primary' : 'border-muted-foreground/30'}
              `}>
                {getStatusIcon(event.status)}
              </div>
              
              <div className="flex flex-col pt-1 w-full min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                  <span className={`font-semibold text-sm ${isLatest ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {getStatusTitle(event.status)}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(event.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
                
                {(event.location || event.note) && (
                  <p className="text-xs text-muted-foreground mt-1 break-words">
                    {event.location && <span className="font-medium text-foreground">{event.location} - </span>}
                    {event.note}
                  </p>
                )}

                {event.proof_image_url && (
                  <div className="mt-2">
                    <img 
                      src={event.proof_image_url} 
                      alt="Proof" 
                      className="rounded-lg border border-border max-h-32 max-w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
