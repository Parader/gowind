import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { useSearchParams } from "react-router";
import {
    ChevronDown,
    Clock,
    Save01,
    Sun,
    Thermometer02,
    Wind03,
} from "@untitledui/icons";
import { AltitudeHeightSelector } from "@/components/preferences/altitude-height-selector";
import {
    Dialog,
    DialogTrigger,
    Modal,
    ModalHeader,
    ModalOverlay,
} from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { Slider } from "@/components/base/slider/slider";
import { Toggle } from "@/components/base/toggle/toggle";
import { useSetup, defaultPreferences } from "@/providers/setup-provider";
import { SPORT_PRESETS } from "@/components/onboarding/onboarding-data";
import { cx } from "@/utils/cx";
import type { ReactNode } from "react";
import type { Preferences, WeatherHeightFt } from "@/types/setup";

const WEATHER_HEIGHT_OPTIONS: { value: WeatherHeightFt; label: string }[] = [
    { value: "ground", label: "Ground (10m)" },
    { value: 500, label: "500 ft" },
    { value: 1000, label: "1,000 ft" },
    { value: 2000, label: "2,000 ft" },
    { value: 3000, label: "3,000 ft" },
    { value: 5000, label: "5,000 ft" },
    { value: 10000, label: "10,000 ft" },
];

const TIME_OF_DAY_OPTIONS = [
    { id: "morning", label: "Morning", start: 6, end: 12 },
    { id: "afternoon", label: "Afternoon", start: 12, end: 17 },
    { id: "evening", label: "Evening", start: 17, end: 24 },
    { id: "anytime", label: "Anytime", start: 0, end: 24 },
] as const;

type PreferredTimeBlock = { id: string; label: string; start: number; end: number };

function normalizePreferredTimeBlocks(blocks: PreferredTimeBlock[]): PreferredTimeBlock[] {
    const valid = blocks.filter((b) => TIME_OF_DAY_OPTIONS.some((o) => o.id === b.id));
    if (valid.length <= 1) return valid;

    const specificBlocks = valid.filter((b) => b.id !== "anytime");
    return specificBlocks.length > 0 ? specificBlocks : valid.slice(0, 1);
}

export type PreferenceSectionId = "wind" | "altitude" | "comfort" | "timing";

const PREFERENCE_SECTIONS: {
    id: PreferenceSectionId;
    label: string;
    description: string;
}[] = [
    { id: "wind", label: "Wind", description: "Speed, gusts, and shear" },
    { id: "altitude", label: "Heights", description: "Which altitudes to use" },
    { id: "comfort", label: "Comfort & sky", description: "Temperature and precipitation" },
    { id: "timing", label: "Timing", description: "Time of day and session length" },
];

const kphToKnots = (kph: number) => Math.round(kph * 0.539957);

export type PreferencesFormHandle = {
    /** Persist current form state to setup context and return the merged preferences. */
    flushSave: () => Preferences;
};

export interface PreferencesFormProps {
    /** Use local section state instead of URL `?section=` (e.g. onboarding). */
    embedded?: boolean;
    /** Hide the floating save button (e.g. onboarding uses Continue). */
    hideFloatingSave?: boolean;
    /** When set, written as `sports` on save instead of context `preferences.sports`. */
    sportsFromParent?: string[];
    /**
     * With `embedded`: hide category sidebar and show only this panel at full width
     * (e.g. one wizard step per category).
     */
    embeddedLockedSection?: PreferenceSectionId;
}

export const PreferencesForm = forwardRef<PreferencesFormHandle, PreferencesFormProps>(
    function PreferencesForm(
        { embedded = false, hideFloatingSave = false, sportsFromParent, embeddedLockedSection },
        ref
    ) {
    const { preferences, setPreferences } = useSetup();
    const [searchParams, setSearchParams] = useSearchParams();
    const [embeddedSection, setEmbeddedSection] = useState<PreferenceSectionId>("wind");

    const activeSection = useMemo((): PreferenceSectionId => {
        if (embedded && embeddedLockedSection) return embeddedLockedSection;
        if (embedded) return embeddedSection;
        const raw = searchParams.get("section");
        if (raw && PREFERENCE_SECTIONS.some((s) => s.id === raw)) {
            return raw as PreferenceSectionId;
        }
        return "wind";
    }, [embedded, embeddedSection, embeddedLockedSection, searchParams]);

    const setSection = (id: PreferenceSectionId) => {
        if (embedded) {
            setEmbeddedSection(id);
            return;
        }
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set("section", id);
                return next;
            },
            { replace: true }
        );
    };

    const [windUnit, setWindUnit] = useState<"knots" | "km/h">("km/h");
    const [minWindKph, setMinWindKph] = useState(
        preferences?.minWindKph ?? defaultPreferences.minWindKph ?? 0
    );
    const [maxWindKph, setMaxWindKph] = useState(
        preferences?.maxWindKph ?? defaultPreferences.maxWindKph
    );
    const [maxGustKph, setMaxGustKph] = useState(
        preferences?.maxGustKph ?? defaultPreferences.maxGustKph
    );
    const [maxGustWindDifferenceKph, setMaxGustWindDifferenceKph] = useState(
        preferences?.maxGustWindDifferenceKph ?? 15
    );
    const normalizeHeights = (v: unknown): WeatherHeightFt[] => {
        if (Array.isArray(v) && v.length > 0) return v as WeatherHeightFt[];
        if (
            v === "ground" ||
            (typeof v === "number" &&
                WEATHER_HEIGHT_OPTIONS.some((o) => o.value === v))
        )
            return [v as WeatherHeightFt];
        return ["ground"];
    };
    const sortHeights = (arr: WeatherHeightFt[]) =>
        [...arr].sort(
            (a, b) =>
                (a === "ground"
                    ? -1
                    : WEATHER_HEIGHT_OPTIONS.findIndex((o) => o.value === a)) -
                (b === "ground"
                    ? -1
                    : WEATHER_HEIGHT_OPTIONS.findIndex((o) => o.value === b))
        );
    const [weatherHeightFt, setWeatherHeightFt] = useState<WeatherHeightFt[]>(
        () =>
            normalizeHeights(
                preferences?.weatherHeightFt ?? defaultPreferences.weatherHeightFt
            )
    );
    const [minTempC, setMinTempC] = useState(preferences?.minTempC ?? 0);
    const [maxTempC, setMaxTempC] = useState(preferences?.maxTempC ?? 35);
    const [useFeelsLikeTemp, setUseFeelsLikeTemp] = useState(
        preferences?.useFeelsLikeTemp ?? false
    );
    const [maxPrecipitationProbabilityPercent, setMaxPrecipitationProbabilityPercent] =
        useState(preferences?.maxPrecipitationProbabilityPercent ?? 20);

    const [preferredTimeBlocks, setPreferredTimeBlocks] = useState<PreferredTimeBlock[]>(() => {
        if (preferences?.preferredTimeBlocks?.length) {
            const filtered = preferences.preferredTimeBlocks.filter((b): b is PreferredTimeBlock =>
                TIME_OF_DAY_OPTIONS.some((o) => o.id === b.id)
            );
            if (filtered.length > 0) return normalizePreferredTimeBlocks(filtered);
        }
        const old = preferences?.preferredTimeOfDay ?? "anytime";
        const opt =
            TIME_OF_DAY_OPTIONS.find((o) => o.id === old) ??
            TIME_OF_DAY_OPTIONS.find((o) => o.id === "anytime")!;
        return [{ id: opt.id, label: opt.label, start: opt.start, end: opt.end === 24 ? 24 : opt.end }];
    });
    const [minSessionLengthMinutes, setMinSessionLengthMinutes] = useState(
        preferences?.minSessionLengthMinutes ?? 60
    );
    const [presetPendingId, setPresetPendingId] = useState<string | null>(null);

    useEffect(() => {
        if (!preferences) return;
        setMinWindKph(preferences.minWindKph ?? defaultPreferences.minWindKph ?? 0);
        setMaxWindKph(preferences.maxWindKph);
        setMaxGustKph(preferences.maxGustKph);
        setMaxGustWindDifferenceKph(preferences.maxGustWindDifferenceKph ?? 15);
        setWeatherHeightFt(
            normalizeHeights(preferences.weatherHeightFt ?? defaultPreferences.weatherHeightFt)
        );
        setMinTempC(preferences.minTempC ?? 0);
        setMaxTempC(preferences.maxTempC ?? 35);
        setUseFeelsLikeTemp(preferences.useFeelsLikeTemp ?? false);
        setMaxPrecipitationProbabilityPercent(
            preferences.maxPrecipitationProbabilityPercent ?? 20
        );
        if (preferences.preferredTimeBlocks?.length) {
            const filtered = preferences.preferredTimeBlocks.filter((b): b is PreferredTimeBlock =>
                TIME_OF_DAY_OPTIONS.some((o) => o.id === b.id)
            );
            if (filtered.length > 0) setPreferredTimeBlocks(normalizePreferredTimeBlocks(filtered));
        }
        setMinSessionLengthMinutes(preferences.minSessionLengthMinutes ?? 60);
    }, [preferences]);

    const applySportPreset = (sportId: string) => {
        const preset = SPORT_PRESETS[sportId];
        if (preset) {
            setMinWindKph(preset.minWindKph);
            setMaxWindKph(preset.maxWindKph);
            setMaxGustKph(preset.maxGustKph);
            if (preset.maxGustWindDifferenceKph != null)
                setMaxGustWindDifferenceKph(preset.maxGustWindDifferenceKph);
            setMinTempC(preset.minTempC);
            setMaxTempC(preset.maxTempC);
            setUseFeelsLikeTemp(preset.useFeelsLikeTemp ?? false);
            setMaxPrecipitationProbabilityPercent(preset.maxPrecipitationProbabilityPercent);
            const timeOpt = TIME_OF_DAY_OPTIONS.find(
                (o) => o.id === (preset.preferredTimeOfDay ?? "anytime")
            );
            if (timeOpt) {
                setPreferredTimeBlocks([
                    {
                        id: timeOpt.id,
                        label: timeOpt.label,
                        start: timeOpt.start,
                        end: timeOpt.end === 24 ? 24 : timeOpt.end,
                    },
                ]);
            }
            setMinSessionLengthMinutes(preset.minSessionLengthMinutes);
        }
    };

    const buildPrefs = (): Preferences => ({
        ...defaultPreferences,
        ...preferences,
        minWindKph,
        maxWindKph,
        maxGustKph,
        maxGustWindDifferenceKph,
        weatherHeightFt:
            (weatherHeightFt?.length ? weatherHeightFt : ["ground"]) as WeatherHeightFt[],
        minTempC,
        maxTempC,
        useFeelsLikeTemp,
        maxPrecipitationProbabilityPercent,
        preferredTimeBlocks: normalizePreferredTimeBlocks(preferredTimeBlocks),
        minSessionLengthMinutes,
        sports: sportsFromParent ?? preferences?.sports,
    });

    const save = () => {
        setPreferences(buildPrefs());
    };

    useImperativeHandle(ref, () => ({
        flushSave: () => {
            const prefs = buildPrefs();
            setPreferences(prefs);
            return prefs;
        },
    }));

    const hasChanges =
        minWindKph !== (preferences?.minWindKph ?? defaultPreferences.minWindKph ?? 0) ||
        maxWindKph !== (preferences?.maxWindKph ?? defaultPreferences.maxWindKph) ||
        maxGustKph !== (preferences?.maxGustKph ?? defaultPreferences.maxGustKph) ||
        maxGustWindDifferenceKph !==
            (preferences?.maxGustWindDifferenceKph ?? 15) ||
        JSON.stringify(sortHeights(weatherHeightFt || [])) !==
            JSON.stringify(
                sortHeights(
                    normalizeHeights(
                        preferences?.weatherHeightFt ?? defaultPreferences.weatherHeightFt
                    )
                )
            ) ||
        minTempC !== (preferences?.minTempC ?? 0) ||
        maxTempC !== (preferences?.maxTempC ?? 35) ||
        useFeelsLikeTemp !== (preferences?.useFeelsLikeTemp ?? false) ||
        maxPrecipitationProbabilityPercent !==
            (preferences?.maxPrecipitationProbabilityPercent ?? 20) ||
        JSON.stringify(preferredTimeBlocks) !==
            JSON.stringify(preferences?.preferredTimeBlocks ?? []) ||
        minSessionLengthMinutes !==
            (preferences?.minSessionLengthMinutes ?? 60);

    useEffect(() => {
        if (!hasChanges) return;
        const timeout = window.setTimeout(save, 500);
        return () => window.clearTimeout(timeout);
    }, [
        hasChanges,
        minWindKph,
        maxWindKph,
        maxGustKph,
        maxGustWindDifferenceKph,
        weatherHeightFt,
        minTempC,
        maxTempC,
        useFeelsLikeTemp,
        maxPrecipitationProbabilityPercent,
        preferredTimeBlocks,
        minSessionLengthMinutes,
    ]);

    const windLabel =
        windUnit === "knots"
            ? `${kphToKnots(minWindKph)} — ${kphToKnots(maxWindKph)} kts`
            : `${minWindKph} — ${maxWindKph} km/h`;
    const gustLabel =
        windUnit === "knots"
            ? `${kphToKnots(maxGustKph)} kts`
            : `${maxGustKph} km/h`;
    const gustDiffLabel =
        windUnit === "knots"
            ? `${kphToKnots(maxGustWindDifferenceKph)} kts`
            : `${maxGustWindDifferenceKph} km/h`;
    const sessionHours = (minSessionLengthMinutes / 60).toFixed(1);

    const cardCls =
        "overflow-hidden rounded-xl border border-secondary bg-white shadow-sm dark:bg-primary";

    const sectionNav = (
        <nav className="w-full shrink-0 lg:w-52" aria-label="Preference categories">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                Categories
            </p>
            <ul
                className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
                role="tablist"
            >
                {PREFERENCE_SECTIONS.map((s) => (
                    <li key={s.id} className="shrink-0 lg:w-full">
                        <button
                            type="button"
                            role="tab"
                            id={`pref-tab-${s.id}`}
                            aria-selected={activeSection === s.id}
                            onClick={() => setSection(s.id)}
                            className={cx(
                                "border text-left transition",
                                "w-max rounded-full px-3.5 py-2 text-sm font-medium lg:w-full lg:rounded-lg lg:px-3 lg:py-2.5",
                                activeSection === s.id
                                    ? "border-brand-600 bg-brand-50 text-brand-800 dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-200 lg:border-brand-500/40 lg:bg-brand-50 lg:text-primary lg:shadow-sm dark:lg:border-brand-500/25 dark:lg:bg-brand-950/35"
                                    : "border-secondary bg-primary text-secondary hover:bg-secondary_alt lg:border-transparent lg:hover:border-secondary lg:hover:bg-secondary_alt/70"
                            )}
                        >
                            <span
                                className={cx(
                                    "block lg:font-semibold",
                                    activeSection === s.id ? "lg:text-primary" : "lg:text-secondary"
                                )}
                            >
                                {s.label}
                            </span>
                            <span className="mt-0.5 hidden text-xs font-normal text-tertiary lg:block">
                                {s.description}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );

    const renderPreferencesPanel = (): ReactNode => {
        switch (activeSection) {
            case "wind":
                return (
                    <div className={cx(cardCls)}>
                        <div className="flex items-center justify-between border-b border-secondary bg-secondary_alt/40 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Wind03 className="size-5 text-secondary" strokeWidth={1.5} />
                                <h4 className="text-sm font-semibold text-secondary">
                                    Wind Dynamics
                                </h4>
                            </div>
                            <div className="flex rounded-full border border-secondary bg-secondary_alt p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setWindUnit("knots")}
                                    className={cx(
                                        "rounded-full px-3 py-1 text-xs font-medium transition",
                                        windUnit === "knots"
                                            ? "bg-primary text-secondary shadow-sm"
                                            : "text-tertiary hover:text-secondary"
                                    )}
                                >
                                    Knots
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setWindUnit("km/h")}
                                    className={cx(
                                        "rounded-full px-3 py-1 text-xs font-medium transition",
                                        windUnit === "km/h"
                                            ? "bg-primary text-secondary shadow-sm"
                                            : "text-tertiary hover:text-secondary"
                                    )}
                                >
                                    km/h
                                </button>
                            </div>
                        </div>
                        <div className="space-y-6 p-4">
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-secondary">
                                        Wind speed range
                                    </span>
                                    <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                                        {windLabel}
                                    </span>
                                </div>
                                <Slider
                                    value={[minWindKph, maxWindKph]}
                                    onChange={(v) => {
                                        const arr = Array.isArray(v) ? v : [v];
                                        const a = arr[0] ?? minWindKph;
                                        const b = arr[1] ?? maxWindKph;
                                        setMinWindKph(Math.max(0, Math.min(a, b)));
                                        setMaxWindKph(Math.min(60, Math.max(a, b)));
                                    }}
                                    minValue={0}
                                    maxValue={60}
                                    step={1}
                                    labelPosition="default"
                                    formatOptions={{ style: "decimal", maximumFractionDigits: 0 }}
                                />
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-medium text-secondary">
                                        Max gust limit
                                    </span>
                                    <span className="rounded-lg bg-secondary_alt px-3 py-1.5 text-xs">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                                            Ideal gusting
                                        </span>
                                        <span className="ml-1 font-semibold text-secondary">
                                            Below {gustLabel}
                                        </span>
                                    </span>
                                </div>
                                <Slider
                                    value={maxGustKph}
                                    onChange={(v) =>
                                        setMaxGustKph(
                                            Array.isArray(v) ? v[0] ?? maxGustKph : v
                                        )
                                    }
                                    minValue={0}
                                    maxValue={80}
                                    step={1}
                                    labelPosition="default"
                                    formatOptions={{ style: "decimal", maximumFractionDigits: 0 }}
                                />
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-secondary">
                                        Max gust–wind difference
                                    </span>
                                    <span className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400">
                                        {gustDiffLabel}
                                    </span>
                                </div>
                                <Slider
                                    value={maxGustWindDifferenceKph}
                                    onChange={(v) =>
                                        setMaxGustWindDifferenceKph(
                                            Array.isArray(v)
                                                ? v[0] ?? maxGustWindDifferenceKph
                                                : v
                                        )
                                    }
                                    minValue={0}
                                    maxValue={30}
                                    step={1}
                                    labelPosition="default"
                                    formatOptions={{ style: "decimal", maximumFractionDigits: 0 }}
                                />
                            </div>
                        </div>
                    </div>
                );
            case "altitude":
                return (
                    <AltitudeHeightSelector
                        value={weatherHeightFt ?? ["ground"]}
                        onChange={(next) =>
                            setWeatherHeightFt(next.length > 0 ? next : ["ground"])
                        }
                    />
                );
            case "comfort":
                return (
                    <div className={cx(cardCls)}>
                        <div className="flex items-center gap-2 border-b border-secondary bg-secondary_alt/40 px-4 py-3">
                            <Thermometer02 className="size-5 text-secondary" strokeWidth={1.5} />
                            <h4 className="text-sm font-semibold text-secondary">
                                Comfort & Sky
                            </h4>
                        </div>
                        <div className="space-y-6 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-secondary">
                                        Use feels like temperature
                                    </p>
                                    <p className="text-xs text-tertiary">
                                        Filters by feels-like instead of actual
                                    </p>
                                </div>
                                <Toggle
                                    isSelected={useFeelsLikeTemp}
                                    onChange={setUseFeelsLikeTemp}
                                    aria-label="Use feels like temperature"
                                />
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-medium text-secondary">
                                        Temperature range
                                    </p>
                                    <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                                        {minTempC}°C — {maxTempC}°C
                                    </span>
                                </div>
                                <Slider
                                    value={[minTempC, maxTempC]}
                                    onChange={(v) => {
                                        const arr = Array.isArray(v) ? v : [v];
                                        const a = arr[0] ?? minTempC;
                                        const b = arr[1] ?? maxTempC;
                                        setMinTempC(Math.max(-20, Math.min(a, b)));
                                        setMaxTempC(Math.min(50, Math.max(a, b)));
                                    }}
                                    minValue={-20}
                                    maxValue={50}
                                    step={1}
                                    labelPosition="default"
                                    formatOptions={{ style: "decimal", maximumFractionDigits: 0 }}
                                />
                            </div>
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="text-sm font-medium text-secondary">
                                        Precipitation limit
                                    </p>
                                    <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                                        {maxPrecipitationProbabilityPercent}%
                                    </span>
                                </div>
                                <Slider
                                    value={maxPrecipitationProbabilityPercent}
                                    onChange={(v) =>
                                        setMaxPrecipitationProbabilityPercent(
                                            Array.isArray(v) ? v[0] ?? maxPrecipitationProbabilityPercent : v
                                        )
                                    }
                                    minValue={0}
                                    maxValue={100}
                                    step={5}
                                    labelPosition="default"
                                    formatOptions={{ style: "decimal", maximumFractionDigits: 0 }}
                                />
                                <p className="mt-1 text-xs text-tertiary">
                                    Max precipitation probability tolerated
                                </p>
                            </div>
                        </div>
                    </div>
                );
            case "timing":
                return (
                    <div className={cx(cardCls)}>
                        <div className="flex items-center gap-2 border-b border-secondary bg-secondary_alt/40 px-4 py-3">
                            <Clock className="size-5 text-secondary" strokeWidth={1.5} />
                            <h4 className="text-sm font-semibold text-secondary">Timing</h4>
                        </div>
                        <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2">
                            <div>
                                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                                    Time of day
                                </p>
                                <p className="mb-3 text-xs text-tertiary">
                                    Select one or more. Customize start/end for each.
                                </p>
                                <div className="flex flex-col gap-2">
                                    {TIME_OF_DAY_OPTIONS.map((opt) => {
                                        const block = preferredTimeBlocks.find(
                                            (b) => b.id === opt.id
                                        );
                                        const isSelected = !!block;
                                        const start = block?.start ?? opt.start;
                                        const end = block?.end ?? (opt.end === 24 ? 24 : opt.end);
                                        return (
                                            <div
                                                key={opt.id}
                                                className={cx(
                                                    "rounded-xl border transition",
                                                    isSelected
                                                        ? "border-brand-600 bg-brand-50 dark:border-brand-500 dark:bg-brand-950/30"
                                                        : "border-secondary bg-primary"
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setPreferredTimeBlocks((prev) =>
                                                                normalizePreferredTimeBlocks(prev.filter((b) => b.id !== opt.id))
                                                            );
                                                        } else {
                                                            const nextBlock = {
                                                                id: opt.id,
                                                                label: opt.label,
                                                                start: opt.start,
                                                                end: opt.end === 24 ? 24 : opt.end,
                                                            };
                                                            setPreferredTimeBlocks((prev) =>
                                                                opt.id === "anytime"
                                                                    ? [nextBlock]
                                                                    : normalizePreferredTimeBlocks([
                                                                          ...prev.filter((b) => b.id !== opt.id && b.id !== "anytime"),
                                                                          nextBlock,
                                                                      ])
                                                            );
                                                        }
                                                    }}
                                                    className={cx(
                                                        "flex w-full items-center gap-3 rounded-t-xl border-b p-4 text-left transition",
                                                        isSelected
                                                            ? "border-brand-200 bg-brand-600 text-white dark:border-brand-800 dark:bg-brand-600"
                                                            : "border-transparent text-primary hover:border-secondary_alt hover:bg-secondary_alt/50"
                                                    )}
                                                >
                                                    <Sun
                                                        className={cx(
                                                            "size-5 shrink-0",
                                                            isSelected ? "text-white" : "text-secondary"
                                                        )}
                                                        strokeWidth={1.5}
                                                    />
                                                    <span
                                                        className={cx(
                                                            "font-medium",
                                                            isSelected ? "text-white" : "text-primary"
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </span>
                                                    {isSelected && (
                                                        <span className="ml-auto text-xs opacity-90">
                                                            {start}:00 — {end === 24 ? "24:00" : `${end}:00`}
                                                        </span>
                                                    )}
                                                </button>
                                                {isSelected && (
                                                    <div className="flex flex-wrap items-center gap-4 p-4">
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-sm font-medium text-secondary">
                                                                Start
                                                            </label>
                                                            <Input
                                                                name={`time-${opt.id}-start`}
                                                                type="number"
                                                                value={String(start)}
                                                                onChange={(v) => {
                                                                    const val = Math.min(
                                                                        23,
                                                                        Math.max(0, parseInt(v, 10) || 0)
                                                                    );
                                                                    setPreferredTimeBlocks((prev) =>
                                                                        prev.map((b) =>
                                                                            b.id === opt.id
                                                                                ? { ...b, start: val }
                                                                                : b
                                                                        )
                                                                    );
                                                                }}
                                                                size="sm"
                                                                inputClassName="w-16"
                                                            />
                                                            <span className="text-sm text-tertiary">:00</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-sm font-medium text-secondary">
                                                                End
                                                            </label>
                                                            <Input
                                                                name={`time-${opt.id}-end`}
                                                                type="number"
                                                                value={String(end)}
                                                                onChange={(v) => {
                                                                    const val = Math.min(
                                                                        24,
                                                                        Math.max(0, parseInt(v, 10) || 0)
                                                                    );
                                                                    setPreferredTimeBlocks((prev) =>
                                                                        prev.map((b) =>
                                                                            b.id === opt.id
                                                                                ? { ...b, end: val }
                                                                                : b
                                                                        )
                                                                    );
                                                                }}
                                                                size="sm"
                                                                inputClassName="w-16"
                                                            />
                                                            <span className="text-sm text-tertiary">:00</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                                    Session duration
                                </p>
                                <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                                    {sessionHours}h
                                </p>
                                <p className="mt-1 text-xs text-tertiary">
                                    Minimum window required for a session
                                </p>
                                <div className="mt-4">
                                    <Slider
                                        value={minSessionLengthMinutes}
                                        onChange={(v) =>
                                            setMinSessionLengthMinutes(
                                                Array.isArray(v)
                                                    ? v[0] ?? minSessionLengthMinutes
                                                    : v
                                            )
                                        }
                                        minValue={15}
                                        maxValue={240}
                                        step={15}
                                        labelPosition="bottom"
                                        labelFormatter={(v) => `${v} min`}
                                        formatOptions={{
                                            style: "decimal",
                                            maximumFractionDigits: 0,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const showQuickPresets = !embeddedLockedSection || embeddedLockedSection === "wind";

    return (
        <div className="relative space-y-6">
            {showQuickPresets && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-secondary">Quick presets:</span>
                    <Dropdown.Root>
                        <Button size="sm" color="secondary" iconTrailing={ChevronDown}>
                            Presets
                        </Button>
                        <Dropdown.Popover className="w-56">
                            <Dropdown.Menu
                                onAction={(key) => {
                                    if (typeof key === "string") setPresetPendingId(key);
                                }}
                            >
                                {Object.entries(SPORT_PRESETS).map(([id, preset]) => (
                                    <Dropdown.Item key={id} id={id} label={preset.label} />
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown.Root>
                </div>
            )}

            <div
                className={cx(
                    "flex flex-col gap-6",
                    !embeddedLockedSection && "lg:flex-row lg:items-start lg:gap-10"
                )}
            >
                {!embeddedLockedSection && sectionNav}

                <div
                    className="min-w-0 flex-1 space-y-6"
                    role="tabpanel"
                    id={`pref-panel-${activeSection}`}
                    aria-label={
                        embeddedLockedSection
                            ? `${PREFERENCE_SECTIONS.find((s) => s.id === activeSection)?.label ?? activeSection} preferences`
                            : undefined
                    }
                    aria-labelledby={embeddedLockedSection ? undefined : `pref-tab-${activeSection}`}
                >
                    {renderPreferencesPanel()}
                </div>
            </div>

            {hasChanges && !hideFloatingSave && (
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        type="button"
                        onClick={save}
                        className="flex size-14 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                        aria-label="Save changes"
                    >
                        <Save01 className="size-6" strokeWidth={2} />
                    </button>
                </div>
            )}

            <DialogTrigger
                isOpen={presetPendingId !== null}
                onOpenChange={(open) => {
                    if (!open) setPresetPendingId(null);
                }}
            >
                <ModalOverlay isDismissable>
                    {({ state }) =>
                        presetPendingId !== null && (
                            <Modal className="w-full max-w-md rounded-xl border border-secondary bg-white p-6 shadow-xl dark:bg-primary">
                                <Dialog className="flex w-full min-w-full flex-col items-stretch outline-hidden">
                                    <ModalHeader
                                        onClose={() => {
                                            setPresetPendingId(null);
                                            state.close();
                                        }}
                                    >
                                        <h3 className="text-lg font-semibold text-primary">Apply preset?</h3>
                                    </ModalHeader>
                                    <div className="mt-4 space-y-4">
                                        <p className="text-sm leading-relaxed text-tertiary">
                                            Apply the &quot;
                                            {SPORT_PRESETS[presetPendingId]?.label ?? presetPendingId}&quot; preset?
                                            This replaces your current wind, gust, temperature, precipitation, time-of-day,
                                            and session length settings (forecast heights are unchanged).
                                        </p>
                                        <div className="flex flex-wrap justify-end gap-2 pt-2">
                                            <Button
                                                size="md"
                                                color="tertiary"
                                                onClick={() => {
                                                    setPresetPendingId(null);
                                                    state.close();
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="md"
                                                color="primary"
                                                onClick={() => {
                                                    applySportPreset(presetPendingId);
                                                    setPresetPendingId(null);
                                                    state.close();
                                                }}
                                            >
                                                Apply preset
                                            </Button>
                                        </div>
                                    </div>
                                </Dialog>
                            </Modal>
                        )
                    }
                </ModalOverlay>
            </DialogTrigger>
        </div>
    );
});
