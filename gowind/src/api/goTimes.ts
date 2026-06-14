import { apiFetch } from "./client.js";

export interface WindAtHeight {
    label: string;
    minWindKmh: number;
    maxWindKmh: number;
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
    category: "GOOD" | "MARGINAL" | "NO_GO";
    /** 0–1 how well conditions match your limits (suitability). */
    suitabilityScore?: number;
    averageScore: number;
    /** 0–1 forecast reliability (agreement, coverage, completeness). */
    reliabilityScore?: number;
    /** @deprecated Same as reliabilityScore when present. */
    confidence?: number;
    summaryExplanation?: string;
    /** Forecast reliability in plain language (independent of suitability). */
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
    windByHeight?: Record<string, WindAtHeight>;
    /** Why hours in this window scored good/marginal (deduped from forecasts). */
    evaluationNotes?: string[];
    byProvider?: ProviderWindowDetail[];
    hourlyBySource?: HourlySourceRow[];
    outlierProviders?: Array<{ providerId: string; summary: string }>;
    dataMargins?: GoTimeDataMargins;
    dataMarginSummary?: string;
    /** Fused hourly samples for trend chart. */
    windowSeries?: GoTimeWindowSeriesPoint[];
    /** Circular mean wind direction (°), when available. */
    avgWindDirDeg?: number | null;
}

export interface GoTimeWindowSeriesPoint {
    time: string;
    windKmh: number | null;
    gustKmh: number | null;
    tempC: number | null;
    precipPct: number | null;
    windDirDeg: number | null;
    suitability?: number;
    reliability?: number;
    /** @deprecated Old API — use suitability */
    confidence?: number;
}

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
    hasSpread: boolean;
}

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

export interface HourlySourceRow {
    time: string;
    outlierHints?: string[];
    providers: Array<{
        providerId: string;
        windKmh: number;
        gustKmh: number | null;
        tempC: number;
        precipPct: number | null;
        category: "GOOD" | "MARGINAL" | "NO_GO";
        score: number;
    }>;
}

export interface GoTimesMeta {
    locationsChecked: Array<{ id: string; name: string }>;
    dateRange: { from: string; to: string };
    providersUsed: string[];
    slicesEvaluated: number;
    goodCount: number;
    marginalCount: number;
    noGoCount: number;
    whyNoListedWindows?: string[];
    nearMisses: Array<{
        id: string;
        locationId: string;
        locationName?: string;
        time: string;
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
    }>;
}

export type WeatherHeightFt = "ground" | 500 | 1000 | 2000 | 3000 | 5000 | 10000;

export interface GoTimesResponse {
    windows: GoTimeWindow[];
    meta?: GoTimesMeta;
    computedAt: string;
    /** When weather data was last fetched from external APIs. */
    weatherDataFetchedAt: string;
    providersUsed: string[];
    providerStatuses?: ProviderFetchStatus[];
    heightsSubscribed: WeatherHeightFt[];
    minSessionLengthMinutes: number;
}

export interface ProviderFetchStatus {
    providerId: string;
    successCount: number;
    failCount: number;
    ok: boolean;
    lastError?: string;
    lastAttemptAt?: string;
    lastSuccessAt?: string;
    lastSuccessWasCache?: boolean;
}

/** Friendly display names for weather providers. */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    "open-meteo": "Open-Meteo",
    "met-norway": "Met Norway",
    meteosource: "Meteosource",
    openweather: "OpenWeather",
    visualcrossing: "Visual Crossing",
};

export async function getGoTimes(): Promise<GoTimesResponse> {
    return apiFetch("/go-times") as Promise<GoTimesResponse>;
}
