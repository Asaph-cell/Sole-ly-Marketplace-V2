/**
 * DeliveryTrackingControl Component
 * 
 * Allows vendors to share their real-time location during delivery.
 * Handles geolocation tracking, permission requests, and periodic updates.
 */

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Loader2, Battery, RadioTower } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DeliveryTrackingControlProps {
    orderId: string;
    isCurrentlyTracking?: boolean;
    onTrackingChange?: (enabled: boolean) => void;
}

const UPDATE_INTERVAL = 30000; // 30 seconds
const MAX_TRACKING_DURATION = 8 * 60 * 60 * 1000; // 8 hours

export function DeliveryTrackingControl({
    orderId,
    isCurrentlyTracking = false,
    onTrackingChange
}: DeliveryTrackingControlProps) {
    const [isTracking, setIsTracking] = useState(isCurrentlyTracking);
    const [isUpdating, setIsUpdating] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [trackingStartTime, setTrackingStartTime] = useState<Date | null>(null);

    const watchIdRef = useRef<number | null>(null);
    const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Update location to database
    const updateLocationToDatabase = async (latitude: number, longitude: number) => {
        try {
            setIsUpdating(true);
            const { error } = await supabase
                .from('order_shipping_details')
                .update({
                    delivery_current_latitude: latitude,
                    delivery_current_longitude: longitude,
                    delivery_location_updated_at: new Date().toISOString(),
                })
                .eq('order_id', orderId);

            if (error) throw error;

            setLastUpdate(new Date());
            console.log('[Tracking] Location updated:', { latitude, longitude });
        } catch (error) {
            console.error('[Tracking] Failed to update location:', error);
            toast.error("Failed to update location");
        } finally {
            setIsUpdating(false);
        }
    };

    // Start tracking
    const startTracking = async () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation not supported by your browser");
            return;
        }

        try {
            // Request permission and get initial position
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                });
            });

            const { latitude, longitude } = position.coords;

            // Enable tracking in database
            const { error } = await supabase
                .from('order_shipping_details')
                .update({
                    delivery_tracking_enabled: true,
                    delivery_current_latitude: latitude,
                    delivery_current_longitude: longitude,
                    delivery_location_updated_at: new Date().toISOString(),
                    tracking_started_at: new Date().toISOString(),
                })
                .eq('order_id', orderId);

            if (error) throw error;

            setIsTracking(true);
            setTrackingStartTime(new Date());
            setLastUpdate(new Date());
            setPermissionDenied(false);
            onTrackingChange?.(true);

            toast.success("Live tracking started", {
                description: "Your location will update every 30 seconds"
            });

            // Set up continuous tracking
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => {
                    updateLocationToDatabase(pos.coords.latitude, pos.coords.longitude);
                },
                (error) => {
                    console.error('[Tracking] Watch position error:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0,
                }
            );

            // Auto-stop after MAX_TRACKING_DURATION
            autoStopTimeoutRef.current = setTimeout(() => {
                toast.info("Auto-stopping tracking after 8 hours");
                stopTracking();
            }, MAX_TRACKING_DURATION);

        } catch (error: any) {
            console.error('[Tracking] Start error:', error);

            if (error.code === 1) { // PERMISSION_DENIED
                setPermissionDenied(true);
                toast.error("Location permission denied", {
                    description: "Please enable location access in your browser settings"
                });
            } else {
                toast.error("Failed to start tracking", {
                    description: error.message || "Unknown error"
                });
            }
        }
    };

    // Stop tracking
    const stopTracking = async () => {
        // Clear watchers and intervals
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
            updateIntervalRef.current = null;
        }

        if (autoStopTimeoutRef.current) {
            clearTimeout(autoStopTimeoutRef.current);
            autoStopTimeoutRef.current = null;
        }

        // Update database
        try {
            const { error } = await supabase
                .from('order_shipping_details')
                .update({
                    delivery_tracking_enabled: false,
                    tracking_stopped_at: new Date().toISOString(),
                })
                .eq('order_id', orderId);

            if (error) throw error;

            setIsTracking(false);
            setTrackingStartTime(null);
            onTrackingChange?.(false);

            toast.success("Live tracking stopped");
        } catch (error) {
            console.error('[Tracking] Stop error:', error);
            toast.error("Failed to stop tracking");
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
            }
            if (autoStopTimeoutRef.current) {
                clearTimeout(autoStopTimeoutRef.current);
            }
        };
    }, []);

    // Toggle tracking
    const handleToggle = async (checked: boolean) => {
        if (checked) {
            await startTracking();
        } else {
            await stopTracking();
        }
    };

    return (
        <Card className={isTracking ? "border-green-500 bg-green-50/50 dark:bg-green-950/20" : ""}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <RadioTower size={20} strokeWidth={1.5} className={` ${isTracking ? 'text-green-600 animate-pulse' : 'text-muted-foreground'}`} />
                        <div>
                            <Label htmlFor="tracking-toggle" className="text-base font-semibold cursor-pointer">
                                Live Delivery Tracking
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Share your location with the buyer in real-time
                            </p>
                        </div>
                    </div>
                    <Switch
                        id="tracking-toggle"
                        checked={isTracking}
                        onCheckedChange={handleToggle}
                        disabled={isUpdating}
                    />
                </div>

                {isTracking && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                            <div className="flex items-center gap-1">
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="font-medium">Tracking Active</span>
                            </div>
                            {lastUpdate && (
                                <span className="text-xs text-muted-foreground">
                                    • Last update: {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago
                                </span>
                            )}
                        </div>

                        <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                            <Battery size={16} strokeWidth={1.5} className=" text-amber-600" />
                            <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                                <strong>Battery Notice:</strong> Continuous GPS tracking may drain your battery. The tracking will auto-stop after 8 hours.
                            </AlertDescription>
                        </Alert>

                        {isUpdating && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 strokeWidth={1.5} className="h-3 w-3 animate-spin" />
                                <span>Updating location...</span>
                            </div>
                        )}
                    </div>
                )}

                {permissionDenied && !isTracking && (
                    <Alert className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                        <MapPin size={16} strokeWidth={1.5} className=" text-red-600" />
                        <AlertDescription className="text-xs text-red-800 dark:text-red-200">
                            Location permission denied. Please enable location access in your browser settings and try again.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}

export default DeliveryTrackingControl;
