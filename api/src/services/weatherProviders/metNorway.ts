/**
 * MET Norway Locationforecast 2.0
 * https://docs.api.met.no/doc/locationforecast/datamodel
 *
 * Free, no API key. Requires User-Agent with contact info (email or URL).
 * Nordic/Arctic: 1h steps 0–60h, then 6h to 10d. Rest of world: 6h steps.
 * Wind in m/s; we convert to km/h.
 */

const BASE = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

interface MetNorwayInstant {
    air_temperature?: number;
    wind_speed?: number;
    wind_speed_of_gust?: number;
    wind_speed_percentile_90?: number;
}

interface MetNorwayPeriod {
    details?: { probability_of_precipitation?: number };
}

interface MetNorwayTimeseriesItem {
    time: string;
    data: {
        instant?: { details?: MetNorwayInstant };
        next_1_hours?: MetNorwayPeriod;
        next_6_hours?: MetNorwayPeriod;
        next_12_hours?: MetNorwayPeriod;
    };
}

interface MetNorwayResponse {
    properties?: {
        timeseries?: MetNorwayTimeseriesItem[];
        meta?: { units?: Record<string, string> };
    };
    geometry?: { coordinates?: [number, number, number] };
}

function getUserAgent(): string {
    const ua = process.env.MET_NORWAY_USER_AGENT;
    if (ua?.trim()) return ua.trim();
    return "TempestWeather/1.0 (https://github.com)";
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Retries on transient undici/Node socket errors (e.g. remote closes mid-response). */
function isTransientFetchFailure(err: unknown): boolean {
    if (!(err instanceof TypeError) || err.message !== "fetch failed") return false;
    const cause = (err as Error & { cause?: unknown }).cause;
    if (!cause || typeof cause !== "object") return true;
    const code = (cause as { code?: string }).code;
    return (
        code === "UND_ERR_SOCKET" ||
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "UND_ERR_CONNECT_TIMEOUT"
    );
}

/** Round coords to 4 decimals (MET API requirement). */
function roundCoord(n: number): number {
    return Math.round(n * 10000) / 10000;
}

/** Normalize to Open-Meteo-like hourly format. Expands 6h steps to 6 hourly slots. */
export function normalizeMetNorwayToHourly(
    data: MetNorwayResponse,
    requestLat: number,
    requestLng: number,
    days: number
): Record<string, unknown> {
    const time: string[] = [];
    const wind_speed_10m: number[] = [];
    const wind_gusts_10m: number[] = [];
    const temperature_2m: number[] = [];
    const precipitation_probability: number[] = [];

    const items = data.properties?.timeseries ?? [];
    const targetHours = Math.min(168, days * 24);
    const now = Date.now();
    let count = 0;

    for (let i = 0; i < items.length && count < targetHours; i++) {
        const item = items[i];
        const nextItem = items[i + 1];
        const ts = new Date(item.time).getTime();
        if (ts < now) continue;

        const instant = item.data.instant?.details;
        const temp = instant?.air_temperature ?? 0;
        const speedMs = instant?.wind_speed ?? 0;
        // wind_speed_of_gust often missing for global/long-term; use percentile_90 or ~1.25× speed
        const gustMs =
            instant?.wind_speed_of_gust ??
            instant?.wind_speed_percentile_90 ??
            (speedMs > 0 ? speedMs * 1.25 : speedMs);
        const speedKmh = speedMs * 3.6;
        const gustKmh = gustMs * 3.6;

        const nextInstant = nextItem?.data?.instant?.details;
        const nextTemp = nextInstant?.air_temperature ?? temp;
        const nextSpeedMs = nextInstant?.wind_speed ?? speedMs;
        const nextGustMs =
            nextInstant?.wind_speed_of_gust ??
            nextInstant?.wind_speed_percentile_90 ??
            (nextSpeedMs > 0 ? nextSpeedMs * 1.25 : nextSpeedMs);
        const nextSpeedKmh = nextSpeedMs * 3.6;
        const nextGustKmh = nextGustMs * 3.6;

        const precipProb =
            item.data.next_1_hours?.details?.probability_of_precipitation ??
            item.data.next_6_hours?.details?.probability_of_precipitation ??
            item.data.next_12_hours?.details?.probability_of_precipitation ??
            0;

        const steps = nextItem
            ? Math.max(1, Math.round((new Date(nextItem.time).getTime() - ts) / (60 * 60 * 1000)))
            : 1;

        for (let s = 0; s < steps && count < targetHours; s++) {
            const t = new Date(ts + s * 60 * 60 * 1000);
            time.push(t.toISOString().slice(0, 19));
            const frac = steps > 1 ? s / (steps - 1) : 0;
            temperature_2m.push(temp + (nextTemp - temp) * frac);
            wind_speed_10m.push(speedKmh + (nextSpeedKmh - speedKmh) * frac);
            wind_gusts_10m.push(gustKmh + (nextGustKmh - gustKmh) * frac);
            precipitation_probability.push(precipProb);
            count++;
        }
    }

    const coords = data.geometry?.coordinates;
    return {
        latitude: coords?.[1] ?? requestLat,
        longitude: coords?.[0] ?? requestLng,
        timezone: "UTC",
        hourly: {
            time,
            wind_speed_10m,
            wind_gusts_10m,
            temperature_2m,
            precipitation_probability,
        },
    };
}

export async function fetchFromMetNorway(
    lat: number,
    lng: number,
    days: number
): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
        lat: String(roundCoord(lat)),
        lon: String(roundCoord(lng)),
    });
    const url = `${BASE}?${params.toString()}`;
    const headers = {
        "User-Agent": getUserAgent(),
        Accept: "application/json",
    };

    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await fetch(url, { headers });

            if (!res.ok) {
                const text = await res.text();
                if (res.status === 403) {
                    throw new Error(
                        "MET Norway: User-Agent required. Set MET_NORWAY_USER_AGENT with contact email or URL."
                    );
                }
                throw new Error(`MET Norway failed: ${res.status} ${text.slice(0, 200)}`);
            }

            const data = (await res.json()) as MetNorwayResponse;
            return normalizeMetNorwayToHourly(data, lat, lng, days);
        } catch (err) {
            lastErr = err;
            if (attempt === maxAttempts || !isTransientFetchFailure(err)) throw err;
            await sleep(400 * 2 ** (attempt - 1));
        }
    }
    throw lastErr;
}
