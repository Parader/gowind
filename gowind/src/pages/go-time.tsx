import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import { HelpCircle } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { OnboardingQuestionnaire } from "@/components/onboarding/onboarding-questionnaire";
import { GoTimeFocusViews, type GoTimeFocusView } from "@/components/go-time/go-time-focus-views";
import { getGoTimes, PROVIDER_DISPLAY_NAMES } from "@/api/goTimes";
import type { GoTimeWindow, GoTimesMeta, ProviderFetchStatus } from "@/api/goTimes";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";
import { cx } from "@/utils/cx";

function toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getTimeFrameLabel(dateKey: string): string {
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = toLocalDateKey(tomorrow);

    if (dateKey === todayKey) return "Today";
    if (dateKey === tomorrowKey) return "Tomorrow";
    const dayStart = new Date(dateKey + "T12:00:00");
    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    }).format(dayStart);
}

type NearMiss = {
    id: string;
    locationId: string;
    locationName?: string;
    startTime: string;
    endTime: string;
    score: number;
    category: "GOOD" | "MARGINAL" | "NO_GO";
    windKmh: number;
    gustKmh: number | null;
    tempC: number;
    precipPct: number | null;
    reason: string;
    allReasons?: string[];
};

/** Day → Location → Slots. For near-misses. */
function groupNearMissesByDayThenLocation(
    nearMisses: NearMiss[]
): Array<{
    dateKey: string;
    label: string;
    locations: Array<{ locationId: string; locationName: string; slots: NearMiss[] }>;
}> {
    const byDate = new Map<string, Map<string, NearMiss[]>>();
    for (const nm of nearMisses) {
        const dateKey = nm.startTime.slice(0, 10);
        let byLoc = byDate.get(dateKey);
        if (!byLoc) {
            byLoc = new Map();
            byDate.set(dateKey, byLoc);
        }
        const list = byLoc.get(nm.locationId) ?? [];
        list.push(nm);
        byLoc.set(nm.locationId, list);
    }
    const dateKeys = [...byDate.keys()].sort();
    return dateKeys.map((dateKey) => {
        const byLoc = byDate.get(dateKey)!;
        const locations = [...byLoc.entries()].map(([locationId, slots]) => ({
            locationId,
            locationName: slots[0]?.locationName ?? "Location",
            slots: slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
        }));
        return {
            dateKey,
            label: getTimeFrameLabel(dateKey),
            locations,
        };
    });
}

function formatLastUpdated(computedAt: string): string {
    const d = new Date(computedAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) return `${diffHr} hr ago`;
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

function formatTimeRange(startIso: string, endIso: string): string {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const fmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export const GoTime = () => {
    const { user, isAdmin, isLoading } = useAuth();
    const { needsFullOnboarding } = useSetup();
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [windows, setWindows] = useState<GoTimeWindow[]>([]);
    const [meta, setMeta] = useState<GoTimesMeta | null>(null);
    const [computedAt, setComputedAt] = useState<string | null>(null);
    const [providersUsed, setProvidersUsed] = useState<string[]>([]);
    const [providerStatuses, setProviderStatuses] = useState<ProviderFetchStatus[]>([]);
    const [heightsSubscribed, setHeightsSubscribed] = useState<string[]>([]);
    const [minSessionLengthMinutes, setMinSessionLengthMinutes] = useState(60);
    const [weatherDataFetchedAt, setWeatherDataFetchedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [focusView, setFocusView] = useState<GoTimeFocusView>("next");
    const [goodOnly, setGoodOnly] = useState(true);
    const [forecastSettingsOpen, setForecastSettingsOpen] = useState(false);
    const forecastSettingsRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        if (!user || needsFullOnboarding) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        getGoTimes()
            .then((res) => {
                if (!cancelled) {
                    setWindows(res.windows ?? []);
                    setMeta(res.meta ?? null);
                    setComputedAt(res.computedAt ?? null);
                    setProvidersUsed(res.providersUsed ?? []);
                    setProviderStatuses(res.providerStatuses ?? []);
                    setHeightsSubscribed(
                        (res.heightsSubscribed ?? []).map((h) =>
                            h === "ground" ? "ground" : String(h)
                        )
                    );
                    setMinSessionLengthMinutes(res.minSessionLengthMinutes ?? 60);
                    setWeatherDataFetchedAt(res.weatherDataFetchedAt ?? null);
                }
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [user, needsFullOnboarding]);

    useEffect(() => {
        if (!forecastSettingsOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (target instanceof Node && !forecastSettingsRef.current?.contains(target)) {
                setForecastSettingsOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setForecastSettingsOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [forecastSettingsOpen]);

    if (!isLoading && !user) {
        return <Navigate to="/login" replace />;
    }

    if (needsFullOnboarding) {
        return <OnboardingQuestionnaire />;
    }

    if (showOnboarding) {
        return <OnboardingQuestionnaire onComplete={() => setShowOnboarding(false)} />;
    }

    const providerStatusById = new Map(providerStatuses.map((s) => [s.providerId, s]));
    const showForecastSettings =
        !loading &&
        Boolean(providersUsed.length > 0 || computedAt || heightsSubscribed.length > 0 || minSessionLengthMinutes);

    return (
        <main className="flex-1">
            <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
                <div className="mb-6 h-px w-12 bg-brand-400" />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                                Go Time
                            </h1>
                            {showForecastSettings && (
                                <details
                                    ref={forecastSettingsRef}
                                    className="group relative"
                                    open={forecastSettingsOpen}
                                    onToggle={(event) => setForecastSettingsOpen(event.currentTarget.open)}
                                    onBlur={(event) => {
                                        if (!event.currentTarget.contains(event.relatedTarget)) {
                                            setForecastSettingsOpen(false);
                                        }
                                    }}
                                >
                                    <summary
                                        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-full text-fg-quaternary transition hover:bg-primary_hover hover:text-fg-secondary marker:hidden [&::-webkit-details-marker]:hidden"
                                        aria-label="Forecast sources and data settings"
                                    >
                                        <HelpCircle className="size-4" />
                                    </summary>
                                    <div className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-secondary bg-primary p-4 shadow-lg">
                                        <p className="text-xs font-semibold text-secondary">
                                            Forecast sources &amp; data settings
                                        </p>
                                        <div className="mt-3 space-y-3 border-t border-secondary/50 pt-3">
                                            {providersUsed.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {providersUsed.map((pid) => {
                                                        const st = providerStatusById.get(pid);
                                                        const name = PROVIDER_DISPLAY_NAMES[pid] ?? pid;
                                                        const partial = st ? st.successCount > 0 && st.failCount > 0 : false;
                                                        const ok = st ? st.ok : false;
                                                        const dotClass = partial
                                                            ? "bg-amber-500"
                                                            : ok
                                                              ? "bg-emerald-500"
                                                              : st
                                                                ? "bg-red-500"
                                                                : "bg-slate-400";
                                                        const subtitle = st
                                                            ? partial
                                                                ? `${st.successCount} ok · ${st.failCount} failed`
                                                                : ok
                                                                  ? st.lastSuccessWasCache
                                                                      ? "From cache"
                                                                      : "Fetched"
                                                                  : "Fetch failed"
                                                            : "Status unavailable";
                                                        const title = st?.lastError ? `${name}: ${st.lastError}` : name;
                                                        return (
                                                            <div
                                                                key={pid}
                                                                className="flex max-w-[11rem] items-center gap-1.5 rounded-md border border-secondary/70 bg-white px-2 py-1.5 dark:bg-primary"
                                                                title={title}
                                                            >
                                                                <span
                                                                    className={cx("h-2 w-2 shrink-0 rounded-full", dotClass)}
                                                                    aria-hidden
                                                                />
                                                                <div className="min-w-0">
                                                                    <p className="truncate text-[11px] font-semibold text-secondary">
                                                                        {name}
                                                                    </p>
                                                                    <p className="truncate text-[10px] text-tertiary">{subtitle}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                            <p className="text-xs leading-relaxed text-tertiary">
                                                {providersUsed.length > 0 ? (
                                                    <>
                                                        Data from {providersUsed.map((p) => PROVIDER_DISPLAY_NAMES[p] ?? p).join(", ")}.{" "}
                                                    </>
                                                ) : null}
                                                Minimum window: {minSessionLengthMinutes} min.
                                                {heightsSubscribed.length > 0 && (
                                                    <>
                                                        {" "}
                                                        Heights:{" "}
                                                        {heightsSubscribed
                                                            .map((h) => (h === "ground" ? "Ground (10m)" : `${h} ft`))
                                                            .join(", ")}
                                                        .
                                                    </>
                                                )}
                                                {weatherDataFetchedAt && (
                                                    <> Weather from APIs: {formatLastUpdated(weatherDataFetchedAt)}.</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </details>
                            )}
                        </div>
                        <p className="mt-2 text-md text-tertiary">
                            Decide when and where to fly — pick a view that matches what you need right now.
                        </p>
                    </div>
                    {isAdmin && (
                        <Button size="md" color="secondary" onClick={() => setShowOnboarding(true)}>
                            Run setup again
                        </Button>
                    )}
                </div>

                {/* Windows list */}
                <div id="windows" className="mt-10 scroll-mt-24">
                    {error && (
                        <p className="rounded-lg border border-error_subtle bg-error-50 px-4 py-3 text-sm text-error dark:bg-error-950/30 dark:border-error-800">
                            {error}
                        </p>
                    )}
                    {!error && loading && (
                        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-secondary bg-white px-6 py-10 dark:bg-primary">
                            <LoadingIndicator type="dot-circle" size="lg" label="Fetching the latest wind windows…" />
                            <p className="max-w-lg text-center text-sm text-tertiary">
                                We’re combining multiple forecast sources and checking them against your preferences.
                            </p>
                        </div>
                    )}
                    {!error && !loading && windows.length === 0 && (
                        <div className="space-y-8">
                            <p className="text-md text-tertiary">
                                No wind windows found for your locations and preferences. Try widening your limits or adding more locations.
                            </p>
                            {meta && (
                                <>
                                    <section className="rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                                        <h3 className="text-lg font-semibold text-secondary">What we verified</h3>
                                        <p className="mt-2 text-sm text-tertiary">
                                            Checked {meta.locationsChecked.map((l) => l.name).join(", ")} from{" "}
                                            {meta.dateRange.from} to {meta.dateRange.to} using{" "}
                                            {meta.providersUsed.map((p) => PROVIDER_DISPLAY_NAMES[p] ?? p).join(", ")}.
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="rounded-md bg-secondary_alt px-2.5 py-1 text-xs font-medium text-secondary">
                                                {meta.slicesEvaluated} hourly slots checked
                                            </span>
                                            <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                                                {meta.goodCount} good hours
                                            </span>
                                            <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                                {meta.marginalCount} marginal hours
                                            </span>
                                            <span className="rounded-md bg-secondary_alt px-2.5 py-1 text-xs font-medium text-secondary">
                                                {meta.noGoCount} no-go hours
                                            </span>
                                        </div>
                                        <p className="mt-3 text-sm text-tertiary">
                                            Good hours are single-hour scores from each weather source. Listed windows apply
                                            extra rules on top of those scores.
                                        </p>
                                        {meta.whyNoListedWindows && meta.whyNoListedWindows.length > 0 && (
                                            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-tertiary">
                                                {meta.whyNoListedWindows.map((line) => (
                                                    <li key={line}>{line}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </section>
                                    {meta.nearMisses.length > 0 && (
                                        <section className="rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                                            <h3 className="mb-5 text-lg font-semibold text-secondary">How close</h3>
                                            <p className="mb-5 text-sm text-tertiary">
                                                Near-misses that almost met your preferences. Time ranges use your minimum session
                                                length ({minSessionLengthMinutes} min); score and conditions are from the start
                                                of that window.
                                            </p>
                                            <div className="space-y-10">
                                                {groupNearMissesByDayThenLocation(meta.nearMisses as NearMiss[]).map((group) => (
                                                    <div key={group.dateKey}>
                                                        <h4 className="mb-4 text-base font-semibold text-primary">{group.label}</h4>
                                                        <div className="space-y-5">
                                                            {group.locations.map((loc) => (
                                                                <div key={loc.locationId} className="rounded-lg border border-secondary/60 bg-secondary_alt/20 p-4">
                                                                    <h5 className="mb-3 text-sm font-semibold text-secondary">
                                                                        Where you can fly: {loc.locationName}
                                                                    </h5>
                                                                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                                                        {loc.slots.map((nm) => (
                                                                            <div
                                                                                key={nm.id}
                                                                                className="flex flex-col gap-2 rounded-lg border border-secondary bg-white px-4 py-3 shadow-sm dark:bg-primary sm:min-w-[200px]"
                                                                            >
                                                                                <div className="font-medium text-secondary">
                                                                                    {formatTimeRange(nm.startTime, nm.endTime)}
                                                                                </div>
                                                                                <div className="flex flex-wrap items-center gap-2 text-sm text-tertiary">
                                                                                    <span
                                                                                        className={cx(
                                                                                            "font-medium",
                                                                                            nm.category === "GOOD" && "text-emerald-600 dark:text-emerald-400",
                                                                                            nm.category === "MARGINAL" && "text-amber-600 dark:text-amber-400",
                                                                                            nm.category === "NO_GO" && "text-red-600 dark:text-red-400"
                                                                                        )}
                                                                                    >
                                                                                        {nm.category === "GOOD"
                                                                                            ? "Good"
                                                                                            : nm.category === "MARGINAL"
                                                                                              ? "Marginal"
                                                                                              : "Not ideal"}
                                                                                    </span>
                                                                                    <span>· Score {nm.score}</span>
                                                                                </div>
                                                                                {(nm.allReasons && nm.allReasons.length > 0 ? nm.allReasons : [nm.reason]).map((line, ri) => (
                                                                                    <p key={ri} className="text-xs text-tertiary">
                                                                                        {line}
                                                                                    </p>
                                                                                ))}
                                                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                                                    <span className="rounded bg-secondary_alt px-2 py-0.5 text-xs font-medium text-secondary">
                                                                                        Wind {Math.round(nm.windKmh)} km/h
                                                                                    </span>
                                                                                    {nm.gustKmh != null && (
                                                                                        <span className="rounded bg-secondary_alt px-2 py-0.5 text-xs font-medium text-secondary">
                                                                                            Gusts {Math.round(nm.gustKmh)} km/h
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="rounded bg-secondary_alt px-2 py-0.5 text-xs font-medium text-secondary">
                                                                                        {Math.round(nm.tempC)}°C
                                                                                    </span>
                                                                                    {nm.precipPct != null && (
                                                                                        <span className="rounded bg-secondary_alt px-2 py-0.5 text-xs font-medium text-secondary">
                                                                                            Precip {Math.round(nm.precipPct)}%
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {!error && !loading && windows.length > 0 && (
                        <GoTimeFocusViews
                            windows={windows}
                            view={focusView}
                            onViewChange={setFocusView}
                            goodOnly={goodOnly}
                            onGoodOnlyChange={setGoodOnly}
                        />
                    )}
                </div>

            </div>
        </main>
    );
};
