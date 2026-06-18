import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SearchLg } from "@untitledui/icons";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cx } from "@/utils/cx";
import { useT } from "@/providers/locale-provider";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

interface GeocodeResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
}

// Fix for default marker icons in react-leaflet with bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795]; // Center of USA
const DEFAULT_ZOOM = 4;

interface MapClickHandlerProps {
    onLocationSelect: (lat: number, lng: number) => void;
}

function MapClickHandler({ onLocationSelect }: MapClickHandlerProps) {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function FlyToPosition({ position }: { position: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(position, 12);
    }, [map, position]);
    return null;
}

function formatPlaceLabel(r: GeocodeResult): string {
    const parts = [r.name, r.admin1, r.country].filter(Boolean);
    return parts.join(", ");
}

interface LocationMapPickerProps {
    value?: { lat: number; lng: number } | null;
    onChange: (lat: number, lng: number) => void;
    /** When user picks a place from search, suggested label for the location name field */
    onSearchPlaceSelect?: (displayName: string) => void;
    className?: string;
    height?: string;
}

export function LocationMapPicker({
    value,
    onChange,
    onSearchPlaceSelect,
    className,
    height = "320px",
}: LocationMapPickerProps) {
    const t = useT();
    const searchId = useId();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GeocodeResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const handleLocationSelect = useCallback(
        (lat: number, lng: number) => {
            onChange(lat, lng);
        },
        [onChange]
    );

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        const ac = new AbortController();
        const t = window.setTimeout(async () => {
            try {
                const url = `${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
                const res = await fetch(url, { signal: ac.signal });
                if (!res.ok) throw new Error("Geocode failed");
                const data = (await res.json()) as { results?: GeocodeResult[] };
                setResults(data.results ?? []);
                setOpen(true);
            } catch {
                if (!ac.signal.aborted) {
                    setResults([]);
                }
            } finally {
                if (!ac.signal.aborted) setLoading(false);
            }
        }, 350);
        return () => {
            clearTimeout(t);
            ac.abort();
        };
    }, [query]);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const pickResult = useCallback(
        (r: GeocodeResult) => {
            handleLocationSelect(r.latitude, r.longitude);
            onSearchPlaceSelect?.(formatPlaceLabel(r));
            setQuery(formatPlaceLabel(r));
            setOpen(false);
            setResults([]);
        },
        [handleLocationSelect, onSearchPlaceSelect]
    );

    const center = value ? ([value.lat, value.lng] as [number, number]) : DEFAULT_CENTER;

    return (
        <div className={cx("overflow-hidden rounded-xl border border-secondary", className)}>
            <div ref={wrapRef} className="relative border-b border-secondary bg-secondary_alt/20 px-3 py-2">
                <label htmlFor={searchId} className="sr-only">
                    {t("locationPicker.mapPicker.searchAria")}
                </label>
                <div className="relative">
                    <SearchLg
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-quaternary"
                        strokeWidth={1.5}
                        aria-hidden
                    />
                    <input
                        id={searchId}
                        type="search"
                        autoComplete="off"
                        placeholder={t("locationPicker.mapPicker.searchPlaceholder")}
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            if (e.target.value.trim().length >= 2) setOpen(true);
                        }}
                        onFocus={() => {
                            if (results.length > 0) setOpen(true);
                        }}
                        className="w-full rounded-lg border border-secondary bg-white py-2.5 pl-10 pr-3 text-sm text-primary shadow-xs ring-1 ring-secondary ring-inset placeholder:text-quaternary focus:border-brand-300 focus:outline-hidden focus:ring-2 focus:ring-brand dark:bg-primary dark:ring-primary"
                    />
                    {loading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-tertiary">
                            …
                        </span>
                    )}
                </div>
                {open && results.length > 0 && (
                    <ul
                        className="absolute left-3 right-3 top-full z-[1000] mt-1 max-h-56 overflow-auto rounded-lg border border-secondary bg-white py-1 shadow-lg dark:bg-primary"
                        role="listbox"
                    >
                        {results.map((r) => (
                            <li key={r.id}>
                                <button
                                    type="button"
                                    role="option"
                                    className="w-full px-3 py-2 text-left text-sm text-primary hover:bg-secondary_alt"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pickResult(r)}
                                >
                                    <span className="font-medium">{r.name}</span>
                                    {(r.admin1 || r.country) && (
                                        <span className="block text-xs text-tertiary">
                                            {[r.admin1, r.country].filter(Boolean).join(", ")}
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {open && !loading && query.trim().length >= 2 && results.length === 0 && (
                    <p className="absolute left-3 right-3 top-full z-[1000] mt-1 rounded-lg border border-secondary bg-white px-3 py-2 text-sm text-tertiary shadow-lg dark:bg-primary">
                        {t("locationPicker.mapPicker.noResults")}
                    </p>
                )}
            </div>
            <div style={{ height }} className="w-full">
                <MapContainer
                    center={center}
                    zoom={value ? 12 : DEFAULT_ZOOM}
                    className="h-full w-full"
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onLocationSelect={handleLocationSelect} />
                    {value && (
                        <>
                            <Marker position={[value.lat, value.lng]} />
                            <FlyToPosition position={[value.lat, value.lng]} />
                        </>
                    )}
                </MapContainer>
            </div>
            <p className="border-t border-secondary bg-secondary_alt/30 px-4 py-2 text-sm text-tertiary">
                {t("locationPicker.mapPicker.hint")}
            </p>
        </div>
    );
}
