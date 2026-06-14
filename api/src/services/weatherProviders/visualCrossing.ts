/**
 * Visual Crossing Timeline Weather API
 * https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/
 */

const BASE =
    "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";

export interface VisualCrossingHour {
    datetime: string;
    temp?: number;
    windspeed?: number;
    windgust?: number;
    winddir?: number;
    precipprob?: number;
    precip?: number;
}

export interface VisualCrossingDay {
    datetime: string;
    hours?: VisualCrossingHour[];
}

export interface VisualCrossingCurrentConditions {
    datetime?: string;
    datetimeEpoch?: number;
    temp?: number;
    windspeed?: number;
    windgust?: number;
    winddir?: number;
    precipprob?: number;
    precip?: number;
}

export interface VisualCrossingResponse {
    days?: VisualCrossingDay[];
    currentConditions?: VisualCrossingCurrentConditions;
    latitude?: number;
    longitude?: number;
    timezone?: string;
}

function toMs(dateStr: string): number {
    return new Date(dateStr).getTime();
}

function hourKey(dateStr: string): number {
    return Math.floor(toMs(dateStr) / 3600e3);
}

function currentConditionTime(data: VisualCrossingResponse): string | null {
    const current = data.currentConditions;
    if (!current) return null;
    if (current.datetime?.includes("T")) return current.datetime;
    const day = data.days?.[0]?.datetime ?? (
        current.datetimeEpoch ? new Date(current.datetimeEpoch * 1000).toISOString().slice(0, 10) : null
    );
    if (!day) return null;
    const time = current.datetime ?? "00:00:00";
    return `${day}T${time.length === 5 ? `${time}:00` : time}`;
}

function upsertHourlySample(
    time: string[],
    wind_speed_10m: number[],
    wind_gusts_10m: number[],
    wind_direction_10m: number[],
    temperature_2m: number[],
    precipitation_probability: number[],
    sample: { time: string; temp: number; wind: number; gust: number; windDir: number; precipPct: number }
): void {
    const key = hourKey(sample.time);
    const existing = time.findIndex((t) => hourKey(t) === key);
    const i = existing >= 0 ? existing : time.length;
    time[i] = sample.time;
    temperature_2m[i] = sample.temp;
    wind_speed_10m[i] = sample.wind;
    wind_gusts_10m[i] = sample.gust;
    wind_direction_10m[i] = sample.windDir;
    precipitation_probability[i] = sample.precipPct;
}

/** Normalize to Open-Meteo-like hourly format for consistent consumption */
export function normalizeVisualCrossingToHourly(
    data: VisualCrossingResponse
): Record<string, unknown> {
    const time: string[] = [];
    const wind_speed_10m: number[] = [];
    const wind_gusts_10m: number[] = [];
    const wind_direction_10m: number[] = [];
    const temperature_2m: number[] = [];
    const precipitation_probability: number[] = [];

    const days = data.days ?? [];
    for (const day of days) {
        const dayDate = day.datetime;
        const hours = day.hours ?? [];
        for (const h of hours) {
            const hourTime = h.datetime;
            const speed = h.windspeed ?? 0;
            upsertHourlySample(
                time,
                wind_speed_10m,
                wind_gusts_10m,
                wind_direction_10m,
                temperature_2m,
                precipitation_probability,
                {
                    time: `${dayDate}T${hourTime}`,
                    temp: h.temp ?? 0,
                    wind: speed,
                    gust: h.windgust ?? speed,
                    windDir: h.winddir ?? 0,
                    precipPct: h.precipprob ?? ((h.precip ?? 0) > 0 ? 100 : 0),
                }
            );
        }
    }

    const currentTime = currentConditionTime(data);
    if (currentTime && data.currentConditions) {
        const current = data.currentConditions;
        const speed = current.windspeed ?? 0;
        upsertHourlySample(
            time,
            wind_speed_10m,
            wind_gusts_10m,
            wind_direction_10m,
            temperature_2m,
            precipitation_probability,
            {
                time: currentTime,
                temp: current.temp ?? 0,
                wind: speed,
                gust: current.windgust ?? speed,
                windDir: current.winddir ?? 0,
                precipPct: current.precipprob ?? ((current.precip ?? 0) > 0 ? 100 : 0),
            }
        );
    }

    const indices = time.map((_, i) => i).sort((a, b) => hourKey(time[a]) - hourKey(time[b]));
    const reorder = <T>(arr: T[]) => indices.map((i) => arr[i]);

    return {
        latitude: data.latitude,
        longitude: data.longitude,
        timezone: data.timezone,
        hourly: {
            time: reorder(time),
            wind_speed_10m: reorder(wind_speed_10m),
            wind_gusts_10m: reorder(wind_gusts_10m),
            wind_direction_10m: reorder(wind_direction_10m),
            temperature_2m: reorder(temperature_2m),
            precipitation_probability: reorder(precipitation_probability),
        },
    };
}

export async function fetchFromVisualCrossing(
    lat: number,
    lng: number,
    days: number
): Promise<Record<string, unknown>> {
    const key = process.env.VISUALCROSSING_API_KEY;
    if (!key) {
        throw new Error("VISUALCROSSING_API_KEY is not set");
    }

    const location = `${lat},${lng}`;
    const period = days <= 1 ? "today" : days <= 7 ? "next7days" : "next15days";

    const params = new URLSearchParams({
        key,
        unitGroup: "metric",
        include: "current,hours",
        contentType: "json",
    });

    const url = `${BASE}/${encodeURIComponent(location)}/${period}?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Visual Crossing failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as VisualCrossingResponse;
    return normalizeVisualCrossingToHourly(data);
}
