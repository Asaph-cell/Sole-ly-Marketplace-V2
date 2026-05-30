/**
 * LocationPinMap Component
 * 
 * WhatsApp-style GPS location pinning
 * Uses vanilla Leaflet (not react-leaflet) to avoid React 18 compatibility issues
 */

import { useState, useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MapPin, Navigation, X, RefreshCw } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const LOCATIONIQ_API_KEY = import.meta.env.VITE_LOCATIONIQ_API_KEY || "pk.2b634b704d19e634a5f2466959347388";

// Nairobi center as default
const DEFAULT_CENTER: [number, number] = [-1.2921, 36.8219];

interface LocationData {
    latitude: number;
    longitude: number;
    address: string;
    googleMapsLink: string;
    // Parsed address components for auto-fill
    addressLine1: string;
    city: string;
    county: string;
}

interface LocationPinMapProps {
    onLocationSelect: (data: LocationData) => void;
    initialPosition?: [number, number];
}

// Create custom red pin icon
const createPinIcon = () =>
    L.divIcon({
        className: "custom-pin-icon",
        html: `<div style="
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      width: 28px;
      height: 28px;
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
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
    "></div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
    });

export function LocationPinMap({ onLocationSelect, initialPosition }: LocationPinMapProps) {
    const [isMapVisible, setIsMapVisible] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [markerPosition, setMarkerPosition] = useState<[number, number]>(
        initialPosition || DEFAULT_CENTER
    );
    const [geocodedAddress, setGeocodedAddress] = useState<string>("");
    const [parsedAddress, setParsedAddress] = useState<{
        road?: string;
        suburb?: string;
        city?: string;
        county?: string;
        state?: string;
    }>({});
    const [error, setError] = useState<string | null>(null);
    const [hasConfirmed, setHasConfirmed] = useState(false);

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    // Reverse geocode coordinates to address
    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        if (!LOCATIONIQ_API_KEY) {
            setGeocodedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            return;
        }

        setIsGeocoding(true);
        try {
            const response = await fetch(
                `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_API_KEY}&lat=${lat}&lon=${lng}&format=json`
            );

            if (!response.ok) {
                throw new Error("Geocoding failed");
            }

            const data = await response.json();
            const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setGeocodedAddress(address);

            // Parse address components for auto-fill
            if (data.address) {
                setParsedAddress({
                    road: data.address.road || data.address.pedestrian || data.address.footway,
                    suburb: data.address.suburb || data.address.neighbourhood || data.address.residential,
                    city: data.address.city || data.address.town || data.address.village,
                    county: data.address.county || data.address.state_district,
                    state: data.address.state,
                });
            }
        } catch (err) {
            console.error("Reverse geocoding error:", err);
            setGeocodedAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            setParsedAddress({});
        } finally {
            setIsGeocoding(false);
        }
    }, []);

    // Initialize map when container becomes visible
    useEffect(() => {
        if (!isMapVisible || !mapContainerRef.current || mapRef.current) return;

        // Create map
        const map = L.map(mapContainerRef.current, {
            center: markerPosition,
            zoom: 16,
            zoomControl: true,
        });

        // Add OpenStreetMap tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Add draggable marker
        const marker = L.marker(markerPosition, {
            draggable: true,
            icon: createPinIcon(),
        }).addTo(map);

        // Handle marker drag
        marker.on("dragend", () => {
            const pos = marker.getLatLng();
            setMarkerPosition([pos.lat, pos.lng]);
            setHasConfirmed(false);
            reverseGeocode(pos.lat, pos.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;

        // Initial geocode
        reverseGeocode(markerPosition[0], markerPosition[1]);

        // Cleanup
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [isMapVisible, reverseGeocode]);

    // Update marker and map when position changes
    useEffect(() => {
        if (mapRef.current && markerRef.current) {
            markerRef.current.setLatLng(markerPosition);
            mapRef.current.flyTo(markerPosition, 16);
        }
    }, [markerPosition]);

    // Get user's current location
    const handlePinLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            return;
        }

        setIsLocating(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setMarkerPosition([latitude, longitude]);
                setIsMapVisible(true);
                setIsLocating(false);
            },
            (err) => {
                setIsLocating(false);
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError("Location permission denied. Please enable it in your browser settings.");
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setError("Location unavailable. Please try again.");
                        break;
                    case err.TIMEOUT:
                        setError("Location request timed out. Please try again.");
                        break;
                    default:
                        setError("Failed to get your location.");
                }
                // Show map at default location anyway
                setIsMapVisible(true);
            },
            {
                enableHighAccuracy: true,
                timeout: 30000, // 30 seconds timeout
                maximumAge: 0,
            }
        );
    };

    // Confirm and save location
    const handleConfirmLocation = () => {
        const [lat, lng] = markerPosition;
        const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

        // Build address line from parsed components
        const addressLine1 = [
            parsedAddress.road,
            parsedAddress.suburb
        ].filter(Boolean).join(', ') || geocodedAddress.split(',')[0] || '';

        onLocationSelect({
            latitude: lat,
            longitude: lng,
            address: geocodedAddress,
            googleMapsLink,
            addressLine1,
            city: parsedAddress.city || parsedAddress.suburb || '',
            county: parsedAddress.county || parsedAddress.state || 'Nairobi',
        });

        setHasConfirmed(true);
    };

    // Close map
    const handleCloseMap = () => {
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
            markerRef.current = null;
        }
        setIsMapVisible(false);
        setError(null);
    };

    return (
        <div className="space-y-3">
            {/* Pin Location Button */}
            {!isMapVisible && (
                <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 gap-2 border-dashed border-2"
                    onClick={handlePinLocation}
                    disabled={isLocating}
                >
                    {isLocating ? (
                        <>
                            <Loader2 size={20} strokeWidth={1.5} className=" animate-spin" />
                            Getting your location...
                        </>
                    ) : (
                        <>
                            <Navigation size={20} strokeWidth={1.5}  />
                            📍 Pin My Exact Location (GPS)
                        </>
                    )}
                </Button>
            )}

            {error && (
                <div className="flex items-center gap-2">
                    <p className="text-sm text-destructive flex-1">{error}</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 shrink-0"
                        onClick={handlePinLocation}
                        disabled={isLocating}
                    >
                        <RefreshCw size={16} strokeWidth={1.5}  />
                        Try Again
                    </Button>
                </div>
            )}

            {/* Map Container */}
            {isMapVisible && (
                <Card className="overflow-hidden">
                    <div className="relative">
                        {/* Map control buttons */}
                        <div className="absolute top-2 right-2 z-[1000] flex gap-2">
                            {/* Re-detect GPS button */}
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 gap-1 bg-white/90 hover:bg-white text-xs"
                                onClick={handlePinLocation}
                                disabled={isLocating}
                            >
                                {isLocating ? (
                                    <Loader2 strokeWidth={1.5} className="h-3 w-3 animate-spin" />
                                ) : (
                                    <RefreshCw strokeWidth={1.5} className="h-3 w-3" />
                                )}
                                Re-detect GPS
                            </Button>
                            {/* Close button */}
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 bg-white/90 hover:bg-white"
                                onClick={handleCloseMap}
                            >
                                <X size={16} strokeWidth={1.5}  />
                            </Button>
                        </div>

                        {/* Leaflet Map Container */}
                        <div
                            ref={mapContainerRef}
                            className="h-[300px] w-full"
                            style={{ zIndex: 1 }}
                        />
                    </div>

                    <CardContent className="p-4 space-y-3">
                        {/* Geocoded Address */}
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Pinned Location:</p>
                            {isGeocoding ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 strokeWidth={1.5} className="h-3 w-3 animate-spin" />
                                    Getting address...
                                </div>
                            ) : (
                                <p className="text-sm font-medium line-clamp-2">{geocodedAddress}</p>
                            )}
                        </div>

                        {/* Coordinates */}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Lat: {markerPosition[0].toFixed(6)}</span>
                            <span>Lng: {markerPosition[1].toFixed(6)}</span>
                        </div>

                        {/* Instructions */}
                        <p className="text-xs text-muted-foreground italic">
                            💡 Drag the pin to your exact gate or building entrance
                        </p>

                        {/* Confirm Button */}
                        <Button
                            type="button"
                            className="w-full gap-2"
                            onClick={handleConfirmLocation}
                            disabled={isGeocoding}
                        >
                            <MapPin size={16} strokeWidth={1.5}  />
                            {hasConfirmed ? "✓ Location Saved" : "Confirm This Location"}
                        </Button>

                        {hasConfirmed && (
                            <p className="text-xs text-green-600 dark:text-green-400 text-center">
                                ✓ GPS coordinates saved! Rider will receive a Google Maps link.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default LocationPinMap;
