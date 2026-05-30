/**
 * LocationViewMap Component
 * 
 * Read-only map display showing a pinned GPS location.
 * Used by vendors to view buyer delivery locations.
 */

import { useRef, useEffect, useState } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, ChevronDown, ChevronUp } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom delivery pin icon
const createDeliveryPinIcon = () =>
    L.divIcon({
        className: "delivery-pin-icon",
        html: `<div style="
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      position: relative;
    "><div style="
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(45deg);
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
    "></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
    });

interface LocationViewMapProps {
    latitude: number;
    longitude: number;
    address?: string;
    recipientName?: string;
    compact?: boolean; // For mobile-first design
}

export function LocationViewMap({
    latitude,
    longitude,
    address,
    recipientName,
    compact = false
}: LocationViewMapProps) {
    const [isExpanded, setIsExpanded] = useState(!compact);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    // Initialize map when expanded
    useEffect(() => {
        if (!isExpanded || !mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [latitude, longitude],
            zoom: 16,
            zoomControl: true,
            scrollWheelZoom: false, // Prevent accidental zooms
            dragging: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Add marker
        L.marker([latitude, longitude], {
            icon: createDeliveryPinIcon(),
        }).addTo(map);

        mapRef.current = map;

        // Cleanup
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [isExpanded, latitude, longitude]);

    // Re-center map if coordinates change
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.setView([latitude, longitude], 16);
        }
    }, [latitude, longitude]);

    return (
        <Card className="overflow-hidden border-emerald-200 dark:border-emerald-800">
            {/* Header - Always visible */}
            <button
                type="button"
                className="w-full flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <div className="bg-emerald-500 p-1.5 rounded-full">
                        <MapPin size={16} strokeWidth={1.5} className=" text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                            📍 GPS Location Pinned
                        </p>
                        {recipientName && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                {recipientName}'s delivery location
                            </p>
                        )}
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp size={20} strokeWidth={1.5} className=" text-emerald-600" />
                ) : (
                    <ChevronDown size={20} strokeWidth={1.5} className=" text-emerald-600" />
                )}
            </button>

            {/* Expandable content */}
            {isExpanded && (
                <CardContent className="p-0">
                    {/* Map */}
                    <div
                        ref={mapContainerRef}
                        className="h-48 md:h-64 w-full"
                        style={{ zIndex: 1 }}
                    />

                    {/* Info & Actions */}
                    <div className="p-3 space-y-3 bg-background">
                        {/* Coordinates */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Lat: {latitude.toFixed(6)}</span>
                            <span>Lng: {longitude.toFixed(6)}</span>
                        </div>

                        {/* Address if available */}
                        {address && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {address}
                            </p>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                asChild
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
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
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            This is the exact location the buyer pinned for delivery
                        </p>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

export default LocationViewMap;
