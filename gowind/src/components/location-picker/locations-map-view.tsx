import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cx } from "@/utils/cx";
import type { Location } from "@/types/setup";

// Fix for default marker icons in react-leaflet with bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

function FitBounds({ locations }: { locations: Location[] }) {
    const map = useMap();
    useEffect(() => {
        if (locations.length === 0) return;
        if (locations.length === 1) {
            map.flyTo([locations[0].lat, locations[0].lng], 12);
            return;
        }
        const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng] as L.LatLngTuple));
        map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }, [map, locations]);
    return null;
}

interface LocationsMapViewProps {
    locations: Location[];
    className?: string;
    height?: string;
}

export function LocationsMapView({ locations, className, height = "280px" }: LocationsMapViewProps) {
    const center = locations.length > 0 ? [locations[0].lat, locations[0].lng] : DEFAULT_CENTER;

    return (
        <div
            className={cx(
                "overflow-hidden rounded-xl border border-secondary bg-white dark:bg-primary",
                className
            )}
        >
            <div style={{ height }} className="w-full">
                <MapContainer
                    center={center as [number, number]}
                    zoom={locations.length > 0 ? 10 : DEFAULT_ZOOM}
                    className="h-full w-full"
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {locations.map((loc) => (
                        <Marker key={loc.id} position={[loc.lat, loc.lng]} />
                    ))}
                    {locations.length > 0 && <FitBounds locations={locations} />}
                </MapContainer>
            </div>
        </div>
    );
}
