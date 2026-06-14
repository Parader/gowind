/**
 * Meteosource Weather API - Point forecast
 * https://www.meteosource.com/documentation
 *
 * Free tier: 400 calls/day. Hourly forecast is limited (typically 12–24h depending on tier).
 * Paid tiers offer up to 7 days hourly. We request both hourly and daily; if hourly is
 * shorter than requested days, we expand daily data into hourly slots to reach 7 days.
 */

const BASE = "https://www.meteosource.com/api/v1/free/point";

export interface MeteosourceHourlyItem {
    date: string;
    temperature?: number;
    wind?: { speed?: number; gusts?: number; dir?: string; angle?: number };
    precipitation?: { total?: number; type?: string; probability?: number };
}

export interface MeteosourceDailyItem {
    day: string;
    all_day?: {
        temperature?: number;
        temperature_min?: number;
        temperature_max?: number;
        wind?: { speed?: number; gusts?: number; dir?: string; angle?: number };
        precipitation?: { total?: number; type?: string; probability?: number };
    };
    morning?: { temperature?: number; wind?: { speed?: number; gusts?: number }; precipitation?: { total?: number; probability?: number } } | null;
    afternoon?: { temperature?: number; wind?: { speed?: number; gusts?: number }; precipitation?: { total?: number; probability?: number } } | null;
    evening?: { temperature?: number; wind?: { speed?: number; gusts?: number }; precipitation?: { total?: number; probability?: number } } | null;
}

export interface MeteosourceCurrent {
    temperature?: number;
    wind?: { speed?: number; gusts?: number; dir?: string; angle?: number };
    precipitation?: { total?: number; type?: string; probability?: number };
}

export interface MeteosourceResponse {
    lat?: string;
    lon?: string;
    timezone?: string;
    current?: MeteosourceCurrent;
    hourly?: { data?: MeteosourceHourlyItem[] };
    daily?: { data?: MeteosourceDailyItem[] };
}

function parseLatLon(latStr?: string, lonStr?: string): { lat?: number; lon?: number } {
    if (!latStr || !lonStr) return {};
    const parse = (s: string): number | undefined => {
        const m = s.match(/^([+-]?\d+(?:\.\d+)?)\s*([NSEW])?$/i);
        if (!m) return undefined;
        let v = parseFloat(m[1]);
        if (m[2] && ["S", "W"].includes(m[2].toUpperCase())) v = -v;
        return v;
    };
    return { lat: parse(latStr), lon: parse(lonStr) };
}

function toMs(dateStr: string): number {
    return new Date(dateStr).getTime();
}

function hourKey(dateStr: string): number {
    return Math.floor(toMs(dateStr) / 3600e3);
}

function currentHourForTimezone(timezone?: string): string {
    const timeZone = timezone?.trim() || "UTC";
    try {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).formatToParts(new Date());
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
        const hour = get("hour") === "24" ? "00" : get("hour");
        return `${get("year")}-${get("month")}-${get("day")}T${hour}:00:00`;
    } catch {
        return new Date().toISOString().slice(0, 13) + ":00:00";
    }
}

function upsertHourlySample(
    time: string[],
    wind_speed_10m: number[],
    wind_gusts_10m: number[],
    temperature_2m: number[],
    precipitation_probability: number[],
    sample: { time: string; temperature: number; speedMs: number; gustsMs: number; precipPct: number }
): void {
    const key = hourKey(sample.time);
    const existing = time.findIndex((t) => hourKey(t) === key);
    const i = existing >= 0 ? existing : time.length;
    time[i] = sample.time;
    temperature_2m[i] = sample.temperature;
    wind_speed_10m[i] = sample.speedMs * 3.6;
    wind_gusts_10m[i] = sample.gustsMs * 3.6;
    precipitation_probability[i] = sample.precipPct;
}

/** Normalize to Open-Meteo-like hourly format. Meteosource uses m/s for wind; convert to km/h.
 * If hourly data is shorter than requested days, expands daily data into hourly slots up to 7 days. */
export function normalizeMeteosourceToHourly(
    data: MeteosourceResponse,
    requestLat: number,
    requestLng: number,
    days: number = 7
): Record<string, unknown> {
    const time: string[] = [];
    const wind_speed_10m: number[] = [];
    const wind_gusts_10m: number[] = [];
    const temperature_2m: number[] = [];
    const precipitation_probability: number[] = [];

    const hourlyItems = data.hourly?.data ?? [];
    const dailyItems = data.daily?.data ?? [];
    const targetHours = Math.min(168, days * 24);

    // Add all hourly data
    for (const h of hourlyItems) {
        time.push(h.date);
        temperature_2m.push(h.temperature ?? 0);
        const speedMs = h.wind?.speed ?? 0;
        const gustsMs = h.wind?.gusts ?? speedMs;
        wind_speed_10m.push(speedMs * 3.6);
        wind_gusts_10m.push(gustsMs * 3.6);
        const prob = h.precipitation?.probability;
        const hasPrecip = (h.precipitation?.total ?? 0) > 0;
        precipitation_probability.push(prob ?? (hasPrecip ? 100 : 0));
    }

    if (data.current) {
        const speedMs = data.current.wind?.speed ?? 0;
        const hasPrecip = (data.current.precipitation?.total ?? 0) > 0;
        upsertHourlySample(time, wind_speed_10m, wind_gusts_10m, temperature_2m, precipitation_probability, {
            time: currentHourForTimezone(data.timezone),
            temperature: data.current.temperature ?? 0,
            speedMs,
            gustsMs: data.current.wind?.gusts ?? speedMs,
            precipPct: data.current.precipitation?.probability ?? (hasPrecip ? 100 : 0),
        });
    }

    // Fill remaining hours from daily if we have gaps (avoids overlap with hourly)
    const seen = new Set(time);
    const now = Date.now();
    if (time.length < targetHours && dailyItems.length > 0) {
        for (const d of dailyItems) {
            if (!d.day || !d.all_day || time.length >= targetHours) continue;

            const temp = d.all_day.temperature ?? 0;
            const speedMs = d.all_day.wind?.speed ?? 0;
            const gustsMs = d.all_day.wind?.gusts ?? speedMs;
            const speedKph = speedMs * 3.6;
            const gustsKph = gustsMs * 3.6;
            const prob = d.all_day.precipitation?.probability ?? (d.all_day.precipitation?.total && d.all_day.precipitation.total > 0 ? 100 : 0);

            for (let h = 0; h < 24 && time.length < targetHours; h++) {
                const hourStr = h.toString().padStart(2, "0");
                const dateStr = `${d.day}T${hourStr}:00:00`;
                const ts = toMs(dateStr);
                if (ts < now || seen.has(dateStr)) continue;
                seen.add(dateStr);
                time.push(dateStr);
                temperature_2m.push(temp);
                wind_speed_10m.push(speedKph);
                wind_gusts_10m.push(gustsKph);
                precipitation_probability.push(prob);
            }
        }
        // Sort so expanded daily slots are interleaved correctly with any existing hourly
        const indices = time.map((_, i) => i);
        indices.sort((a, b) => toMs(time[a]) - toMs(time[b]));
        const reorder = <T>(arr: T[]) => indices.map((i) => arr[i]);
        const sortedTime = reorder(time);
        time.length = 0;
        time.push(...sortedTime);
        const sortedWindSpeed = reorder(wind_speed_10m);
        wind_speed_10m.length = 0;
        wind_speed_10m.push(...sortedWindSpeed);
        const sortedWindGusts = reorder(wind_gusts_10m);
        wind_gusts_10m.length = 0;
        wind_gusts_10m.push(...sortedWindGusts);
        const sortedTemp = reorder(temperature_2m);
        temperature_2m.length = 0;
        temperature_2m.push(...sortedTemp);
        const sortedProb = reorder(precipitation_probability);
        precipitation_probability.length = 0;
        precipitation_probability.push(...sortedProb);
    }

    const { lat, lon } = parseLatLon(data.lat, data.lon);
    const finalIndices = time.map((_, i) => i).sort((a, b) => toMs(time[a]) - toMs(time[b]));
    const finalReorder = <T>(arr: T[]) => finalIndices.map((i) => arr[i]);

    return {
        latitude: lat ?? requestLat,
        longitude: lon ?? requestLng,
        timezone: data.timezone ?? "auto",
        hourly: {
            time: finalReorder(time),
            wind_speed_10m: finalReorder(wind_speed_10m),
            wind_gusts_10m: finalReorder(wind_gusts_10m),
            temperature_2m: finalReorder(temperature_2m),
            precipitation_probability: finalReorder(precipitation_probability),
        },
    };
}

export async function fetchFromMeteosource(
    lat: number,
    lng: number,
    days: number
): Promise<Record<string, unknown>> {
    const key = process.env.METEOSOURCE_API_KEY;
    if (!key) {
        throw new Error("METEOSOURCE_API_KEY is not set");
    }

    const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        sections: "current,hourly,daily",
        timezone: "auto",
        units: "metric",
        key,
    });

    const url = `${BASE}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Meteosource failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as MeteosourceResponse;
    return normalizeMeteosourceToHourly(data, lat, lng, days);
}
