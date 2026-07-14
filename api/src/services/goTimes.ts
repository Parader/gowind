/**
 * Go-times service: compute wind windows from weather data + user preferences.
 * Ported from proto with gowind Preferences (km/h, °C, preferredTimeBlocks).
 */
import mongoose from "mongoose";
import { UserData } from "../models/UserData.js";
import { getCachedWeather, setCachedWeather } from "./weatherCache.js";
import { fetchFromProvider, getGoTimesProviders, HEIGHT_TO_OPEN_METEO_VAR } from "./weatherFetch.js";
import { recordApiCall } from "./apiCallCounter.js";
import {
    forecastPointsFromSlices,
    buildFusedHourlyTimeline,
    groupFusedHoursIntoWindows,
    mergeWindowOutlierHints,
    buildWeatherSnapshot,
    buildReliabilityExplanation,
    categoryFromSuitability,
    categoryForWindow,
    windowHasHighSourceSpread,
    type RawFusionWindow,
    type FusionPreferences,
    type ForecastPoint,
} from "./goTimesFusion.js";

const COMPUTED_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const HORIZON_DAYS = 7;
const GO_TIMES_ALGORITHM_VERSION = 4;

/** Drop cached go-times so the next GET recomputes with current setup (preferences/locations). */
export async function invalidateGoTimesCache(userId: string): Promise<void> {
    await UserData.deleteOne({ userId: new mongoose.Types.ObjectId(userId), type: "go-times" });
}

type Category = "GOOD" | "MARGINAL" | "NO_GO";

interface ForecastSlice {
    time: string;
    windKmh: number;
    gustKmh: number | null;
    tempC: number;
    precipPct: number | null;
    /** Meteorological degrees (0–360), when provider supplies it. */
    windDirectionDeg?: number | null;
    /** Wind speed (km/h) by user height key: "ground" | "500" | "1000" | ... */
    windByHeight?: Record<string, number>;
}

export interface GoTimesMeta {
    locationsChecked: Array<{ id: string; name: string }>;
    dateRange: { from: string; to: string };
    providersUsed: string[];
    slicesEvaluated: number;
    goodCount: number;
    marginalCount: number;
    noGoCount: number;
    /** Why hourly checks may not become a listed window (education). */
    whyNoListedWindows?: string[];
    nearMisses: Array<{
        id: string;
        locationId: string;
        locationName?: string;
        time: string;
        startTime: string;
        endTime: string;
        score: number;
        category: Category;
        windKmh: number;
        gustKmh: number | null;
        tempC: number;
        precipPct: number | null;
        reason: string;
        /** All evaluation reasons for this hour (why it’s not a full window). */
        allReasons?: string[];
    }>;
}

export interface WindAtHeight {
    label: string;
    minWindKmh: number;
    maxWindKmh: number;
}

/** Aggregated stats for one weather source across this window. */
export interface ProviderWindowDetail {
    providerId: string;
    hourCount: number;
    minWindKmh: number;
    maxWindKmh: number;
    minGustKmh: number | null;
    maxGustKmh: number | null;
    minTempC: number;
    maxTempC: number;
    minPrecipPct: number | null;
    maxPrecipPct: number | null;
    avgScore: number;
}

/** One clock hour with values from each source that reported it. */
export interface HourlySourceRow {
    time: string;
    /** When sources disagree, who is farthest from the group median this hour. */
    outlierHints?: string[];
    providers: Array<{
        providerId: string;
        windKmh: number;
        gustKmh: number | null;
        tempC: number;
        precipPct: number | null;
        category: Category;
        score: number;
    }>;
}

export interface GoTimeWindow {
    id: string;
    locationId: string;
    locationName?: string;
    /** Saved spot coordinates (for external map links). */
    locationLat?: number;
    locationLng?: number;
    startTime: string;
    endTime: string;
    /** Forecast-local display times for user-facing labels. */
    displayStartTime?: string;
    displayEndTime?: string;
    category: Category;
    /** 0–1 suitability: how well conditions match user limits (wind, gust, temp, precip, time). */
    suitabilityScore?: number;
    averageScore: number;
    /** 0–1 forecast reliability (agreement + source coverage + completeness). */
    reliabilityScore?: number;
    /**
     * @deprecated Use reliabilityScore — kept for older clients; same as reliability when present.
     */
    confidence?: number;
    /** Short blended-conditions line (weather only, no suitability/reliability). */
    summaryExplanation?: string;
    /** Why forecasts may disagree or be thin on sources (independent of suitability). */
    reliabilityExplanation?: string;
    providerCount: number;
    minWindKmh: number;
    maxWindKmh: number;
    hasGusts: boolean;
    maxGustKmh: number;
    minTempC: number;
    maxTempC: number;
    hasPrecip: boolean;
    minPrecipPct: number;
    maxPrecipPct: number;
    /** Wind by subscribed height. Key: "ground" | "500" | "1000" | ... */
    windByHeight?: Record<string, WindAtHeight>;
    /** Deduped reasons from hourly evaluations in this window (limits, marginal factors, etc.). */
    evaluationNotes?: string[];
    /** Per-source aggregates for this window. */
    byProvider?: ProviderWindowDetail[];
    /** Hour-by-hour values from each source (within the displayed window). */
    hourlyBySource?: HourlySourceRow[];
    /** Sources that diverge most from the group median this window (may be less reliable). */
    outlierProviders?: Array<{ providerId: string; summary: string }>;
    /** Blended (fused) min–max vs min–max across all sources in this window. */
    dataMargins?: GoTimeDataMargins;
    /** Readable one-line summary of blended vs source spread (readability). */
    dataMarginSummary?: string;
    /** Fused values per clock hour in this window (for sparklines). */
    windowSeries?: GoTimeWindowSeriesPoint[];
    /** Circular mean of hourly wind direction (°), when available. */
    avgWindDirDeg?: number | null;
}

/** Start → end → id so multiple windows on the same day/place read in clock order, not suitability order. */
function sortGoTimeWindowsChronologically(windows: GoTimeWindow[]): GoTimeWindow[] {
    return [...windows].sort((a, b) => {
        const ta = new Date(a.startTime).getTime();
        const tb = new Date(b.startTime).getTime();
        if (ta !== tb) return ta - tb;
        const ea = new Date(a.endTime).getTime();
        const eb = new Date(b.endTime).getTime();
        if (ea !== eb) return ea - eb;
        return a.id.localeCompare(b.id);
    });
}

/** One hour in the window — blended fusion values. */
export interface GoTimeWindowSeriesPoint {
    /** Forecast hour (location-local ISO from provider). */
    time: string;
    windKmh: number | null;
    gustKmh: number | null;
    tempC: number | null;
    precipPct: number | null;
    windDirDeg: number | null;
    /** 0–1 suitability (preference match) for this hour. */
    suitability: number;
    /** 0–1 forecast reliability for this hour. */
    reliability: number;
}

/** Per field: fused range across hours vs source range across all providers. */
export interface GoTimeDimensionMargin {
    fusedMin: number;
    fusedMax: number;
    sourceMin: number;
    sourceMax: number;
}

export interface GoTimeDataMargins {
    wind: GoTimeDimensionMargin;
    gust: GoTimeDimensionMargin | null;
    tempC: GoTimeDimensionMargin;
    precipPct: GoTimeDimensionMargin | null;
    /** Whether any dimension shows meaningful disagreement (for UI). */
    hasSpread: boolean;
}

type WeatherHeightFt = "ground" | 500 | 1000 | 2000 | 3000 | 5000 | 10000;

interface Preferences {
    minWindKph?: number;
    maxWindKph: number;
    maxGustKph: number;
    maxGustWindDifferenceKph?: number;
    minTempC?: number;
    maxTempC?: number;
    maxPrecipitationProbabilityPercent?: number;
    preferredTimeBlocks?: Array<{ id: string; start: number; end: number }>;
    minSessionLengthMinutes?: number;
    weatherHeightFt?: WeatherHeightFt[];
}

const HEIGHT_LABELS: Record<string, string> = {
    ground: "Ground (10m)",
    "500": "500 ft",
    "1000": "1,000 ft",
    "2000": "2,000 ft",
    "3000": "3,000 ft",
    "5000": "5,000 ft",
    "10000": "10,000 ft",
};

/** Friendly display names for weather providers. */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    "open-meteo": "Open-Meteo",
    "met-norway": "Met Norway",
    meteosource: "Meteosource",
    openweather: "OpenWeather",
    visualcrossing: "Visual Crossing",
};

interface Location {
    id: string;
    name: string;
    lat: number;
    lng: number;
}

function parseHourlyToSlices(
    data: Record<string, unknown>,
    heights?: WeatherHeightFt[]
): ForecastSlice[] {
    const hourly = data.hourly as
        | {
              time?: string[];
              wind_speed_10m?: number[];
              wind_speed_80m?: number[];
              wind_speed_120m?: number[];
              wind_speed_180m?: number[];
              wind_gusts_10m?: number[];
              wind_direction_10m?: number[];
              temperature_2m?: number[];
              precipitation_probability?: number[];
          }
        | undefined;
    if (!hourly?.time?.length) return [];

    const time = hourly.time;
    const wind = hourly.wind_speed_10m ?? [];
    const gust = hourly.wind_gusts_10m ?? [];
    const wdir = hourly.wind_direction_10m ?? [];
    const temp = hourly.temperature_2m ?? [];
    const precip = hourly.precipitation_probability ?? [];

    const heightVars: Record<string, number[] | undefined> = {
        wind_speed_10m: hourly.wind_speed_10m,
        wind_speed_80m: hourly.wind_speed_80m,
        wind_speed_120m: hourly.wind_speed_120m,
        wind_speed_180m: hourly.wind_speed_180m,
    };

    return time.map((t, i) => {
        const base: ForecastSlice = {
            time: t,
            windKmh: wind[i] ?? 0,
            gustKmh: gust[i] ?? null,
            tempC: temp[i] ?? 0,
            precipPct: precip[i] ?? null,
            windDirectionDeg: wdir[i] != null ? wdir[i] : null,
        };

        if (heights?.length) {
            const windByHeight: Record<string, number> = {};
            for (const h of heights) {
                const key = h === "ground" ? "ground" : String(h);
                const varName = HEIGHT_TO_OPEN_METEO_VAR[key];
                if (varName && heightVars[varName]) {
                    const arr = heightVars[varName] as number[];
                    windByHeight[key] = arr[i] ?? base.windKmh;
                } else {
                    windByHeight[key] = base.windKmh;
                }
            }
            base.windByHeight = windByHeight;
        }
        return base;
    });
}

function windByHeightFromFusionWindow(w: RawFusionWindow, heights?: WeatherHeightFt[]): Record<string, WindAtHeight> | undefined {
    if (!heights?.length) return undefined;
    const windByHeight: Record<string, WindAtHeight> = {};
    for (const h of heights) {
        const key = h === "ground" ? "ground" : String(h);
        const vals: number[] = [];
        for (const fh of w.hours) {
            for (const p of fh.points) {
                if (p.windByHeight?.[key] != null) vals.push(p.windByHeight[key]!);
            }
        }
        if (vals.length > 0) {
            windByHeight[key] = {
                label: HEIGHT_LABELS[key] ?? key,
                minWindKmh: Math.round(Math.min(...vals)),
                maxWindKmh: Math.round(Math.max(...vals)),
            };
        }
    }
    return Object.keys(windByHeight).length > 0 ? windByHeight : undefined;
}

function buildFusionByProviderDetails(w: RawFusionWindow): ProviderWindowDetail[] {
    const byProv = new Map<string, { points: ForecastPoint[]; matches: number[] }>();
    for (const fh of w.hours) {
        for (const p of fh.points) {
            let entry = byProv.get(p.source);
            if (!entry) entry = { points: [], matches: [] };
            entry.points.push(p);
            const m = fh.perSourceMatch.find((x) => x.source === p.source);
            if (m) entry.matches.push(m.match * 100);
            byProv.set(p.source, entry);
        }
    }
    const out: ProviderWindowDetail[] = [];
    for (const [providerId, { points, matches }] of byProv) {
        const winds = points.map((x) => x.windSpeed).filter((v): v is number => v != null);
        const gusts = points.map((x) => x.windGust).filter((v): v is number => v != null);
        const temps = points.map((x) => x.temperature).filter((v): v is number => v != null);
        const precips = points.map((x) => x.precipitationProbability).filter((v): v is number => v != null);
        let hourCount = 0;
        for (const fh of w.hours) {
            if (fh.points.some((p) => p.source === providerId)) hourCount++;
        }
        out.push({
            providerId,
            hourCount,
            minWindKmh: winds.length ? Math.round(Math.min(...winds)) : 0,
            maxWindKmh: winds.length ? Math.round(Math.max(...winds)) : 0,
            minGustKmh: gusts.length ? Math.round(Math.min(...gusts)) : null,
            maxGustKmh: gusts.length ? Math.round(Math.max(...gusts)) : null,
            minTempC: temps.length ? Math.round(Math.min(...temps)) : 0,
            maxTempC: temps.length ? Math.round(Math.max(...temps)) : 0,
            minPrecipPct: precips.length ? Math.round(Math.min(...precips)) : null,
            maxPrecipPct: precips.length ? Math.round(Math.max(...precips)) : null,
            avgScore: matches.length ? Math.round(matches.reduce((a, b) => a + b, 0) / matches.length) : 0,
        });
    }
    return out.sort((a, b) => a.providerId.localeCompare(b.providerId));
}

function computeDataMarginsFromFusionWindow(w: RawFusionWindow): GoTimeDataMargins {
    let sWindMin = Infinity;
    let sWindMax = -Infinity;
    let sGustMin = Infinity;
    let sGustMax = -Infinity;
    let sTMin = Infinity;
    let sTMax = -Infinity;
    let sPMin = Infinity;
    let sPMax = -Infinity;
    let gustAny = false;
    let precipAny = false;

    for (const fh of w.hours) {
        for (const p of fh.points) {
            if (p.windSpeed != null) {
                sWindMin = Math.min(sWindMin, p.windSpeed);
                sWindMax = Math.max(sWindMax, p.windSpeed);
            }
            if (p.windGust != null) {
                gustAny = true;
                sGustMin = Math.min(sGustMin, p.windGust);
                sGustMax = Math.max(sGustMax, p.windGust);
            }
            if (p.temperature != null) {
                sTMin = Math.min(sTMin, p.temperature);
                sTMax = Math.max(sTMax, p.temperature);
            }
            if (p.precipitationProbability != null) {
                precipAny = true;
                sPMin = Math.min(sPMin, p.precipitationProbability);
                sPMax = Math.max(sPMax, p.precipitationProbability);
            }
        }
    }

    const fusedWinds = w.hours.map((h) => h.fusedWindKmh).filter((v): v is number => v != null);
    const fusedGusts = w.hours.map((h) => h.fusedGustKmh).filter((v): v is number => v != null);
    const fusedTemps = w.hours.map((h) => h.fusedTempC).filter((v): v is number => v != null);
    const fusedPrecips = w.hours.map((h) => h.fusedPrecipPct).filter((v): v is number => v != null);

    const wind: GoTimeDimensionMargin = {
        fusedMin: fusedWinds.length ? Math.min(...fusedWinds) : sWindMin,
        fusedMax: fusedWinds.length ? Math.max(...fusedWinds) : sWindMax,
        sourceMin: Number.isFinite(sWindMin) ? sWindMin : fusedWinds[0] ?? 0,
        sourceMax: Number.isFinite(sWindMax) ? sWindMax : fusedWinds[0] ?? 0,
    };
    const tempC: GoTimeDimensionMargin = {
        fusedMin: fusedTemps.length ? Math.min(...fusedTemps) : sTMin,
        fusedMax: fusedTemps.length ? Math.max(...fusedTemps) : sTMax,
        sourceMin: Number.isFinite(sTMin) ? sTMin : fusedTemps[0] ?? 0,
        sourceMax: Number.isFinite(sTMax) ? sTMax : fusedTemps[0] ?? 0,
    };
    const gust: GoTimeDimensionMargin | null =
        gustAny && Number.isFinite(sGustMin) && fusedGusts.length
            ? {
                  fusedMin: Math.min(...fusedGusts),
                  fusedMax: Math.max(...fusedGusts),
                  sourceMin: sGustMin,
                  sourceMax: sGustMax,
              }
            : null;
    const precipPct: GoTimeDimensionMargin | null =
        precipAny && Number.isFinite(sPMin) && fusedPrecips.length
            ? {
                  fusedMin: Math.min(...fusedPrecips),
                  fusedMax: Math.max(...fusedPrecips),
                  sourceMin: sPMin,
                  sourceMax: sPMax,
              }
            : null;

    const hasSpread =
        tempC.sourceMax - tempC.sourceMin >= 1.5 ||
        wind.sourceMax - wind.sourceMin >= 3 ||
        (gust != null && gust.sourceMax - gust.sourceMin >= 3) ||
        (precipPct != null && precipPct.sourceMax - precipPct.sourceMin >= 15);

    return { wind, gust, tempC, precipPct, hasSpread };
}

function circularMeanDirectionDeg(values: number[]): number | null {
    if (values.length === 0) return null;
    let sx = 0;
    let sy = 0;
    for (const d of values) {
        const rad = (d * Math.PI) / 180;
        sx += Math.sin(rad);
        sy += Math.cos(rad);
    }
    const n = values.length;
    let ang = (Math.atan2(sx / n, sy / n) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    return ang;
}

function buildWindowSeriesFromFusion(w: RawFusionWindow): {
    windowSeries: GoTimeWindowSeriesPoint[];
    avgWindDirDeg: number | null;
} {
    const windowSeries: GoTimeWindowSeriesPoint[] = w.hours.map((h) => ({
        time: h.displayTimeIso,
        windKmh: h.fusedWindKmh,
        gustKmh: h.fusedGustKmh,
        tempC: h.fusedTempC,
        precipPct: h.fusedPrecipPct,
        windDirDeg: h.fusedWindDirDeg,
        suitability: h.suitabilityScore,
        reliability: h.reliabilityScore,
    }));
    const dirs = w.hours.map((h) => h.fusedWindDirDeg).filter((v): v is number => v != null);
    const avgWindDirDeg = dirs.length === 0 ? null : circularMeanDirectionDeg(dirs);
    return { windowSeries, avgWindDirDeg };
}

function buildDataMarginSummary(m: GoTimeDataMargins): string {
    const r = (n: number) => Math.round(n);
    const parts: string[] = [];

    const t = m.tempC;
    const tSpread = t.sourceMax - t.sourceMin;
    const tBlend = (t.fusedMin + t.fusedMax) / 2;
    if (tSpread >= 1.5) {
        parts.push(
            `About ${r(tBlend)}°C blended; sources range ${r(t.sourceMin)}°C to ${r(t.sourceMax)}°C`
        );
    } else {
        parts.push(`About ${r(tBlend)}°C`);
    }

    const w = m.wind;
    const wSpread = w.sourceMax - w.sourceMin;
    const wBlend = (w.fusedMin + w.fusedMax) / 2;
    if (wSpread >= 3) {
        parts.push(
            `wind ${r(w.sourceMin)}–${r(w.sourceMax)} km/h across sources (blend ${r(w.fusedMin)}–${r(w.fusedMax)})`
        );
    } else {
        parts.push(`wind ~${r(wBlend)} km/h`);
    }

    if (m.gust) {
        const g = m.gust;
        const gSpread = g.sourceMax - g.sourceMin;
        const gBlend = (g.fusedMin + g.fusedMax) / 2;
        if (gSpread >= 3) {
            parts.push(
                `gusts ${r(g.sourceMin)}–${r(g.sourceMax)} km/h (blend ${r(g.fusedMin)}–${r(g.fusedMax)})`
            );
        } else {
            parts.push(`gusts to ~${r(gBlend)} km/h`);
        }
    }

    if (m.precipPct) {
        const p = m.precipPct;
        const pSpread = p.sourceMax - p.sourceMin;
        if (pSpread >= 15) {
            parts.push(
                `precip chance ${r(p.sourceMin)}–${r(p.sourceMax)}% (blend ${r(p.fusedMin)}–${r(p.fusedMax)})`
            );
        }
    }

    return parts.join(" · ");
}

function buildFusionHourlyBySource(w: RawFusionWindow): HourlySourceRow[] {
    return w.hours.map((fh) => ({
        time: fh.displayTimeIso,
        outlierHints:
            fh.outlierHints.length > 0
                ? [...new Set(fh.outlierHints.map((o) => o.detail.trim()))]
                : undefined,
        providers: fh.points
            .map((p) => {
                const m = fh.perSourceMatch.find((x) => x.source === p.source);
                const match = m?.match ?? 0;
                return {
                    providerId: p.source,
                    windKmh: Math.round(p.windSpeed ?? 0),
                    gustKmh: p.windGust == null ? null : Math.round(p.windGust),
                    tempC: Math.round(p.temperature ?? 0),
                    precipPct: p.precipitationProbability == null ? null : Math.round(p.precipitationProbability),
                    category: categoryFromSuitability(match, {
                        // Per-source rows: do not apply window reliability; use match alone with higher bar via default gates
                    }),
                    score: Math.round(match * 100),
                };
            })
            .sort((a, b) => a.providerId.localeCompare(b.providerId)),
    }));
}

function mapFusionWindowToGoTimeWindow(
    w: RawFusionWindow,
    heights: WeatherHeightFt[] | undefined,
    totalProviders: number
): GoTimeWindow {
    const locId = w.locationId;
    const suit = w.windowSuitability;
    const rel = w.windowReliability;
    const category = categoryForWindow(w);
    const winds = w.hours.map((h) => h.fusedWindKmh).filter((v): v is number => v != null);
    const gusts = w.hours.map((h) => h.fusedGustKmh).filter((v): v is number => v != null);
    const temps = w.hours.map((h) => h.fusedTempC).filter((v): v is number => v != null);
    const precips = w.hours.map((h) => h.fusedPrecipPct).filter((v): v is number => v != null);
    const sourcesInWindow = new Set(w.hours.flatMap((h) => h.points.map((p) => p.source)));
    const summaryExplanation = buildWeatherSnapshot(w);
    const reliabilityExplanation = buildReliabilityExplanation(w, totalProviders);
    const outlierHintsMerged = mergeWindowOutlierHints(w.hours);
    const outlierProviders =
        outlierHintsMerged.length > 0
            ? outlierHintsMerged.map((o) => ({
                  providerId: o.source,
                  summary: o.detail,
              }))
            : undefined;
    const notes: string[] = [];
    if (w.minSuitability < 0.45) notes.push("Lower suitability in parts of this window — check details.");
    if (windowHasHighSourceSpread(w.hours) || w.hours.some((h) => h.agreementScore < 0.35)) {
        if (!outlierProviders?.length) {
            notes.push("Models diverge on wind/gust — rated carefully; expand “Model-by-model” for detail.");
        }
    }

    const dataMargins = computeDataMarginsFromFusionWindow(w);
    const dataMarginSummary = buildDataMarginSummary(dataMargins);
    const { windowSeries, avgWindDirDeg } = buildWindowSeriesFromFusion(w);

    return {
        id: `${locId}-${w.startTime}-${suit.toFixed(3)}`,
        locationId: locId,
        startTime: w.startTime,
        endTime: w.endTime,
        displayStartTime: w.displayStartTime,
        displayEndTime: w.displayEndTime,
        category,
        suitabilityScore: suit,
        averageScore: suit * 100,
        reliabilityScore: rel,
        confidence: rel,
        summaryExplanation,
        reliabilityExplanation,
        providerCount: sourcesInWindow.size,
        minWindKmh: winds.length ? Math.round(Math.min(...winds)) : 0,
        maxWindKmh: winds.length ? Math.round(Math.max(...winds)) : 0,
        hasGusts: gusts.length > 0,
        maxGustKmh: gusts.length ? Math.round(Math.max(...gusts)) : 0,
        minTempC: temps.length ? Math.round(Math.min(...temps)) : 0,
        maxTempC: temps.length ? Math.round(Math.max(...temps)) : 0,
        hasPrecip: precips.length > 0,
        minPrecipPct: precips.length ? Math.round(Math.min(...precips)) : 0,
        maxPrecipPct: precips.length ? Math.round(Math.max(...precips)) : 0,
        windByHeight: windByHeightFromFusionWindow(w, heights),
        evaluationNotes: notes.length > 0 ? notes : undefined,
        byProvider: buildFusionByProviderDetails(w),
        hourlyBySource: buildFusionHourlyBySource(w),
        outlierProviders,
        dataMargins,
        dataMarginSummary,
        windowSeries,
        avgWindDirDeg,
    };
}

export type WeatherHeightFtExport = "ground" | 500 | 1000 | 2000 | 3000 | 5000 | 10000;

export interface ProviderFetchStatus {
    providerId: string;
    /** Number of location fetches that returned usable hourly slices. */
    successCount: number;
    /** Number of location fetches that threw an error. */
    failCount: number;
    /** Whether at least one location produced usable slices. */
    ok: boolean;
    /** Last error message seen (if any). */
    lastError?: string;
    /** ISO when we last attempted this provider (for any location). */
    lastAttemptAt?: string;
    /** ISO when we last got usable slices (for any location). */
    lastSuccessAt?: string;
    /** Whether latest success came from cache. */
    lastSuccessWasCache?: boolean;
}

export interface GoTimesResult {
    windows: GoTimeWindow[];
    meta?: GoTimesMeta;
    computedAt: string;
    /** When weather data was last fetched from external APIs (not from our DB cache). */
    weatherDataFetchedAt: string;
    providersUsed: string[];
    providerStatuses?: ProviderFetchStatus[];
    heightsSubscribed: WeatherHeightFtExport[];
    minSessionLengthMinutes: number;
}

export async function computeAndStoreGoTimes(userId: string): Promise<GoTimesResult> {
    const doc = await UserData.findOne({ userId: new mongoose.Types.ObjectId(userId), type: "setup" });
    const data = (doc?.data as { locations?: Location[]; preferences?: Preferences }) ?? {};
    const locations = Array.isArray(data.locations) ? data.locations : [];
    const prefs = (data.preferences as Preferences) ?? { maxWindKph: 25, maxGustKph: 35 };

    const heights = (prefs.weatherHeightFt && prefs.weatherHeightFt.length > 0
        ? prefs.weatherHeightFt
        : ["ground"]) as WeatherHeightFt[];
    const heightsSubscribed = heights as WeatherHeightFtExport[];

    const minSessionLengthMinutes = prefs.minSessionLengthMinutes ?? 60;

    if (locations.length === 0) {
        return {
            windows: [],
            meta: undefined,
            computedAt: new Date().toISOString(),
            weatherDataFetchedAt: new Date().toISOString(),
            providersUsed: getGoTimesProviders(),
            heightsSubscribed,
            minSessionLengthMinutes,
        };
    }

    const hoursAhead = HORIZON_DAYS * 24;
    const allPoints: ForecastPoint[] = [];
    let weatherDataFetchedAtMs = 0;
    const now = new Date();
    const fromDate = new Date(now);
    const toDate = new Date(now);
    toDate.setDate(toDate.getDate() + HORIZON_DAYS);

    const providers = getGoTimesProviders();
    const providerStatusMap = new Map<string, ProviderFetchStatus>(
        providers.map((p) => [
            p,
            {
                providerId: p,
                successCount: 0,
                failCount: 0,
                ok: false,
            },
        ])
    );
    const fusionPrefs: FusionPreferences = {
        minWindKph: prefs.minWindKph,
        maxWindKph: prefs.maxWindKph,
        maxGustKph: prefs.maxGustKph,
        maxGustWindDifferenceKph: prefs.maxGustWindDifferenceKph,
        minTempC: prefs.minTempC,
        maxTempC: prefs.maxTempC,
        maxPrecipitationProbabilityPercent: prefs.maxPrecipitationProbabilityPercent,
        preferredTimeBlocks: prefs.preferredTimeBlocks,
    };

    for (const loc of locations) {
        for (const provider of providers) {
            const st = providerStatusMap.get(provider);
            const attemptedAtIso = new Date().toISOString();
            if (st) st.lastAttemptAt = attemptedAtIso;
            try {
                let weatherData: Record<string, unknown> | null = null;

                const requestMultiHeight = provider === "open-meteo";

                const cached = await getCachedWeather({
                    provider,
                    lat: loc.lat,
                    lng: loc.lng,
                    forecastType: "hourly",
                    hoursAhead,
                });
                let fetchedAtIso: string;
                let fromCache = false;
                if (cached) {
                    weatherData = cached.data as Record<string, unknown>;
                    fetchedAtIso = new Date(cached.fetchedAt).toISOString();
                    fromCache = true;
                    weatherDataFetchedAtMs = Math.max(
                        weatherDataFetchedAtMs,
                        new Date(cached.fetchedAt).getTime()
                    );
                } else {
                    recordApiCall(provider);
                    const fetchedAt = Date.now();
                    fetchedAtIso = new Date(fetchedAt).toISOString();
                    weatherData = await fetchFromProvider(provider, loc.lat, loc.lng, HORIZON_DAYS, {
                        requestMultiHeight,
                    });
                    weatherDataFetchedAtMs = Math.max(weatherDataFetchedAtMs, fetchedAt);
                    await setCachedWeather(
                        { provider, lat: loc.lat, lng: loc.lng, forecastType: "hourly", hoursAhead },
                        weatherData
                    );
                }

                const slices = parseHourlyToSlices(weatherData, heights);
                if (slices.length === 0) continue;

                allPoints.push(...forecastPointsFromSlices(loc.id, provider, slices, fetchedAtIso, heights));
                if (st) {
                    st.successCount += 1;
                    st.ok = true;
                    st.lastSuccessAt = attemptedAtIso;
                    st.lastSuccessWasCache = fromCache;
                }
            } catch (err) {
                console.error(`Go-times: fetch ${provider} for ${loc.name}:`, err);
                if (st) {
                    st.failCount += 1;
                    st.ok = st.successCount > 0;
                    st.lastError = err instanceof Error ? err.message : String(err);
                }
            }
        }
    }

    const fusedHours = buildFusedHourlyTimeline(allPoints, fusionPrefs, providers.length, now.getTime());
    const fusionWindows: RawFusionWindow[] = [];
    for (const loc of locations) {
        const locHours = fusedHours.filter((h) => h.locationId === loc.id);
        fusionWindows.push(
            ...groupFusedHoursIntoWindows(locHours, fusionPrefs, minSessionLengthMinutes, now.getTime())
        );
    }

    const recommendations = fusionWindows
        .map((w) => mapFusionWindowToGoTimeWindow(w, heights, providers.length))
        .sort((a, b) => {
            const as = a.suitabilityScore ?? 0;
            const bs = b.suitabilityScore ?? 0;
            if (Math.abs(bs - as) > 1e-6) return bs - as;
            const ar = a.reliabilityScore ?? 0;
            const br = b.reliabilityScore ?? 0;
            if (Math.abs(br - ar) > 1e-6) return br - ar;
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        })
        .slice(0, 40);

    const withNames = recommendations.map((r) => {
        const loc = locations.find((l) => l.id === r.locationId);
        return {
            ...r,
            locationName: loc?.name,
            locationLat: loc?.lat,
            locationLng: loc?.lng,
        };
    });

    const filtered = sortGoTimeWindowsChronologically(
        withNames.filter((w) => new Date(w.startTime).getTime() >= now.getTime()),
    );

    let meta: GoTimesMeta | undefined;
    if (filtered.length === 0 && fusedHours.length > 0) {
        const goodCount = fusedHours.filter(
            (h) =>
                categoryFromSuitability(h.suitabilityScore, {
                    reliability: h.reliabilityScore,
                    highSpread: windowHasHighSourceSpread([h]),
                }) === "GOOD",
        ).length;
        const marginalCount = fusedHours.filter(
            (h) =>
                categoryFromSuitability(h.suitabilityScore, {
                    reliability: h.reliabilityScore,
                    highSpread: windowHasHighSourceSpread([h]),
                }) === "MARGINAL",
        ).length;
        const noGoCount = fusedHours.filter(
            (h) =>
                categoryFromSuitability(h.suitabilityScore, {
                    reliability: h.reliabilityScore,
                    highSpread: windowHasHighSourceSpread([h]),
                }) === "NO_GO",
        ).length;

        const futureHours = fusedHours.filter((h) => new Date(h.timestampUtc).getTime() >= now.getTime());
        const nearMissCandidates = futureHours
            .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
            .slice(0, 10);

        const nearMissSessionMs = Math.max(15, prefs.minSessionLengthMinutes ?? 60) * 60 * 1000;
        const nearMisses = nearMissCandidates.map((h) => {
            const loc = locations.find((l) => l.id === h.locationId);
            const start = new Date(h.displayTimeIso);
            const end = new Date(start.getTime() + nearMissSessionMs);
            return {
                id: `near-${h.locationId}-${h.timestampUtc}`,
                locationId: h.locationId,
                locationName: loc?.name,
                time: h.displayTimeIso,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                score: Math.round(h.suitabilityScore * 100),
                category: categoryFromSuitability(h.suitabilityScore, {
                    reliability: h.reliabilityScore,
                    highSpread: windowHasHighSourceSpread([h]),
                }),
                windKmh: h.fusedWindKmh ?? 0,
                gustKmh: h.fusedGustKmh,
                tempC: h.fusedTempC ?? 0,
                precipPct: h.fusedPrecipPct,
                reason:
                    h.suitabilityScore < 0.45
                        ? "Suitability is low for your limits — relax preferences or pick another hour."
                        : "Closest hour by suitability for your preferences.",
                allReasons: [
                    `Suitability ${(h.suitabilityScore * 100).toFixed(0)}%`,
                    `Reliability ${(h.reliabilityScore * 100).toFixed(0)}% (agreement & coverage)`,
                ],
            };
        });

        const minSession = prefs.minSessionLengthMinutes ?? 60;
        meta = {
            locationsChecked: locations.map((l) => ({ id: l.id, name: l.name })),
            dateRange: {
                from: fromDate.toISOString().slice(0, 10),
                to: toDate.toISOString().slice(0, 10),
            },
            providersUsed: providers,
            slicesEvaluated: allPoints.length,
            goodCount,
            marginalCount,
            noGoCount,
            nearMisses,
            whyNoListedWindows: [
                `Windows need contiguous hours where suitability (fit to your limits) stays above a threshold.`,
                `Contiguous hours must run at least ${minSession} minutes without gaps over 90 minutes.`,
                `Forecast reliability (source agreement) is shown separately from suitability.`,
            ],
        };
    } else if (filtered.length === 0 && allPoints.length === 0) {
        meta = {
            locationsChecked: locations.map((l) => ({ id: l.id, name: l.name })),
            dateRange: {
                from: fromDate.toISOString().slice(0, 10),
                to: toDate.toISOString().slice(0, 10),
            },
            providersUsed: providers,
            slicesEvaluated: 0,
            goodCount: 0,
            marginalCount: 0,
            noGoCount: 0,
            nearMisses: [],
            whyNoListedWindows: [
                `No hourly forecast data was returned from weather sources. Check network or API keys for optional providers.`,
            ],
        };
    }

    const computedAt = new Date().toISOString();
    const weatherDataFetchedAt =
        weatherDataFetchedAtMs > 0 ? new Date(weatherDataFetchedAtMs).toISOString() : computedAt;
    const providerStatuses = [...providerStatusMap.values()];
    await UserData.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), type: "go-times" },
        {
            $set: {
                data: {
                    computedAt,
                    weatherDataFetchedAt,
                    windows: filtered,
                    meta,
                    providerStatuses,
                    heightsSubscribed,
                    minSessionLengthMinutes,
                    algorithmVersion: GO_TIMES_ALGORITHM_VERSION,
                },
            },
        },
        { new: true, upsert: true }
    );

    return {
        windows: filtered,
        meta,
        computedAt,
        weatherDataFetchedAt,
        providersUsed: getGoTimesProviders(),
        providerStatuses,
        heightsSubscribed,
        minSessionLengthMinutes,
    };
}

export async function getGoTimes(userId: string): Promise<GoTimesResult> {
    const doc = await UserData.findOne({ userId: new mongoose.Types.ObjectId(userId), type: "go-times" });
    const data = (doc?.data as {
        computedAt?: string;
        weatherDataFetchedAt?: string;
        windows?: GoTimeWindow[];
        meta?: GoTimesMeta;
        providerStatuses?: ProviderFetchStatus[];
        heightsSubscribed?: WeatherHeightFtExport[];
        minSessionLengthMinutes?: number;
        algorithmVersion?: number;
    }) ?? {};
    const computedAtMs = data.computedAt ? new Date(data.computedAt).getTime() : 0;
    const windows = (data.windows ?? []) as GoTimeWindow[];
    const meta = data.meta as GoTimesMeta | undefined;

    const now = Date.now();
    const isStale = now - computedAtMs > COMPUTED_MAX_AGE_MS;
    const isOldAlgorithm = data.algorithmVersion !== GO_TIMES_ALGORITHM_VERSION;
    const hasPassedWindows = windows.some((w) => new Date(w.startTime).getTime() < now - 60 * 60 * 1000);

    if (isStale || isOldAlgorithm || hasPassedWindows || windows.length === 0) {
        return computeAndStoreGoTimes(userId);
    }

    const filtered = sortGoTimeWindowsChronologically(
        windows.filter((w) => new Date(w.startTime).getTime() >= now),
    );
    const computedAt = data.computedAt ?? new Date().toISOString();
    const heightsSubscribed =
        (data.heightsSubscribed as WeatherHeightFtExport[] | undefined) ?? (["ground"] as WeatherHeightFtExport[]);
    const minSessionLengthMinutes = data.minSessionLengthMinutes ?? 60;
    const weatherDataFetchedAt = data.weatherDataFetchedAt ?? computedAt;
    let providerStatuses = data.providerStatuses;
    if (!providerStatuses || providerStatuses.length === 0) {
        // Backfill for older cached documents that predate providerStatuses.
        const successByProvider = new Map<string, number>();
        for (const w of filtered) {
            for (const p of w.byProvider ?? []) {
                successByProvider.set(p.providerId, (successByProvider.get(p.providerId) ?? 0) + 1);
            }
        }
        providerStatuses = getGoTimesProviders().map((providerId) => {
            const successCount = successByProvider.get(providerId) ?? 0;
            return {
                providerId,
                successCount,
                failCount: 0,
                ok: successCount > 0,
            };
        });
    }
    return {
        windows: filtered,
        meta: filtered.length === 0 ? meta : undefined,
        computedAt,
        weatherDataFetchedAt,
        providersUsed: getGoTimesProviders(),
        providerStatuses,
        heightsSubscribed,
        minSessionLengthMinutes,
    };
}
