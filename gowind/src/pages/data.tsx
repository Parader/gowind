import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";
import { useLocale } from "@/providers/locale-provider";
import { getMetar, getTaf } from "@/api/aviation";
import { getWeather } from "@/api/weather";
import { formatTimeAgo } from "@/utils/format";
import type { Location } from "@/types/setup";
import type { WeatherHeightFt } from "@/types/setup";

const PROVIDERS = ["open-meteo", "openweather", "meteosource", "visualcrossing", "met-norway"] as const;

const PROVIDER_I18N: Record<string, { name: string; hint?: string; tooltip?: string }> = {
    openweather: { name: "openWeather", hint: "openWeatherHint", tooltip: "openWeatherTooltip" },
    meteosource: { name: "meteosource", hint: "meteosourceHint", tooltip: "meteosourceTooltip" },
    visualcrossing: { name: "visualCrossing" },
    "open-meteo": { name: "openMeteo" },
    "met-norway": { name: "metNorway", hint: "metNorwayHint", tooltip: "metNorwayTooltip" },
};

function providerLabel(
    id: string,
    t: (key: string) => string,
    withHint = false,
): string {
    const meta = PROVIDER_I18N[id];
    const name = meta ? t(`data.providers.${meta.name}`) : id;
    if (withHint && meta?.hint) return `${name}${t(`data.providers.${meta.hint}`)}`;
    return name;
}

function providerTooltip(id: string, t: (key: string) => string): string | undefined {
    const meta = PROVIDER_I18N[id];
    return meta?.tooltip ? t(`data.providers.${meta.tooltip}`) : undefined;
}

interface HourlySlice {
    time: string;
    wind: number;
    gust: number | null;
    temp: number;
    precip: number | null;
}

interface ProviderForecast {
    provider: string;
    fetchedAt: string;
    cached: boolean;
    slices: HourlySlice[];
    /** Set when fetch failed (e.g. wgrib2 not found) */
    error?: string;
}

export interface DisplayedWeatherLocation {
    fetchedAt: string;
    provider: string;
    cached: boolean;
    heights: (string | number)[];
    data: Record<string, unknown>;
}

function parseHourlyToSlices(data: Record<string, unknown>): HourlySlice[] {
    const hourly = data.hourly as
        | {
              time?: string[];
              wind_speed_10m?: number[];
              wind_gusts_10m?: number[];
              temperature_2m?: number[];
              precipitation_probability?: number[];
          }
        | undefined;
    if (!hourly?.time?.length) return [];

    const time = hourly.time;
    const wind = hourly.wind_speed_10m ?? [];
    const gust = hourly.wind_gusts_10m ?? [];
    const temp = hourly.temperature_2m ?? [];
    const precip = hourly.precipitation_probability ?? [];

    return time.map((t, i) => ({
        time: t,
        wind: wind[i] ?? 0,
        gust: gust[i] ?? null,
        temp: temp[i] ?? 0,
        precip: precip[i] ?? null,
    }));
}

function toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getTimeFrameLabel(dateKey: string, t: (key: string) => string, dateLocale: string): string {
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = toLocalDateKey(tomorrow);

    if (dateKey === todayKey) return t("common.dates.today");
    if (dateKey === tomorrowKey) return t("common.dates.tomorrow");
    const dayStart = new Date(dateKey + "T12:00:00");
    return new Intl.DateTimeFormat(dateLocale, {
        weekday: "short",
        month: "short",
        day: "numeric",
    }).format(dayStart);
}

/** Find nearest slice by time (for aligning 3h providers to hourly grid) */
function findNearestSlice(slices: HourlySlice[], targetTime: string): HourlySlice | null {
    const target = new Date(targetTime).getTime();
    let best: HourlySlice | null = null;
    let bestDiff = Infinity;
    for (const s of slices) {
        const diff = Math.abs(new Date(s.time).getTime() - target);
        if (diff < bestDiff) {
            bestDiff = diff;
            best = s;
        }
    }
    return best;
}

/** Build hourly grid: for each hour in range, get value from each provider (nearest match) */
function buildHourlyGrid(
    forecasts: ProviderForecast[],
    days: number
): Array<{ time: string; dateKey: string; byProvider: Map<string, HourlySlice> }> {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + days);
    const grid: Array<{ time: string; dateKey: string; byProvider: Map<string, HourlySlice> }> = [];

    for (let d = 0; d < days; d++) {
        const dayStart = new Date(now);
        dayStart.setDate(dayStart.getDate() + d);
        dayStart.setHours(0, 0, 0, 0);
        for (let h = 0; h < 24; h++) {
            const slot = new Date(dayStart);
            slot.setHours(h, 0, 0, 0);
            if (slot < now) continue;
            if (slot > end) break;

            const time = slot.toISOString().slice(0, 19);
            const dateKey = toLocalDateKey(slot);
            const byProvider = new Map<string, HourlySlice>();

            for (const fc of forecasts) {
                const nearest = findNearestSlice(fc.slices, time);
                if (nearest) {
                    const hourDiff = Math.abs(
                        new Date(nearest.time).getTime() - new Date(time).getTime()
                    );
                    if (hourDiff < 2 * 60 * 60 * 1000) {
                        byProvider.set(fc.provider, nearest);
                    }
                }
            }

            if (byProvider.size > 0) {
                grid.push({ time, dateKey, byProvider });
            }
        }
    }

    return grid;
}

function groupGridByDate(
    grid: Array<{ time: string; dateKey: string; byProvider: Map<string, HourlySlice> }>,
    t: (key: string) => string,
    dateLocale: string,
): Array<{ dateKey: string; label: string; rows: typeof grid }> {
    const byDate = new Map<string, typeof grid>();
    for (const row of grid) {
        const list = byDate.get(row.dateKey) ?? [];
        list.push(row);
        byDate.set(row.dateKey, list);
    }

    return [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dateKey, rows]) => ({
            dateKey,
            label: getTimeFrameLabel(dateKey, t, dateLocale),
            rows,
        }));
}

function JsonBlock({ data, label }: { data: unknown; label?: string }) {
    const str = JSON.stringify(data, null, 2);
    return (
        <div className="flex flex-col gap-2">
            {label && (
                <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                    {label}
                </span>
            )}
            <pre className="max-h-64 overflow-x-auto rounded-lg border border-secondary bg-secondary_alt/50 p-4 font-mono text-sm text-primary">
                {str}
            </pre>
        </div>
    );
}

export const Data = () => {
    const { t, dateLocale } = useLocale();
    const { user, isAdmin, isLoading, hasSession } = useAuth();
    const { locations, preferences } = useSetup();
    const [multiSource, setMultiSource] = useState<
        Record<string, ProviderForecast[]>
    >({});
    const [weatherByLocation, setWeatherByLocation] = useState<
        Record<string, DisplayedWeatherLocation>
    >({});
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const heights = (preferences?.weatherHeightFt ?? ["ground"]) as WeatherHeightFt[];
    const [provider, setProvider] = useState<string>("meteosource");
    const [locationFilter, setLocationFilter] = useState<string>("all");
    const [days, setDays] = useState<number>(7);
    const [viewMode, setViewMode] = useState<"comparison" | "raw" | "aviation">("comparison");
    const [aviationIds, setAviationIds] = useState("CYQB,CYUL,KJFK");
    const [aviationData, setAviationData] = useState<{
        metar?: Array<Record<string, unknown>>;
        taf?: Array<Record<string, unknown>>;
    }>({});

    const displayLocations = useMemo(() => {
        if (locationFilter === "all") return locations;
        return locations.filter((loc) => loc.id === locationFilter);
    }, [locations, locationFilter]);

    const fetchAllProvidersForLocation = useCallback(
        async (loc: Location, forceRefresh = false) => {
            const results: ProviderForecast[] = [];
            const promises = PROVIDERS.map(async (prov) => {
                try {
                    const data = await getWeather(loc.lat, loc.lng, days, heights, {
                        refresh: forceRefresh,
                        provider: prov,
                    });
                    const d = data as Record<string, unknown> & {
                        _fetchedAt: string;
                        _provider: string;
                        _cached: boolean;
                    };
                    return {
                        provider: d._provider,
                        fetchedAt: d._fetchedAt,
                        cached: d._cached,
                        slices: parseHourlyToSlices(d),
                    };
                } catch (e) {
                    return {
                        provider: prov,
                        fetchedAt: new Date().toISOString(),
                        cached: false,
                        slices: [],
                        error: e instanceof Error ? e.message : t("data.requestFailed"),
                    };
                }
            });

            const settled = await Promise.allSettled(promises);
            for (const result of settled) {
                if (result.status === "fulfilled" && result.value) {
                    results.push(result.value);
                }
            }
            return results;
        },
        [days, heights, t]
    );

    const fetchAllSources = useCallback(
        async (forceRefresh = false) => {
            if (displayLocations.length === 0) {
                setError(t("data.addLocationsFirst"));
                return;
            }
            setLoading("all-sources");
            setError(null);
            try {
                const next: Record<string, ProviderForecast[]> = {};
                for (const loc of displayLocations) {
                    const forecasts = await fetchAllProvidersForLocation(
                        loc,
                        forceRefresh
                    );
                    next[loc.id] = forecasts;
                }
                setMultiSource(next);
            } catch (e) {
                setError(e instanceof Error ? e.message : t("data.requestFailed"));
            } finally {
                setLoading(null);
            }
        },
        [displayLocations, fetchAllProvidersForLocation, t]
    );

    const fetchSingleProvider = useCallback(
        async (locationId: string, lat: number, lng: number, forceRefresh = false) => {
            setLoading(`weather-${locationId}`);
            setError(null);
            try {
                const data = await getWeather(lat, lng, days, heights, {
                    refresh: forceRefresh,
                    provider,
                });
                setWeatherByLocation((prev) => ({
                    ...prev,
                    [locationId]: {
                        fetchedAt: (data as { _fetchedAt: string })._fetchedAt,
                        provider: (data as { _provider: string })._provider,
                        cached: (data as { _cached: boolean })._cached,
                        heights:
                            ((data as { _heights?: (string | number)[] })._heights) ??
                            heights,
                        data: data as unknown as Record<string, unknown>,
                    },
                }));
            } catch (e) {
                setError(e instanceof Error ? e.message : t("data.requestFailed"));
            } finally {
                setLoading(null);
            }
        },
        [heights, provider, days, t]
    );

    const fetchAllWeather = useCallback(
        async (forceRefresh = false) => {
            if (locations.length === 0) {
                setError(t("data.addLocationsFirst"));
                return;
            }
            setLoading("weather-all");
            setError(null);
            try {
                const merged: Record<string, DisplayedWeatherLocation> = {};
                for (const loc of locations) {
                    const data = await getWeather(loc.lat, loc.lng, days, heights, {
                        refresh: forceRefresh,
                        provider,
                    });
                    merged[loc.id] = {
                        fetchedAt: (data as { _fetchedAt: string })._fetchedAt,
                        provider: (data as { _provider: string })._provider,
                        cached: (data as { _cached: boolean })._cached,
                        heights:
                            ((data as { _heights?: (string | number)[] })._heights) ??
                            heights,
                        data: data as unknown as Record<string, unknown>,
                    };
                }
                setWeatherByLocation(merged);
            } catch (e) {
                setError(e instanceof Error ? e.message : t("data.requestFailed"));
            } finally {
                setLoading(null);
            }
        },
        [locations, heights, provider, days, t]
    );

    const fetchAviation = useCallback(async () => {
        const ids = aviationIds.split(/[\s,]+/).filter(Boolean);
        if (ids.length === 0) {
            setError(t("data.aviation.enterStation"));
            return;
        }
        setLoading("aviation");
        setError(null);
        try {
            const [metar, taf] = await Promise.all([getMetar(ids), getTaf(ids)]);
            setAviationData({ metar: metar as Record<string, unknown>[], taf: taf as Record<string, unknown>[] });
        } catch (e) {
            setError(e instanceof Error ? e.message : t("data.aviation.fetchFailed"));
        } finally {
            setLoading(null);
        }
    }, [aviationIds, t]);

    const hasLoadedCachedData = useRef(false);
    useEffect(() => {
        if (locations.length === 0 || hasLoadedCachedData.current) return;
        hasLoadedCachedData.current = true;
        fetchAllSources(false);
        fetchAllWeather(false);
    }, [locations.length, fetchAllSources, fetchAllWeather]);

    const comparisonDataByLocation = useMemo(() => {
        const out: Record<
            string,
            Array<{ dateKey: string; label: string; rows: Array<{ time: string; byProvider: Map<string, HourlySlice> }> }>
        > = {};
        for (const [locId, forecasts] of Object.entries(multiSource)) {
            if (forecasts.length === 0) continue;
            const grid = buildHourlyGrid(forecasts, days);
            const grouped = groupGridByDate(grid, t, dateLocale);
            out[locId] = grouped.map((g) => ({
                dateKey: g.dateKey,
                label: g.label,
                rows: g.rows.map((r) => ({ time: r.time, byProvider: r.byProvider })),
            }));
        }
        return out;
    }, [multiSource, days, t, dateLocale]);

    if (isLoading || (hasSession && !user)) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    return (
        <main className="flex-1">
            <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
                <div className="mb-6 h-px w-12 bg-brand-400" />
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                            {t("data.title")}
                        </h1>
                        <p className="mt-2 text-md text-tertiary">{t("data.subtitle")}</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="mt-6 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                        <span className="text-sm font-medium text-secondary">{t("data.location")}</span>
                        <select
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                            className="rounded-lg border border-secondary bg-white px-3 py-2 text-sm text-primary ring-1 ring-secondary ring-inset outline-none focus:ring-2 focus:ring-brand dark:bg-primary dark:ring-primary"
                        >
                            <option value="all">{t("data.allLocations")}</option>
                            {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                    {loc.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-2">
                        <span className="text-sm font-medium text-secondary">{t("data.days")}</span>
                        <select
                            value={days}
                            onChange={(e) => setDays(parseInt(e.target.value, 10))}
                            className="rounded-lg border border-secondary bg-white px-3 py-2 text-sm text-primary ring-1 ring-secondary ring-inset outline-none focus:ring-2 focus:ring-brand dark:bg-primary dark:ring-primary"
                        >
                            <option value={1}>{t("data.day1")}</option>
                            <option value={3}>{t("data.day3")}</option>
                            <option value={7}>{t("data.day7")}</option>
                        </select>
                    </label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setViewMode("comparison")}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                viewMode === "comparison"
                                    ? "bg-brand-500 text-white"
                                    : "bg-secondary_alt/50 text-secondary hover:bg-secondary_alt"
                            }`}
                        >
                            {t("data.viewComparison")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("raw")}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                viewMode === "raw"
                                    ? "bg-brand-500 text-white"
                                    : "bg-secondary_alt/50 text-secondary hover:bg-secondary_alt"
                            }`}
                        >
                            {t("data.viewRaw")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("aviation")}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                viewMode === "aviation"
                                    ? "bg-brand-500 text-white"
                                    : "bg-secondary_alt/50 text-secondary hover:bg-secondary_alt"
                            }`}
                        >
                            {t("data.viewAviation")}
                        </button>
                    </div>
                    <Button
                        size="md"
                        color="primary"
                        onClick={() => fetchAllSources(true)}
                        isDisabled={
                            loading !== null || displayLocations.length === 0
                        }
                    >
                        {loading === "all-sources" ? t("data.loading") : t("data.fetchAllSources")}
                    </Button>
                </div>

                {error && (
                    <div className="mt-6 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-950/30 dark:text-error-400">
                        {error}
                    </div>
                )}
                <div className="mt-10 grid gap-8">
                    {viewMode === "comparison" ? (
                        <section className="flex flex-col gap-6 rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                            <h2 className="text-lg font-semibold text-primary">{t("data.comparison.title")}</h2>
                            {displayLocations.length === 0 ? (
                                <p className="text-sm text-quaternary">{t("data.comparison.emptyLocations")}</p>
                            ) : Object.keys(multiSource).length === 0 ? (
                                <p className="text-sm text-quaternary">{t("data.comparison.emptyData")}</p>
                            ) : (
                                <div className="space-y-8">
                                    {displayLocations.map((loc) => {
                                        const groups =
                                            comparisonDataByLocation[loc.id] ?? [];
                                        const forecasts = multiSource[loc.id] ?? [];
                                        return (
                                            <div
                                                key={loc.id}
                                                className="rounded-lg border border-secondary bg-secondary_alt/30 p-4"
                                            >
                                                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                                    <h3 className="font-medium text-primary">
                                                        {loc.name}
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2 text-xs text-tertiary">
                                                        {forecasts.map((fc) => (
                                                            <span
                                                                key={fc.provider}
                                                                title={
                                                                    fc.error
                                                                        ? fc.error
                                                                        : formatTimeAgo(
                                                                              fc.fetchedAt
                                                                          )
                                                                }
                                                                className={
                                                                    fc.error
                                                                        ? "rounded px-1.5 py-0.5 bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-400"
                                                                        : ""
                                                                }
                                                            >
                                                                {providerLabel(fc.provider, t, true)}
                                                                {fc.cached && t("data.comparison.cached")}
                                                                {fc.error && t("data.comparison.failed")}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {groups.map((group) => (
                                                    <div
                                                        key={group.dateKey}
                                                        className="mb-6 last:mb-0"
                                                    >
                                                        <h4 className="mb-2 text-sm font-semibold text-secondary">
                                                            {group.label}
                                                        </h4>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full min-w-[500px] border-collapse text-sm">
                                                                <thead>
                                                                    <tr className="border-b border-secondary">
                                                                        <th className="px-2 py-1.5 text-left font-medium text-tertiary">
                                                                            {t("data.comparison.time")}
                                                                        </th>
                                                                        {PROVIDERS.map((p) => (
                                                                            <th
                                                                                key={p}
                                                                                className="px-2 py-1.5 text-center font-medium text-tertiary"
                                                                                title={providerTooltip(p, t)}
                                                                            >
                                                                                {providerLabel(p, t, true)}
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                    <tr className="border-b border-secondary/50 text-xs text-quaternary">
                                                                        <th className="px-2 py-1" />
                                                                        {PROVIDERS.map(
                                                                            (p) => (
                                                                                <th
                                                                                    key={p}
                                                                                    className="px-2 py-1"
                                                                                >
                                                                                    {t("data.comparison.metricsHeader")}
                                                                                </th>
                                                                            )
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.rows.map(
                                                                        (row) => {
                                                                            const time =
                                                                                new Date(
                                                                                    row.time
                                                                                );
                                                                            const timeStr =
                                                                                time.toLocaleTimeString(
                                                                                    undefined,
                                                                                    {
                                                                                        hour: "2-digit",
                                                                                        minute: "2-digit",
                                                                                    }
                                                                                );
                                                                            return (
                                                                                <tr
                                                                                    key={
                                                                                        row.time
                                                                                    }
                                                                                    className="border-b border-secondary/30 hover:bg-secondary_alt/30"
                                                                                >
                                                                                    <td className="px-2 py-1.5 font-medium text-primary">
                                                                                        {
                                                                                            timeStr
                                                                                        }
                                                                                    </td>
                                                                                    {PROVIDERS.map(
                                                                                        (p) => {
                                                                                            const s =
                                                                                                row.byProvider.get(
                                                                                                    p
                                                                                                );
                                                                                            if (
                                                                                                !s
                                                                                            )
                                                                                                return (
                                                                                                    <td
                                                                                                        key={
                                                                                                            p
                                                                                                        }
                                                                                                        className="px-2 py-1.5 text-center text-quaternary"
                                                                                                    >
                                                                                                        {t("data.comparison.noData")}
                                                                                                    </td>
                                                                                                );
                                                                                            return (
                                                                                                <td
                                                                                                    key={
                                                                                                        p
                                                                                                    }
                                                                                                    className="px-2 py-1.5 text-center text-secondary"
                                                                                                    title={t("data.comparison.tooltipWind", {
                                                                                                        wind: s.wind,
                                                                                                        gust: s.gust ?? t("data.comparison.noData"),
                                                                                                        temp: s.temp,
                                                                                                        precip: s.precip ?? t("data.comparison.noData"),
                                                                                                    })}
                                                                                                >
                                                                                                    <span className="font-mono text-xs">
                                                                                                        {Math.round(
                                                                                                            s.wind
                                                                                                        )}{" "}
                                                                                                        ·{" "}
                                                                                                        {s.gust !=
                                                                                                        null
                                                                                                            ? Math.round(
                                                                                                                  s.gust
                                                                                                              )
                                                                                                            : "—"}{" "}
                                                                                                        ·{" "}
                                                                                                        {Math.round(
                                                                                                            s.temp
                                                                                                        )}°
                                                                                                        {" · "}
                                                                                                        {s.precip !=
                                                                                                        null
                                                                                                            ? `${Math.round(s.precip)}%`
                                                                                                            : "—"}
                                                                                                    </span>
                                                                                                </td>
                                                                                            );
                                                                                        }
                                                                                    )}
                                                                                </tr>
                                                                            );
                                                                        }
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    ) : viewMode === "aviation" ? (
                        <section className="flex flex-col gap-6 rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-primary">{t("data.aviation.title")}</h2>
                                    <p className="mt-1 text-xs text-tertiary">{t("data.aviation.subtitle")}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-secondary">{t("data.aviation.stationIds")}</span>
                                        <input
                                            type="text"
                                            value={aviationIds}
                                            onChange={(e) => setAviationIds(e.target.value)}
                                            placeholder={t("data.aviation.placeholder")}
                                            className="w-48 rounded-lg border border-secondary bg-white px-3 py-2 text-sm text-primary ring-1 ring-secondary ring-inset outline-none focus:ring-2 focus:ring-brand dark:bg-primary dark:ring-primary"
                                        />
                                    </label>
                                    <Button
                                        size="md"
                                        color="primary"
                                        onClick={() => fetchAviation()}
                                        isDisabled={loading !== null}
                                    >
                                        {loading === "aviation" ? t("data.loading") : t("data.aviation.fetch")}
                                    </Button>
                                </div>
                            </div>
                            {(aviationData.metar?.length ?? 0) > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-secondary">{t("data.aviation.metarTitle")}</h3>
                                    <div className="space-y-3">
                                        {(aviationData.metar ?? []).map((m) => (
                                            <div key={String(m.icaoId)} className="rounded-lg border border-secondary bg-secondary_alt/30 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="font-medium text-primary">
                                                        {String(m.name ?? "")} ({String(m.icaoId ?? "")})
                                                    </span>
                                                    <span className="text-xs text-tertiary">
                                                        {t("data.aviation.windSummary", {
                                                            dir: String(m.wdir ?? t("data.comparison.noData")),
                                                            speed: String(m.wspd ?? t("data.comparison.noData")),
                                                            temp: String(m.temp ?? t("data.comparison.noData")),
                                                        })}
                                                    </span>
                                                </div>
                                                <pre className="mt-2 overflow-x-auto font-mono text-xs text-secondary">
                                                    {String(m.rawOb ?? "")}
                                                </pre>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {(aviationData.taf?.length ?? 0) > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-secondary">{t("data.aviation.tafTitle")}</h3>
                                    <div className="space-y-3">
                                        {(aviationData.taf ?? []).map((tafRow) => (
                                            <div key={String(tafRow.icaoId)} className="rounded-lg border border-secondary bg-secondary_alt/30 p-4">
                                                <div className="font-medium text-primary">
                                                    {String(tafRow.name ?? "")} ({String(tafRow.icaoId ?? "")})
                                                </div>
                                                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-secondary">
                                                    {String(tafRow.rawTAF ?? "")}
                                                </pre>
                                                {(tafRow.fcsts as Array<{ timeFrom: number; timeTo: number; wdir?: number; wspd?: number; wgst?: number; visib?: string }>)?.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {(tafRow.fcsts as Array<{ timeFrom: number; timeTo: number; wdir?: number; wspd?: number; wgst?: number }>)
                                                            .filter((f) => f.wdir != null || f.wspd != null)
                                                            .slice(0, 8)
                                                            .map((f, i) => (
                                                                <span key={i} className="rounded bg-secondary px-2 py-1 text-xs text-secondary">
                                                                    {new Date(f.timeFrom * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}–
                                                                    {new Date(f.timeTo * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}{" "}
                                                                    {f.wdir}°{f.wspd}kt{f.wgst ? `G${f.wgst}` : ""}
                                                                </span>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {!aviationData.metar?.length && !aviationData.taf?.length && (
                                <p className="text-sm text-quaternary">{t("data.aviation.emptyHint")}</p>
                            )}
                        </section>
                    ) : (
                        <section className="flex flex-col gap-4 rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-primary">{t("data.raw.title")}</h2>
                                    <p className="mt-1 text-xs text-tertiary">
                                        {t("data.raw.subtitle", {
                                            provider,
                                            days,
                                            heights: heights.join(", "),
                                        })}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-secondary">
                                            {t("data.raw.provider")}
                                        </span>
                                        <select
                                            value={provider}
                                            onChange={(e) =>
                                                setProvider(e.target.value)
                                            }
                                            className="rounded-lg border border-secondary bg-white px-3 py-2 text-sm text-primary ring-1 ring-secondary ring-inset outline-none focus:ring-2 focus:ring-brand dark:bg-primary dark:ring-primary"
                                        >
                                            <option value="open-meteo">{t("data.providers.openMeteo")}</option>
                                            <option value="openweather">{t("data.providers.openWeather")}</option>
                                            <option value="visualcrossing">{t("data.providers.visualCrossing")}</option>
                                            <option value="meteosource">{t("data.providers.meteosource")}</option>
                                            <option value="met-norway">{t("data.providers.metNorway")}</option>
                                        </select>
                                    </label>
                                    <Button
                                        size="sm"
                                        color="secondary"
                                        onClick={() => fetchAllWeather(true)}
                                        isDisabled={
                                            loading !== null ||
                                            locations.length === 0
                                        }
                                    >
                                        {loading === "weather-all" ? t("data.fetching") : t("data.raw.fetchAll")}
                                    </Button>
                                </div>
                            </div>
                            {locations.length === 0 ? (
                                <p className="text-sm text-quaternary">{t("data.raw.emptyLocations")}</p>
                            ) : (
                                <div className="space-y-6">
                                    {locations.map((loc) => {
                                        const saved =
                                            weatherByLocation[loc.id];
                                        const locLoading =
                                            loading === `weather-${loc.id}`;
                                        return (
                                            <div
                                                key={loc.id}
                                                className="rounded-lg border border-secondary bg-secondary_alt/30 p-4"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <h3 className="font-medium text-primary">
                                                        {loc.name}
                                                    </h3>
                                                    <Button
                                                        size="sm"
                                                        color="secondary"
                                                        onClick={() =>
                                                            fetchSingleProvider(
                                                                loc.id,
                                                                loc.lat,
                                                                loc.lng,
                                                                true
                                                            )
                                                        }
                                                        isDisabled={
                                                            locLoading ||
                                                            loading ===
                                                                "weather-all"
                                                        }
                                                    >
                                                        {locLoading
                                                            ? "…"
                                                            : saved
                                                              ? t("common.actions.refresh")
                                                              : t("data.raw.fetch")}
                                                    </Button>
                                                </div>
                                                {saved ? (
                                                    <div className="mt-4 flex flex-col gap-3">
                                                        <div className="flex flex-wrap gap-4 text-sm">
                                                            <span>
                                                                <span className="font-medium text-tertiary">
                                                                    {t("data.raw.providerLabel")}
                                                                </span>{" "}
                                                                {saved.provider}
                                                            </span>
                                                            <span
                                                                title={
                                                                    saved.fetchedAt
                                                                }
                                                            >
                                                                <span className="font-medium text-tertiary">
                                                                    {t("data.raw.fetchedLabel")}
                                                                </span>{" "}
                                                                {formatTimeAgo(
                                                                    saved.fetchedAt
                                                                )}
                                                            </span>
                                                        </div>
                                                        <JsonBlock
                                                            data={saved.data}
                                                            label={t("data.raw.dataLabel")}
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="mt-2 text-sm text-quaternary">{t("data.raw.noData")}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </main>
    );
};
