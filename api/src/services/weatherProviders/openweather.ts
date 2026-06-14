/**
 * OpenWeather current + short-range forecast APIs.
 * Prefer One Call 3.0 for hourly 0-48h coverage; fall back to Current Weather + Forecast5.
 * https://openweathermap.org/api/one-call-3
 * https://openweathermap.org/current
 * https://openweathermap.org/forecast5
 */

const FORECAST_BASE = "https://api.openweathermap.org/data/2.5/forecast";
const CURRENT_BASE = "https://api.openweathermap.org/data/2.5/weather";
const ONE_CALL_BASE = "https://api.openweathermap.org/data/3.0/onecall";

export interface OpenWeatherListItem {
    dt: number;
    main?: { temp?: number };
    wind?: { speed?: number; gust?: number; deg?: number };
    pop?: number; // probability of precipitation 0–1
}

export interface OpenWeatherResponse {
    list?: OpenWeatherListItem[];
    city?: { coord?: { lat?: number; lon?: number }; timezone?: number };
}

export interface OpenWeatherCurrentResponse {
    dt?: number;
    coord?: { lat?: number; lon?: number };
    main?: { temp?: number };
    wind?: { speed?: number; gust?: number; deg?: number };
}

export interface OpenWeatherOneCallItem {
    dt: number;
    temp?: number;
    wind_speed?: number;
    wind_gust?: number;
    wind_deg?: number;
    pop?: number;
}

export interface OpenWeatherOneCallResponse {
    lat?: number;
    lon?: number;
    timezone?: string;
    current?: OpenWeatherOneCallItem;
    hourly?: OpenWeatherOneCallItem[];
}

interface OpenWeatherErrorBody {
    cod?: number | string;
    message?: string;
}

interface HourlyArrays {
    time: string[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    wind_direction_10m: number[];
    temperature_2m: number[];
    precipitation_probability: number[];
}

interface HourlySample {
    time: string;
    temperature: number;
    windSpeedMs: number;
    windGustMs: number;
    windDeg: number;
    precipProbability: number;
}

function unixToIso(dt: number): string {
    return new Date(dt * 1000).toISOString();
}

function hourKey(time: string): number {
    const t = new Date(time).getTime();
    return Math.floor(t / 3600e3) * 3600e3;
}

function upsertSample(arrays: HourlyArrays, sample: HourlySample): void {
    const key = hourKey(sample.time);
    const existing = arrays.time.findIndex((t) => hourKey(t) === key);
    const i = existing >= 0 ? existing : arrays.time.length;
    arrays.time[i] = sample.time;
    arrays.temperature_2m[i] = sample.temperature;
    arrays.wind_speed_10m[i] = sample.windSpeedMs * 3.6;
    arrays.wind_gusts_10m[i] = sample.windGustMs * 3.6;
    arrays.wind_direction_10m[i] = sample.windDeg;
    arrays.precipitation_probability[i] = sample.precipProbability;
}

function sortArrays(arrays: HourlyArrays): void {
    const indices = arrays.time.map((_, i) => i).sort((a, b) => hourKey(arrays.time[a]) - hourKey(arrays.time[b]));
    const reorder = <T>(arr: T[]) => indices.map((i) => arr[i]);
    arrays.time = reorder(arrays.time);
    arrays.wind_speed_10m = reorder(arrays.wind_speed_10m);
    arrays.wind_gusts_10m = reorder(arrays.wind_gusts_10m);
    arrays.wind_direction_10m = reorder(arrays.wind_direction_10m);
    arrays.temperature_2m = reorder(arrays.temperature_2m);
    arrays.precipitation_probability = reorder(arrays.precipitation_probability);
}

function emptyArrays(): HourlyArrays {
    return {
        time: [],
        wind_speed_10m: [],
        wind_gusts_10m: [],
        wind_direction_10m: [],
        temperature_2m: [],
        precipitation_probability: [],
    };
}

/** Normalize to Open-Meteo-like hourly format. OpenWeather uses 3h intervals and m/s for wind. */
export function normalizeOpenWeatherToHourly(
    data: OpenWeatherResponse,
    requestLat: number,
    requestLng: number,
    current?: OpenWeatherCurrentResponse
): Record<string, unknown> {
    const arrays = emptyArrays();

    if (current?.dt) {
        const speedMs = current.wind?.speed ?? 0;
        upsertSample(arrays, {
            time: unixToIso(current.dt),
            temperature: current.main?.temp ?? 0,
            windSpeedMs: speedMs,
            windGustMs: current.wind?.gust ?? speedMs,
            windDeg: current.wind?.deg ?? 0,
            precipProbability: 0,
        });
    }

    const items = data.list ?? [];
    for (const item of items) {
        const speedMs = item.wind?.speed ?? 0;
        upsertSample(arrays, {
            time: unixToIso(item.dt),
            temperature: item.main?.temp ?? 0,
            windSpeedMs: speedMs,
            windGustMs: item.wind?.gust ?? speedMs,
            windDeg: item.wind?.deg ?? 0,
            precipProbability: Math.round((item.pop ?? 0) * 100),
        });
    }
    sortArrays(arrays);

    const lat = data.city?.coord?.lat ?? current?.coord?.lat ?? requestLat;
    const lon = data.city?.coord?.lon ?? current?.coord?.lon ?? requestLng;

    return {
        latitude: lat,
        longitude: lon,
        timezone: "auto",
        hourly: arrays,
    };
}

export function normalizeOpenWeatherOneCallToHourly(
    data: OpenWeatherOneCallResponse,
    requestLat: number,
    requestLng: number,
    days: number
): Record<string, unknown> {
    const arrays = emptyArrays();
    const targetHours = Math.min(168, days * 24);

    const add = (item: OpenWeatherOneCallItem, precipProbability = 0) => {
        const speedMs = item.wind_speed ?? 0;
        upsertSample(arrays, {
            time: unixToIso(item.dt),
            temperature: item.temp ?? 0,
            windSpeedMs: speedMs,
            windGustMs: item.wind_gust ?? speedMs,
            windDeg: item.wind_deg ?? 0,
            precipProbability,
        });
    };

    if (data.current?.dt) add(data.current, 0);
    for (const item of (data.hourly ?? []).slice(0, targetHours)) {
        add(item, Math.round((item.pop ?? 0) * 100));
    }
    sortArrays(arrays);

    return {
        latitude: data.lat ?? requestLat,
        longitude: data.lon ?? requestLng,
        timezone: data.timezone ?? "auto",
        hourly: arrays,
    };
}

async function fetchJson<T>(url: string): Promise<T & OpenWeatherErrorBody> {
    const res = await fetch(url);
    const data = (await res.json()) as T & OpenWeatherErrorBody;
    if (!res.ok) {
        throw new Error(`OpenWeather failed: ${res.status} ${data.message ?? ""}`.trim());
    }
    const cod = data.cod;
    if (cod != null && cod !== 200 && cod !== "200") {
        throw new Error(`OpenWeather: ${data.message ?? `error ${cod}`}`);
    }
    return data;
}

function buildParams(lat: number, lng: number, key: string): URLSearchParams {
    return new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        units: "metric",
        appid: key,
    });
}

export async function fetchFromOpenWeather(
    lat: number,
    lng: number,
    days: number
): Promise<Record<string, unknown>> {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) {
        throw new Error("OPENWEATHER_API_KEY is not set");
    }

    const oneCallParams = buildParams(lat, lng, key);
    oneCallParams.set("exclude", "minutely,daily,alerts");
    try {
        const oneCallUrl = `${ONE_CALL_BASE}?${oneCallParams.toString()}`;
        const oneCall = await fetchJson<OpenWeatherOneCallResponse>(oneCallUrl);
        if (oneCall.current || oneCall.hourly?.length) {
            return normalizeOpenWeatherOneCallToHourly(oneCall, lat, lng, days);
        }
    } catch {
        // Some keys are not subscribed to One Call 3.0; fall back to free current + Forecast5 endpoints.
    }

    const forecastParams = buildParams(lat, lng, key);
    const currentParams = buildParams(lat, lng, key);

    const [forecastResult, currentResult] = await Promise.allSettled([
        fetchJson<OpenWeatherResponse>(`${FORECAST_BASE}?${forecastParams.toString()}`),
        fetchJson<OpenWeatherCurrentResponse>(`${CURRENT_BASE}?${currentParams.toString()}`),
    ]);

    const current = currentResult.status === "fulfilled" ? currentResult.value : undefined;
    if (forecastResult.status === "fulfilled" && forecastResult.value.list?.length) {
        return normalizeOpenWeatherToHourly(forecastResult.value, lat, lng, current);
    }

    if (current?.dt) {
        return normalizeOpenWeatherToHourly({ list: [] }, lat, lng, current);
    }

    const reason = forecastResult.status === "rejected" ? forecastResult.reason : "OpenWeather returned no forecast data";
    throw reason instanceof Error ? reason : new Error(String(reason));
}
