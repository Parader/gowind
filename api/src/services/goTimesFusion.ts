/**
 * Multi-source weather fusion + confidence for Go Times.
 * Normalizes provider slices, fuses with weighted averages, scores agreement,
 * and builds windows from hourly confidence (always surfaces best available).
 */

export type ForecastSourceId = string;

/** Normalized hourly point — km/h, °C, %; UTC timestamps; null when unknown. */
export interface ForecastPoint {
    source: ForecastSourceId;
    locationId: string;
    /** ISO UTC for the forecast hour (bucket-aligned). */
    timestamp: string;
    /** Original API time string (for local clock / preferred blocks). */
    sliceTimeIso: string;
    windSpeed: number | null;
    windGust: number | null;
    temperature: number | null;
    precipitation: number | null;
    precipitationProbability: number | null;
    windDirection: number | null;
    /** When multi-height wind is requested (Open-Meteo), copied from slice. */
    windByHeight?: Record<string, number>;
    fetchedAt: string;
}

export interface ForecastSliceLike {
    time: string;
    windKmh: number;
    gustKmh: number | null;
    tempC: number;
    precipPct: number | null;
    /** Degrees 0–360 when available (e.g. Open-Meteo). */
    windDirectionDeg?: number | null;
    windByHeight?: Record<string, number>;
}

export type WeatherHeightFt = "ground" | 500 | 1000 | 2000 | 3000 | 5000 | 10000;

export interface FusionPreferences {
    minWindKph?: number;
    maxWindKph: number;
    maxGustKph: number;
    maxGustWindDifferenceKph?: number;
    minTempC?: number;
    maxTempC?: number;
    maxPrecipitationProbabilityPercent?: number;
    preferredTimeBlocks?: Array<{ start: number; end: number }>;
}

/** Tunable V1 weights — adjust without changing core logic. */
export const FUSION_CONFIG = {
    SOURCE_WEIGHTS: {
        "open-meteo": 1.0,
        "met-norway": 0.9,
        meteosource: 0.9,
        openweather: 0.95,
        visualcrossing: 0.9,
        weatherapi: 0.85,
    } as Record<string, number>,
    /** Per-dimension preference match (must sum to 1). */
    MATCH_WEIGHTS: {
        wind: 0.4,
        gust: 0.3,
        precipitation: 0.15,
        temperature: 0.1,
        time: 0.05,
    },
    /**
     * Within [minWind,maxWind], the soft score peaks at this fraction of the span above min
     * (paramotor / wind sports: enough wind to fly matters — not “calmest in band is best”).
     * ~0.4–0.55 works well; must stay in (0,1).
     */
    WIND_PREFERENCE_PEAK_FRACTION: 0.45,
    AGREEMENT_WEIGHTS: {
        wind: 0.45,
        gust: 0.3,
        precipitation: 0.15,
        temperature: 0.1,
    },
    /** Weights for hourly reliability (agreement + coverage + completeness). Must sum to 1. */
    RELIABILITY_WEIGHTS: {
        agreement: 0.5,
        coverage: 0.35,
        completeness: 0.15,
    },
    MAX_FETCH_AGE_HOURS: 6,
    /** Agreement from spread (km/h): <=a → 1, <=b → 0.7, <=c → 0.4, else 0.1 */
    WIND_SPREAD_KMH: [3, 6, 10] as [number, number, number],
    GUST_SPREAD_KMH: [4, 8, 12] as [number, number, number],
    /** Temperature spread °C */
    TEMP_SPREAD_C: [2, 4, 7] as [number, number, number],
    /** Precip % spread */
    PRECIP_SPREAD_PCT: [15, 30, 50] as [number, number, number],
    /** Try these min confidence levels when building windows (first match wins for “tier”). */
    WINDOW_CONFIDENCE_THRESHOLDS: [0.55, 0.4, 0.25, 0.12, 0.05],
    /** If agreement is from a single source, cap it (avoid fake certainty). */
    AGREEMENT_SINGLE_SOURCE_CAP: 0.55,
    EXPECTED_NUMERIC_FIELDS: 5,
    /** Flag outliers when spread exceeds this; source must be far from group median. */
    OUTLIER_MIN_SPREAD: { windKmh: 4, gustKmh: 5, precipPct: 18, tempC: 2 },
} as const;

function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, n));
}

function baseWeight(source: string): number {
    const w = FUSION_CONFIG.SOURCE_WEIGHTS[source];
    return w ?? 0.85;
}

function hourUtcIso(iso: string): string {
    const t = new Date(iso).getTime();
    const hourStart = Math.floor(t / 3600e3) * 3600e3;
    return new Date(hourStart).toISOString();
}

function effectiveWindKmh(slice: ForecastSliceLike, heights?: WeatherHeightFt[]): number {
    if (heights?.length && slice.windByHeight) {
        for (const h of heights) {
            const key = h === "ground" ? "ground" : String(h);
            const v = slice.windByHeight[key];
            if (typeof v === "number") return v;
        }
    }
    return slice.windKmh;
}

export function forecastPointsFromSlices(
    locationId: string,
    providerId: string,
    slices: ForecastSliceLike[],
    fetchedAtIso: string,
    heights?: WeatherHeightFt[]
): ForecastPoint[] {
    return slices.map((s) => ({
        source: providerId,
        locationId,
        timestamp: hourUtcIso(s.time),
        sliceTimeIso: s.time,
        windSpeed: effectiveWindKmh(s, heights),
        windGust: s.gustKmh,
        temperature: s.tempC,
        precipitation: null,
        precipitationProbability: s.precipPct,
        windDirection: s.windDirectionDeg ?? null,
        windByHeight: s.windByHeight ? { ...s.windByHeight } : undefined,
        fetchedAt: fetchedAtIso,
    }));
}

function isInPreferredTimeBlocks(hourLocal: number, blocks: Array<{ start: number; end: number }>): boolean {
    if (!blocks?.length) return true;
    for (const b of blocks) {
        const end = b.end === 24 ? 24 : b.end;
        if (hourLocal >= b.start && hourLocal < end) return true;
    }
    return false;
}

function normalizePreferredTimeBlocks(
    blocks: Array<{ start: number; end: number }> | undefined
): Array<{ start: number; end: number }> {
    const valid = (blocks ?? []).filter(
        (b) =>
            Number.isFinite(b.start) &&
            Number.isFinite(b.end) &&
            b.start >= 0 &&
            b.start < 24 &&
            b.end > b.start &&
            b.end <= 24
    );
    if (valid.length <= 1) return valid;

    const specificBlocks = valid.filter((b) => !(b.start <= 0 && b.end >= 24));
    return specificBlocks.length > 0 ? specificBlocks : valid.slice(0, 1);
}

/** Clock hour (0–23) as encoded in the forecast ISO (location-local, not server TZ). */
export function hourInForecastDisplay(displayIso: string): number {
    const m = displayIso.match(/T(\d{1,2}):/);
    if (m) return parseInt(m[1], 10);
    return new Date(displayIso).getHours();
}

function whichPreferredBlock(
    hourLocal: number,
    blocks: Array<{ start: number; end: number }>
): number | null {
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const end = b.end === 24 ? 24 : b.end;
        if (hourLocal >= b.start && hourLocal < end) return i;
    }
    return null;
}

function softTimeScore(sliceTimeIso: string, blocks: Array<{ start: number; end: number }>): number {
    const normalizedBlocks = normalizePreferredTimeBlocks(blocks);
    if (!normalizedBlocks.length) return 1;
    const hourLocal = hourInForecastDisplay(sliceTimeIso);
    return isInPreferredTimeBlocks(hourLocal, normalizedBlocks) ? 1 : 0.15;
}

/**
 * Below min wind: ramp in. Above max: fall off.
 * Within band: unimodal curve — score rises from min toward a “sweet spot” (enough wind to fly),
 * then eases down toward max. This matches paramotor / wind-sport intuition better than
 * treating the lowest wind in-band as the best score.
 */
function softWindKmh(wind: number, minW: number, maxW: number): number {
    if (wind < minW) {
        return clamp((wind - (minW - 12)) / 12, 0, 1);
    }
    if (wind > maxW) {
        return clamp(1 - (wind - maxW) / (maxW * 0.35 + 6), 0, 1);
    }
    const span = maxW - minW;
    if (span <= 0) return 1;
    const pf = clamp(FUSION_CONFIG.WIND_PREFERENCE_PEAK_FRACTION, 0.08, 0.92);
    const peak = minW + pf * span;
    if (wind <= peak) {
        const ramp = Math.max(peak - minW, 1e-6);
        const t = (wind - minW) / ramp;
        return clamp(0.85 + 0.15 * t, 0, 1);
    }
    const ramp = Math.max(maxW - peak, 1e-6);
    const t = (wind - peak) / ramp;
    return clamp(1 - 0.45 * t, 0, 1);
}

function softGustKmh(gust: number | null, maxGust: number): number {
    if (gust == null) return 0.75;
    if (gust <= maxGust) {
        const t = gust / maxGust;
        return clamp(1 - 0.35 * t, 0, 1);
    }
    return clamp(1 - (gust - maxGust) / (maxGust * 0.4 + 8), 0, 1);
}

function softGustDelta(gust: number | null, wind: number, maxDelta: number): number {
    if (gust == null) return 0.85;
    const d = gust - wind;
    if (d <= maxDelta) {
        return clamp(1 - 0.35 * (d / Math.max(maxDelta, 1)), 0, 1);
    }
    return clamp(1 - (d - maxDelta) / (maxDelta + 5), 0, 1);
}

function softTempC(temp: number, minT: number, maxT: number): number {
    if (temp < minT) return clamp((temp - (minT - 8)) / 8, 0, 1);
    if (temp > maxT) return clamp(1 - (temp - maxT) / 8, 0, 1);
    const mid = (minT + maxT) / 2;
    const half = (maxT - minT) / 2 || 1;
    return clamp(1 - Math.abs(temp - mid) / (half + 4), 0, 1);
}

function softPrecipPct(pct: number | null, maxPct: number): number {
    if (pct == null) return 0.8;
    if (pct <= maxPct) return clamp(1 - 0.4 * (pct / Math.max(maxPct, 1)), 0, 1);
    return clamp(1 - (pct - maxPct) / 40, 0, 1);
}

function completenessFactor(p: ForecastPoint): number {
    let n = 0;
    if (p.windSpeed != null) n++;
    if (p.windGust != null) n++;
    if (p.temperature != null) n++;
    if (p.precipitationProbability != null) n++;
    if (p.precipitation != null) n++;
    return n / FUSION_CONFIG.EXPECTED_NUMERIC_FIELDS;
}

function freshnessFactor(fetchedAtIso: string, nowMs: number): number {
    const ageH = (nowMs - new Date(fetchedAtIso).getTime()) / 3600e3;
    if (ageH <= 0) return 1;
    return clamp(1 - ageH / FUSION_CONFIG.MAX_FETCH_AGE_HOURS, 0.5, 1);
}

function effectiveWeight(p: ForecastPoint, nowMs: number): number {
    return baseWeight(p.source) * completenessFactor(p) * freshnessFactor(p.fetchedAt, nowMs);
}

function preferenceMatchScore(
    p: ForecastPoint,
    prefs: FusionPreferences,
    sliceTimeIso: string
): number {
    const minW = prefs.minWindKph ?? 0;
    const maxW = prefs.maxWindKph;
    const maxG = prefs.maxGustKph;
    const maxDelta = prefs.maxGustWindDifferenceKph ?? 15;
    const minT = prefs.minTempC ?? -25;
    const maxT = prefs.maxTempC ?? 40;
    const maxPrecip = prefs.maxPrecipitationProbabilityPercent ?? 100;

    const w = p.windSpeed ?? 0;
    const windS = softWindKmh(w, minW, maxW);
    const gustS = Math.min(softGustKmh(p.windGust, maxG), softGustDelta(p.windGust, w, maxDelta));
    const tempS = softTempC(p.temperature ?? 0, minT, maxT);
    const precipS = softPrecipPct(p.precipitationProbability, maxPrecip);
    const timeS = softTimeScore(sliceTimeIso, prefs.preferredTimeBlocks ?? []);

    const mw = FUSION_CONFIG.MATCH_WEIGHTS;
    return (
        windS * mw.wind +
        gustS * mw.gust +
        precipS * mw.precipitation +
        tempS * mw.temperature +
        timeS * mw.time
    );
}

function spreadToAgreement(spread: number, a: number, b: number, c: number): number {
    if (spread <= a) return 1;
    if (spread <= b) return 0.7;
    if (spread <= c) return 0.4;
    return 0.1;
}

function numericSpread(values: number[]): number {
    if (values.length < 2) return 0;
    return Math.max(...values) - Math.min(...values);
}

function agreementScoreForBucket(points: ForecastPoint[]): number {
    const winds = points.map((p) => p.windSpeed).filter((v): v is number => v != null);
    const gusts = points.map((p) => p.windGust).filter((v): v is number => v != null);
    const temps = points.map((p) => p.temperature).filter((v): v is number => v != null);
    const precips = points.map((p) => p.precipitationProbability).filter((v): v is number => v != null);

    const [wa, wb, wc] = FUSION_CONFIG.WIND_SPREAD_KMH;
    const [ga, gb, gc] = FUSION_CONFIG.GUST_SPREAD_KMH;
    const [ta, tb, tc] = FUSION_CONFIG.TEMP_SPREAD_C;
    const [pa, pb, pc] = FUSION_CONFIG.PRECIP_SPREAD_PCT;

    const wAg = winds.length >= 2 ? spreadToAgreement(numericSpread(winds), wa, wb, wc) : 1;
    const gAg = gusts.length >= 2 ? spreadToAgreement(numericSpread(gusts), ga, gb, gc) : 1;
    const tAg = temps.length >= 2 ? spreadToAgreement(numericSpread(temps), ta, tb, tc) : 1;
    const pAg = precips.length >= 2 ? spreadToAgreement(numericSpread(precips), pa, pb, pc) : 1;

    const aw = FUSION_CONFIG.AGREEMENT_WEIGHTS;
    let combined = wAg * aw.wind + gAg * aw.gust + pAg * aw.precipitation + tAg * aw.temperature;

    const distinctSources = new Set(points.map((p) => p.source)).size;
    if (distinctSources < 2) {
        combined = Math.min(combined, FUSION_CONFIG.AGREEMENT_SINGLE_SOURCE_CAP);
    }

    return combined;
}

/** Weighted circular mean of wind direction (degrees, meteorological). */
function fusedWeightedDirectionDeg(points: ForecastPoint[], nowMs: number): number | null {
    let sx = 0;
    let sy = 0;
    let tw = 0;
    for (const p of points) {
        if (p.windDirection == null) continue;
        const wt = effectiveWeight(p, nowMs);
        const rad = (p.windDirection * Math.PI) / 180;
        sx += wt * Math.sin(rad);
        sy += wt * Math.cos(rad);
        tw += wt;
    }
    if (tw <= 0) return null;
    let ang = (Math.atan2(sx / tw, sy / tw) * 180) / Math.PI;
    if (ang < 0) ang += 360;
    return ang;
}

function fusedWeighted(
    points: ForecastPoint[],
    pick: (p: ForecastPoint) => number | null,
    nowMs: number
): number | null {
    let num = 0;
    let den = 0;
    for (const p of points) {
        const v = pick(p);
        if (v == null) continue;
        const w = effectiveWeight(p, nowMs);
        num += v * w;
        den += w;
    }
    return den > 0 ? num / den : null;
}

function fusedMatchOnValues(
    wind: number | null,
    gust: number | null,
    temp: number | null,
    precip: number | null,
    prefs: FusionPreferences,
    sliceTimeIso: string
): number {
    const minW = prefs.minWindKph ?? 0;
    const maxW = prefs.maxWindKph;
    const maxG = prefs.maxGustKph;
    const maxDelta = prefs.maxGustWindDifferenceKph ?? 15;
    const minT = prefs.minTempC ?? -25;
    const maxT = prefs.maxTempC ?? 40;
    const maxPrecip = prefs.maxPrecipitationProbabilityPercent ?? 100;

    const w = wind ?? 0;
    const windS = softWindKmh(w, minW, maxW);
    const gustS = Math.min(softGustKmh(gust, maxG), softGustDelta(gust, w, maxDelta));
    const tempS = softTempC(temp ?? 0, minT, maxT);
    const precipS = softPrecipPct(precip, maxPrecip);
    const timeS = softTimeScore(sliceTimeIso, prefs.preferredTimeBlocks ?? []);

    const mw = FUSION_CONFIG.MATCH_WEIGHTS;
    return (
        windS * mw.wind +
        gustS * mw.gust +
        precipS * mw.precipitation +
        tempS * mw.temperature +
        timeS * mw.time
    );
}

function median(nums: number[]): number {
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** One source standing away from the group on a single field (for UI). */
export interface FusionOutlierHint {
    source: string;
    /** e.g. "Wind 15 km/h vs median ~8 km/h" */
    detail: string;
    /** Larger = further from consensus (for sorting). */
    severity: number;
}

function hintForSpread(
    points: ForecastPoint[],
    get: (p: ForecastPoint) => number | null,
    minSpread: number,
    label: string,
    unitSuffix: string,
    round: (n: number) => number = Math.round
): FusionOutlierHint | null {
    const entries = points
        .map((p) => ({ p, v: get(p) }))
        .filter((x): x is { p: ForecastPoint; v: number } => x.v != null);
    if (entries.length < 2) return null;
    const vals = entries.map((e) => e.v);
    const spread = Math.max(...vals) - Math.min(...vals);
    if (spread < minSpread) return null;
    const med = median(vals);
    let best: { p: ForecastPoint; v: number; dev: number } | null = null;
    for (const e of entries) {
        const dev = Math.abs(e.v - med);
        if (!best || dev > best.dev) best = { p: e.p, v: e.v, dev };
    }
    if (!best) return null;
    const minDev = Math.max(minSpread * 0.22, label === "Precip chance" ? 8 : 2);
    if (best.dev < minDev) return null;
    return {
        source: best.p.source,
        detail: `${label} ${round(best.v)}${unitSuffix} vs median ~${round(med)}${unitSuffix}`,
        severity: best.dev,
    };
}

function mergeHintsSameHour(hints: FusionOutlierHint[]): FusionOutlierHint[] {
    const m = new Map<string, FusionOutlierHint>();
    for (const h of hints) {
        const ex = m.get(h.source);
        if (!ex) {
            m.set(h.source, { ...h });
        } else {
            m.set(h.source, {
                source: h.source,
                detail: `${ex.detail}; ${h.detail}`,
                severity: Math.max(ex.severity, h.severity),
            });
        }
    }
    return [...m.values()].sort((a, b) => b.severity - a.severity);
}

/** Sources farthest from the group median when models disagree (for trust UI). */
export function findOutliersForHour(points: ForecastPoint[]): FusionOutlierHint[] {
    const cfg = FUSION_CONFIG.OUTLIER_MIN_SPREAD;
    const raw: FusionOutlierHint[] = [];
    const w = hintForSpread(points, (p) => p.windSpeed, cfg.windKmh, "Wind", " km/h");
    if (w) raw.push(w);
    const g = hintForSpread(points, (p) => p.windGust, cfg.gustKmh, "Gusts", " km/h");
    if (g) raw.push(g);
    const pr = hintForSpread(points, (p) => p.precipitationProbability, cfg.precipPct, "Precip chance", "%");
    if (pr) raw.push(pr);
    const t = hintForSpread(points, (p) => p.temperature, cfg.tempC, "Temp", "°C");
    if (t) raw.push(t);
    return mergeHintsSameHour(raw);
}

export interface FusedHour {
    locationId: string;
    timestampUtc: string;
    /** Original slice time from primary point (for local hour display). */
    displayTimeIso: string;
    fusedWindKmh: number | null;
    fusedGustKmh: number | null;
    fusedTempC: number | null;
    fusedPrecipPct: number | null;
    /** Blended wind direction (°), when any source reports direction. */
    fusedWindDirDeg: number | null;
    /**
     * How well fused conditions match user limits (wind, gust, temp, precip, time) — 0–1.
     * Independent of model agreement.
     */
    suitabilityScore: number;
    /**
     * Forecast reliability from source agreement, coverage, and data completeness — 0–1.
     * Independent of whether conditions suit the user.
     */
    reliabilityScore: number;
    agreementScore: number;
    sourceCoverageScore: number;
    points: ForecastPoint[];
    /** Per-source match score 0–1 */
    perSourceMatch: Array<{ source: string; match: number; effectiveWeight: number }>;
    /** Which source(s) differ most from the group this hour (spread + distance from median). */
    outlierHints: FusionOutlierHint[];
}

function fuseHourBucket(
    locationId: string,
    displayTimeIso: string,
    points: ForecastPoint[],
    prefs: FusionPreferences,
    totalProviderCount: number,
    nowMs: number
): FusedHour | null {
    if (points.length === 0) return null;

    const timestampUtc = points[0].timestamp;
    const fusedWind = fusedWeighted(points, (p) => p.windSpeed, nowMs);
    const fusedGust = fusedWeighted(points, (p) => p.windGust, nowMs);
    const fusedTemp = fusedWeighted(points, (p) => p.temperature, nowMs);
    const fusedPrecip = fusedWeighted(points, (p) => p.precipitationProbability, nowMs);
    const fusedWindDir = fusedWeightedDirectionDeg(points, nowMs);

    const agreementScore = agreementScoreForBucket(points);

    const usableSources = new Set(
        points.filter((p) => p.windSpeed != null && p.windSpeed >= 0).map((p) => p.source)
    ).size;
    const sourceCoverageScore = totalProviderCount > 0 ? usableSources / totalProviderCount : 0;

    const suitabilityScore = fusedMatchOnValues(
        fusedWind,
        fusedGust,
        fusedTemp,
        fusedPrecip,
        prefs,
        displayTimeIso
    );

    const completenessAvg =
        points.reduce((s, p) => s + completenessFactor(p), 0) / Math.max(1, points.length);
    const rw = FUSION_CONFIG.RELIABILITY_WEIGHTS;
    const reliabilityScore = clamp(
        agreementScore * rw.agreement + sourceCoverageScore * rw.coverage + completenessAvg * rw.completeness,
        0,
        1
    );

    const perSourceMatch = points.map((p) => ({
        source: p.source,
        match: preferenceMatchScore(p, prefs, displayTimeIso),
        effectiveWeight: effectiveWeight(p, nowMs),
    }));

    const outlierHints = findOutliersForHour(points);

    return {
        locationId,
        timestampUtc,
        displayTimeIso,
        fusedWindKmh: fusedWind,
        fusedGustKmh: fusedGust,
        fusedTempC: fusedTemp,
        fusedPrecipPct: fusedPrecip,
        fusedWindDirDeg: fusedWindDir,
        suitabilityScore,
        reliabilityScore,
        agreementScore,
        sourceCoverageScore,
        points,
        perSourceMatch,
        outlierHints,
    };
}

function groupPointsByHour(points: ForecastPoint[]): Map<string, ForecastPoint[]> {
    const m = new Map<string, ForecastPoint[]>();
    for (const p of points) {
        const key = `${p.locationId}|${p.timestamp}`;
        const list = m.get(key) ?? [];
        list.push(p);
        m.set(key, list);
    }
    for (const [, arr] of m) {
        arr.sort((a, b) => a.source.localeCompare(b.source));
    }
    return m;
}

function pickDisplayTimeIso(points: ForecastPoint[]): string {
    return points.find((p) => p.source === "open-meteo")?.sliceTimeIso ?? points[0]!.sliceTimeIso;
}

function addHoursToDisplayIso(displayIso: string, hours: number): string {
    const match = displayIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?(?::(\d{2}))?/);
    if (!match) return new Date(new Date(displayIso).getTime() + hours * 3600e3).toISOString();

    const [, year, month, day, hour, minute = "00", second = "00"] = match;
    const ms = Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour) + hours,
        Number(minute),
        Number(second)
    );

    return new Date(ms).toISOString().slice(0, 19);
}

export function buildFusedHourlyTimeline(
    allPoints: ForecastPoint[],
    prefs: FusionPreferences,
    totalProviderCount: number,
    nowMs: number
): FusedHour[] {
    const buckets = groupPointsByHour(allPoints);
    const out: FusedHour[] = [];
    for (const [, pts] of buckets) {
        const locId = pts[0].locationId;
        const display = pickDisplayTimeIso(pts);
        const fused = fuseHourBucket(locId, display, pts, prefs, totalProviderCount, nowMs);
        if (fused) out.push(fused);
    }
    return out.sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime());
}

/** Roll up hourly outlier hints for a window (top diverging sources). */
export function mergeWindowOutlierHints(hours: FusedHour[], maxProviders = 4): FusionOutlierHint[] {
    const agg = new Map<string, { maxSev: number; details: Set<string> }>();
    for (const h of hours) {
        for (const o of h.outlierHints ?? []) {
            let e = agg.get(o.source);
            if (!e) e = { maxSev: 0, details: new Set<string>() };
            e.maxSev = Math.max(e.maxSev, o.severity);
            e.details.add(o.detail);
            agg.set(o.source, e);
        }
    }
    return [...agg.entries()]
        .map(([source, v]) => ({
            source,
            detail: [...v.details].join(" · "),
            severity: v.maxSev,
        }))
        .sort((a, b) => b.severity - a.severity)
        .slice(0, maxProviders);
}

export interface RawFusionWindow {
    locationId: string;
    startTime: string;
    endTime: string;
    /** Forecast-local display times; these preserve the user/location clock hours for UI labels. */
    displayStartTime: string;
    displayEndTime: string;
    hours: FusedHour[];
    /** Mean suitability (preference match) across hours in this window. */
    windowSuitability: number;
    minSuitability: number;
    maxSuitability: number;
    /** Mean reliability (agreement + coverage + completeness). */
    windowReliability: number;
}

const MAX_GAP_MINUTES = 90;
const MAX_PRECISION_EXTRA_HOURS = 1;
const MAX_PRECISION_WINDOWS_PER_CHAIN = 3;
const PRECISION_SCORE_DROP_TOLERANCE = 0.06;

/**
 * YYYY-MM-DD from the forecast hour string (location-local calendar from providers).
 * Used so windows never span two local forecast days.
 */
export function forecastLocalDateKey(displayIso: string): string {
    if (!displayIso || displayIso.length < 10) return "";
    return displayIso.slice(0, 10);
}

/** Same forecast day, gap ≤ max, and same preferred block when blocks are set. */
function canChainFusedHours(
    earlier: FusedHour,
    later: FusedHour,
    blocks: Array<{ start: number; end: number }> | undefined
): boolean {
    if (forecastLocalDateKey(later.displayTimeIso) !== forecastLocalDateKey(earlier.displayTimeIso)) {
        return false;
    }
    const gapMin =
        (new Date(later.timestampUtc).getTime() - new Date(earlier.timestampUtc).getTime()) / 60e3;
    if (gapMin > MAX_GAP_MINUTES) return false;
    if (!blocks?.length) return true;
    const he = hourInForecastDisplay(earlier.displayTimeIso);
    const hl = hourInForecastDisplay(later.displayTimeIso);
    const be = whichPreferredBlock(he, blocks);
    const bl = whichPreferredBlock(hl, blocks);
    return be !== null && bl !== null && be === bl;
}

/** Safety split: day boundaries + preferred-time block boundaries. */
function splitHoursByDayAndBlock(
    hours: FusedHour[],
    blocks: Array<{ start: number; end: number }> | undefined
): FusedHour[][] {
    if (hours.length === 0) return [];
    const chains: FusedHour[][] = [];
    let cur: FusedHour[] = [hours[0]!];
    for (let i = 1; i < hours.length; i++) {
        const h = hours[i]!;
        const prev = hours[i - 1]!;
        if (canChainFusedHours(prev, h, blocks)) cur.push(h);
        else {
            chains.push(cur);
            cur = [h];
        }
    }
    chains.push(cur);
    return chains;
}

function toRawWindow(run: FusedHour[]): RawFusionWindow {
    const suits = run.map((r) => r.suitabilityScore);
    const rels = run.map((r) => r.reliabilityScore);
    return {
        locationId: run[0].locationId,
        startTime: run[0].timestampUtc,
        endTime: new Date(new Date(run[run.length - 1].timestampUtc).getTime() + 3600e3).toISOString(),
        displayStartTime: run[0].displayTimeIso,
        displayEndTime: addHoursToDisplayIso(run[run.length - 1].displayTimeIso, 1),
        hours: run,
        windowSuitability: suits.reduce((a, b) => a + b, 0) / suits.length,
        minSuitability: Math.min(...suits),
        maxSuitability: Math.max(...suits),
        windowReliability: rels.reduce((a, b) => a + b, 0) / rels.length,
    };
}

function windowDurationMs(run: FusedHour[]): number {
    if (run.length === 0) return 0;
    const startMs = new Date(run[0].timestampUtc).getTime();
    const endMs = new Date(run[run.length - 1].timestampUtc).getTime() + 3600e3;
    return endMs - startMs;
}

function precisionWindowRank(run: FusedHour[], minHourCount: number): number {
    const suits = run.map((r) => r.suitabilityScore);
    const rels = run.map((r) => r.reliabilityScore);
    const avgSuit = suits.reduce((a, b) => a + b, 0) / suits.length;
    const minSuit = Math.min(...suits);
    const avgRel = rels.reduce((a, b) => a + b, 0) / rels.length;
    const scoreSpread = Math.max(...suits) - minSuit;
    const extraHours = Math.max(0, run.length - minHourCount);

    return avgSuit * 0.58 + minSuit * 0.28 + avgRel * 0.1 - scoreSpread * 0.04 - extraHours * 0.015;
}

function pickPreciseWindowsFromChain(chain: FusedHour[], minDurationMs: number): RawFusionWindow[] {
    if (windowDurationMs(chain) < minDurationMs) return [];

    const minHourCount = Math.max(1, Math.ceil(minDurationMs / 3600e3));
    const maxHourCount = Math.min(chain.length, minHourCount + MAX_PRECISION_EXTRA_HOURS);
    const candidates: Array<{ start: number; end: number; run: FusedHour[]; rank: number }> = [];

    for (let start = 0; start < chain.length; start++) {
        for (let count = minHourCount; count <= maxHourCount && start + count <= chain.length; count++) {
            const run = chain.slice(start, start + count);
            if (windowDurationMs(run) < minDurationMs) continue;
            candidates.push({
                start,
                end: start + count - 1,
                run,
                rank: precisionWindowRank(run, minHourCount),
            });
        }
    }

    candidates.sort((a, b) => {
        if (Math.abs(b.rank - a.rank) > 1e-6) return b.rank - a.rank;
        if (a.run.length !== b.run.length) return a.run.length - b.run.length;
        return new Date(a.run[0].timestampUtc).getTime() - new Date(b.run[0].timestampUtc).getTime();
    });

    const bestRank = candidates[0]?.rank;
    if (bestRank == null) return [];

    const picked: typeof candidates = [];
    for (const candidate of candidates) {
        if (picked.length >= MAX_PRECISION_WINDOWS_PER_CHAIN) break;
        if (candidate.rank < bestRank - PRECISION_SCORE_DROP_TOLERANCE) continue;
        const overlaps = picked.some((p) => candidate.start <= p.end && candidate.end >= p.start);
        if (!overlaps) picked.push(candidate);
    }

    return picked
        .sort((a, b) => new Date(a.run[0].timestampUtc).getTime() - new Date(b.run[0].timestampUtc).getTime())
        .map((candidate) => toRawWindow(candidate.run));
}

export function groupFusedHoursIntoWindows(
    hours: FusedHour[],
    prefs: FusionPreferences,
    minSessionMinutes: number,
    nowMs: number
): RawFusionWindow[] {
    const minDurationMs = Math.max(15, minSessionMinutes) * 60 * 1000;
    const blocks = normalizePreferredTimeBlocks(prefs.preferredTimeBlocks);
    const sorted = [...hours]
        .filter((h) => new Date(h.timestampUtc).getTime() >= nowMs - 60 * 60 * 1000)
        .sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime());
    if (sorted.length === 0) return [];

    const hourAllowedInWindows = (h: FusedHour): boolean => {
        if (!blocks?.length) return true;
        return whichPreferredBlock(hourInForecastDisplay(h.displayTimeIso), blocks) !== null;
    };

    const findRunsAtThreshold = (minConf: number): RawFusionWindow[] => {
        const runs: FusedHour[][] = [];
        let cur: FusedHour[] = [];

        const flush = () => {
            if (cur.length === 0) return;
            if (windowDurationMs(cur) >= minDurationMs) runs.push([...cur]);
            cur = [];
        };

        for (const h of sorted) {
            if (h.suitabilityScore < minConf) {
                flush();
                continue;
            }
            if (!hourAllowedInWindows(h)) {
                flush();
                continue;
            }
            if (cur.length === 0) {
                cur.push(h);
                continue;
            }
            const prev = cur[cur.length - 1];
            if (canChainFusedHours(prev, h, blocks)) cur.push(h);
            else {
                flush();
                cur.push(h);
            }
        }
        flush();

        return runs
            .flatMap((run) => splitHoursByDayAndBlock(run, blocks))
            .flatMap((chain) => pickPreciseWindowsFromChain(chain, minDurationMs));
    };

    for (const minConf of FUSION_CONFIG.WINDOW_CONFIDENCE_THRESHOLDS) {
        const runs = findRunsAtThreshold(minConf);
        if (runs.length > 0) return runs;
    }

    /** No run met duration at any threshold: extend best contiguous strip around top hour */
    const fallbackPool = blocks.length > 0 ? sorted.filter(hourAllowedInWindows) : sorted;
    const ranked = [...fallbackPool].sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    const seed = ranked[0];
    if (!seed) return [];

    const byTime = new Map(sorted.map((h) => [h.timestampUtc, h]));
    const contiguous: FusedHour[] = [seed];
    let t = new Date(seed.timestampUtc).getTime() - 3600e3;
    const firstT = new Date(sorted[0].timestampUtc).getTime();
    while (t >= firstT) {
        const iso = new Date(t).toISOString();
        const prev = byTime.get(iso);
        if (prev) {
            const head = contiguous[0]!;
            if (!canChainFusedHours(prev, head, blocks)) break;
            contiguous.unshift(prev);
        } else break;
        t -= 3600e3;
    }
    t = new Date(seed.timestampUtc).getTime() + 3600e3;
    const lastT = new Date(sorted[sorted.length - 1].timestampUtc).getTime();
    while (t <= lastT) {
        const iso = new Date(t).toISOString();
        const next = byTime.get(iso);
        if (next) {
            const last = contiguous[contiguous.length - 1]!;
            if (!canChainFusedHours(last, next, blocks)) break;
            contiguous.push(next);
        } else break;
        t += 3600e3;
    }

    const dayChains = splitHoursByDayAndBlock(contiguous, blocks);
    const fallbackWindows: RawFusionWindow[] = [];
    for (const chain of dayChains) {
        fallbackWindows.push(...pickPreciseWindowsFromChain(chain, minDurationMs));
    }
    if (fallbackWindows.length > 0) return fallbackWindows;

    return [toRawWindow([seed])];
}

/** Map blended suitability (preference fit) to window category. */
export function categoryFromSuitability(suitability: number): "GOOD" | "MARGINAL" | "NO_GO" {
    if (suitability >= 0.75) return "GOOD";
    if (suitability >= 0.5) return "MARGINAL";
    return "NO_GO";
}

/** @deprecated Use categoryFromSuitability — kept for callers still passing old blended scores. */
export function categoryFromConfidence(conf: number): "GOOD" | "MARGINAL" | "NO_GO" {
    return categoryFromSuitability(conf);
}

/** Short weather snapshot only (no suitability / reliability wording). */
export function buildWeatherSnapshot(w: RawFusionWindow): string {
    if (w.hours.length === 0) return "No hours in this window.";
    const avgWind =
        w.hours.map((x) => x.fusedWindKmh).filter((v): v is number => v != null).reduce((a, b) => a + b, 0) /
        Math.max(1, w.hours.filter((x) => x.fusedWindKmh != null).length);
    const avgGust =
        w.hours.map((x) => x.fusedGustKmh).filter((v): v is number => v != null).reduce((a, b) => a + b, 0) /
        Math.max(1, w.hours.filter((x) => x.fusedGustKmh != null).length);
    const wind = Number.isFinite(avgWind) ? `${Math.round(avgWind)} km/h` : "—";
    const gust = Number.isFinite(avgGust) ? `${Math.round(avgGust)} km/h` : "—";
    const parts = [
        `Blended wind ~${wind}`,
        w.hours.some((x) => x.fusedGustKmh != null) ? `gusts ~${gust}` : "",
    ].filter(Boolean);
    return parts.join(" · ");
}

/**
 * Human-readable forecast reliability (independent of suitability).
 * Based on inter-source agreement and source availability.
 */
export function buildReliabilityExplanation(w: RawFusionWindow, totalProviders: number): string {
    if (w.hours.length === 0) return "";
    const avgAgree = w.hours.reduce((s, x) => s + x.agreementScore, 0) / w.hours.length;
    const nSources = new Set(w.hours.flatMap((x) => x.points.map((p) => p.source))).size;
    let line: string;
    if (avgAgree >= 0.65) line = "Forecasts agree across sources";
    else if (avgAgree >= 0.38) line = "Some disagreement between sources";
    else line = "Significant disagreement between sources";
    if (nSources === 1 && totalProviders > 1) {
        line = `${line}. Single forecast source in this window.`;
    }
    return line;
}
