/**
 * LiveDeliveryTracker Component
 * 
 * Displays vendor's real-time location during delivery for buyers.
 * Uses Supabase Realtime to receive live GPS updates.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MapPin, Clock, Navigation, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LiveDeliveryTrackerProps {
    orderId: string;
    recipientName?: string;
}

export function LiveDeliveryTracker({ orderId, recipientName }: LiveDeliveryTrackerProps) {
    const [trackingData, setTrackingData] = useState<{
        latitude: number;
        longitude: number;
        updated_at: string;
        enabled: boolean;
    } | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [mapRef, setMapRef] = useState<L.Map | null>(null);
    const [markerRef, setMarkerRef] = useState<L.Marker | null>(null);
    const mapContainerRef = useState<HTMLDivElement | null>(null)[1];

    // Fetch initial tracking data
    useEffect(() => {
        const fetchTrackingData = async () => {
            const { data, error } = await supabase
                .from('order_shipping_details')
                .select('delivery_tracking_enabled, delivery_current_latitude, delivery_current_longitude, delivery_location_updated_at')
                .eq('order_id', orderId)
                .single();

            if (error) {
                console.error('[LiveTracker] Failed to fetch tracking data:', error);
                return;
            }

            if (data?.delivery_tracking_enabled && data.delivery_current_latitude && data.delivery_current_longitude) {
                setTrackingData({
                    latitude: data.delivery_current_latitude,
                    longitude: data.delivery_current_longitude,
                    updated_at: data.delivery_location_updated_at || new Date().toISOString(),
                    enabled: data.delivery_tracking_enabled,
                });
            }
        };

        fetchTrackingData();
    }, [orderId]);

    // Set up Realtime subscription for live updates
    useEffect(() => {
        const channel = supabase
            .channel(`delivery-tracking-${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'order_shipping_details',
                    filter: `order_id=eq.${orderId}`,
                },
                (payload) => {
                    console.log('[LiveTracker] Received update:', payload);
                    const newData = payload.new;

                    if (newData.delivery_tracking_enabled && newData.delivery_current_latitude && newData.delivery_current_longitude) {
                        setTrackingData({
                            latitude: newData.delivery_current_latitude,
                            longitude: newData.delivery_current_longitude,
                            updated_at: newData.delivery_location_updated_at || new Date().toISOString(),
                            enabled: newData.delivery_tracking_enabled,
                        });
                    } else if (!newData.delivery_tracking_enabled) {
                        // Tracking was disabled
                        setTrackingData(prev => prev ? { ...prev, enabled: false } : null);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[LiveTracker] Subscription status:', status);
                setIsConnected(status === 'SUBSCRIBED');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orderId]);

    // Initialize and update map
    useEffect(() => {
        if (!trackingData || !trackingData.enabled) return;

        const container = document.getElementById(`live-map-${orderId}`);
        if (!container) return;

        // Initialize map if not exists
        if (!mapRef) {
            const map = L.map(container).setView([trackingData.latitude, trackingData.longitude], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap',
            }).addTo(map);

            // Create delivery truck marker
            const truckIcon = L.divIcon({
                className: 'delivery-truck-icon',
                html: `<div style="
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-center;
                    animation: pulse 2s infinite;
                ">
                    <div style="font-size: 20px;">🚚</div>
                </div>
                <style>
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                    }
                </style>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
            });

            const marker = L.marker([trackingData.latitude, trackingData.longitude], {
                icon: truckIcon,
            }).addTo(map);

            setMapRef(map);
            setMarkerRef(marker);
        } else {
            // Update existing marker position with animation
            if (markerRef) {
                markerRef.setLatLng([trackingData.latitude, trackingData.longitude]);
                mapRef.panTo([trackingData.latitude, trackingData.longitude]);
            }
        }
    }, [trackingData, orderId, mapRef, markerRef]);

    if (!trackingData || !trackingData.enabled) {
        return null; // Don't show anything if tracking is not active
    }

    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${trackingData.latitude},${trackingData.longitude}`;
    const timeSinceUpdate = trackingData.updated_at
        ? Math.floor((Date.now() - new Date(trackingData.updated_at).getTime()) / 1000)
        : 0;

    return (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <div className="bg-blue-500 p-1.5 rounded-full">
                        <MapPin size={16} strokeWidth={1.5} className=" text-white" />
                    </div>
                    🚚 Live Delivery Tracking
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <Alert className="bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700">
                    <AlertDescription className="text-sm text-blue-900 dark:text-blue-100 flex items-center gap-2">
                        {isConnected ? (
                            <>
                                <Wifi size={16} strokeWidth={1.5}  />
                                <span>Receiving live updates</span>
                            </>
                        ) : (
                            <>
                                <WifiOff size={16} strokeWidth={1.5}  />
                                <span>Connecting...</span>
                            </>
                        )}
                    </AlertDescription>
                </Alert>

                {/* Map */}
                <div
                    id={`live-map-${orderId}`}
                    className="h-64 w-full rounded-lg overflow-hidden border border-blue-200 dark:border-blue-800"
                />

                {/* Status Info */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Clock strokeWidth={1.5} className="h-3 w-3" />
                        <span>
                            Updated {timeSinceUpdate < 60 ? `${timeSinceUpdate}s ago` : `${Math.floor(timeSinceUpdate / 60)}m ago`}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                        <span>Tracking active</span>
                    </div>
                </div>

                {/* Open in Google Maps */}
                <Button
                    asChild
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="sm"
                >
                    <a
                        href={googleMapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2"
                    >
                        <Navigation size={16} strokeWidth={1.5}  />
                        Open in Google Maps
                    </a>
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                    {recipientName ? `${recipientName}, your ` : 'Your '}delivery is on the way! The vendor's location updates in real-time.
                </p>
            </CardContent>
        </Card>
    );
}

export default LiveDeliveryTracker;

