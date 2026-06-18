import { useMemo } from "react";
import { useT } from "@/providers/locale-provider";
import { cx } from "@/utils/cx";
import type { WeatherHeightFt } from "@/types/setup";

const HEIGHT_VALUES: { value: WeatherHeightFt; key: string; ft?: number }[] = [
    { value: "ground", key: "ground10m", ft: 0 },
    { value: 500, key: "ft500", ft: 500 },
    { value: 1000, key: "ft1000", ft: 1000 },
    { value: 2000, key: "ft2000", ft: 2000 },
    { value: 3000, key: "ft3000", ft: 3000 },
    { value: 5000, key: "ft5000", ft: 5000 },
    { value: 10000, key: "ft10000", ft: 10000 },
];

interface AltitudeHeightSelectorProps {
    value: WeatherHeightFt[];
    onChange: (value: WeatherHeightFt[]) => void;
    className?: string;
}

export function AltitudeHeightSelector({ value, onChange, className }: AltitudeHeightSelectorProps) {
    const t = useT();
    const selected = new Set(value);

    const heights = useMemo(
        () =>
            HEIGHT_VALUES.map((h) => ({
                ...h,
                label: t(`preferences.heights.${h.key}`),
            })),
        [t],
    );

    const summaryLabel = (selectedHeights: WeatherHeightFt[]): string => {
        if (selectedHeights.length === 0) return t("preferences.heights.summarySingleGround");
        if (selectedHeights.length === 1) {
            const v = selectedHeights[0];
            return v === "ground"
                ? t("preferences.heights.ground10m")
                : t("preferences.heights.summarySingle", { height: v });
        }
        const sorted = [...selectedHeights].sort((a, b) => {
            const av = a === "ground" ? 0 : a;
            const bv = b === "ground" ? 0 : b;
            return av - bv;
        });
        const lo =
            sorted[0] === "ground"
                ? t("preferences.heights.summarySingleGround")
                : t("preferences.heights.summarySingle", { height: sorted[0] });
        const hi =
            sorted[sorted.length - 1] === "ground"
                ? t("preferences.heights.summarySingleGround")
                : t("preferences.heights.summarySingle", { height: sorted[sorted.length - 1] });
        return t("preferences.heights.summaryRange", { low: lo, high: hi });
    };

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
            aria-label={t("preferences.heights.aria")}
        >
            <div className="relative overflow-hidden rounded-xl bg-slate-800 p-4 dark:bg-slate-900">
                <div className="relative flex h-56 flex-col overflow-hidden rounded-lg ring-1 ring-white/10">
                    <div
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, #93c5fd 0%, #60a5fa 20%, #3b82f6 45%, #1e5bb5 70%, #4ade80 90%, #22c55e 100%)",
                        }}
                    />
                    <div className="absolute left-2 top-2 z-20 text-[10px] font-semibold uppercase tracking-wider text-white/80">
                        {t("preferences.heights.sky")}
                    </div>
                    <div className="absolute bottom-2 left-2 z-20 text-[10px] font-semibold uppercase tracking-wider text-white/80">
                        {t("preferences.heights.ground")}
                    </div>
                    {[...heights].reverse().map((opt) => {
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
                                title={`${opt.label}${isSelected ? t("preferences.heights.selected") : t("preferences.heights.clickToSelect")}`}
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
                <p className="mt-3 text-center text-xs font-medium text-white/80">
                    {summaryLabel(value)}
                </p>
            </div>
        </div>
    );
}
