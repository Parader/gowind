import { cx } from "@/utils/cx";
import type { WeatherHeightFt } from "@/types/setup";

const HEIGHTS: { value: WeatherHeightFt; label: string; ft?: number }[] = [
    { value: "ground", label: "Ground (10m)", ft: 0 },
    { value: 500, label: "500 ft", ft: 500 },
    { value: 1000, label: "1,000 ft", ft: 1000 },
    { value: 2000, label: "2,000 ft", ft: 2000 },
    { value: 3000, label: "3,000 ft", ft: 3000 },
    { value: 5000, label: "5,000 ft", ft: 5000 },
    { value: 10000, label: "10,000 ft", ft: 10000 },
];

function summaryLabel(selected: WeatherHeightFt[]): string {
    if (selected.length === 0) return "Ground";
    if (selected.length === 1) {
        const v = selected[0];
        return v === "ground" ? "Ground (10m)" : `${v} ft`;
    }
    const sorted = [...selected].sort((a, b) => {
        const av = a === "ground" ? 0 : a;
        const bv = b === "ground" ? 0 : b;
        return av - bv;
    });
    const lo = sorted[0] === "ground" ? "Ground" : `${sorted[0]} ft`;
    const hi = sorted[sorted.length - 1] === "ground" ? "Ground" : `${sorted[sorted.length - 1]} ft`;
    return `${lo} → ${hi}`;
}

interface AltitudeHeightSelectorProps {
    value: WeatherHeightFt[];
    onChange: (value: WeatherHeightFt[]) => void;
    className?: string;
}

export function AltitudeHeightSelector({ value, onChange, className }: AltitudeHeightSelectorProps) {
    const selected = new Set(value);

    const toggle = (h: WeatherHeightFt) => {
        const next = selected.has(h)
            ? [...value].filter((x) => x !== h)
            : [...value, h];
        onChange(next.length > 0 ? next : ["ground"]);
    };

    return (
        <div
            className={cx(
                "w-full min-w-0 overflow-hidden rounded-xl border border-secondary bg-white shadow-sm dark:bg-primary",
                className
            )}
            role="group"
            aria-label="Select weather data altitudes (ground to sky)"
        >
            {/* Main visual: dark navy card (like Preferred Direction in mockup) */}
            <div className="relative overflow-hidden rounded-xl bg-slate-800 p-4 dark:bg-slate-900">
                <div className="relative flex h-56 flex-col overflow-hidden rounded-lg ring-1 ring-white/10">
                    {/* Sky-to-ground gradient background */}
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, #93c5fd 0%, #60a5fa 20%, #3b82f6 45%, #1e5bb5 70%, #4ade80 90%, #22c55e 100%)",
                        }}
                    />
                    {/* Compass-like labels */}
                    <div className="absolute left-2 top-2 z-20 text-[10px] font-semibold uppercase tracking-wider text-white/80">
                        Sky
                    </div>
                    <div className="absolute bottom-2 left-2 z-20 text-[10px] font-semibold uppercase tracking-wider text-white/80">
                        Ground
                    </div>
                    {/* Clickable bands with green wedge overlay when selected */}
                    {[...HEIGHTS].reverse().map((opt) => {
                        const isSelected = selected.has(opt.value);
                        const isGround = opt.value === "ground";
                        return (
                            <button
                                key={String(opt.value)}
                                type="button"
                                onClick={() => toggle(opt.value)}
                                className={cx(
                                    "relative z-10 flex flex-1 items-center justify-center border-b border-white/15 last:border-b-0 transition-all",
                                    isSelected
                                        ? "bg-emerald-500/50 ring-1 ring-emerald-400/60 ring-inset"
                                        : "bg-transparent hover:bg-white/20",
                                    opt.value === 10000 && "rounded-t-md",
                                    isGround && "rounded-b-md"
                                )}
                                title={`${opt.label}${isSelected ? " (selected)" : " (click to select)"}`}
                            >
                                <span
                                    className={cx(
                                        "text-xs font-medium",
                                        isSelected ? "text-white drop-shadow" : "text-white/90"
                                    )}
                                >
                                    {opt.label}
                                </span>
                                {isSelected && (
                                    <span
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-white"
                                        aria-hidden
                                    >
                                        ✓
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                {/* Footer summary (like "On-shore & Side-shore focus") */}
                <p className="mt-3 text-center text-xs font-medium text-white/80">
                    {summaryLabel(value)}
                </p>
            </div>
        </div>
    );
}
