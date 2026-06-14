/**
 * Shared weather fetch - used by weather route and go-times service.
 */
import { fetchFromMeteosource } from "../services/weatherProviders/meteosource.js";
import { fetchFromOpenWeather } from "../services/weatherProviders/openweather.js";
import { fetchFromVisualCrossing } from "../services/weatherProviders/visualCrossing.js";
import { fetchFromMetNorway } from "../services/weatherProviders/metNorway.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

async function fetchFromOpenMeteo(
    lat: number,
    lng: number,
    days: number,
    options?: { requestMultiHeight?: boolean }
): Promise<Record<string, unknown>> {
    const hourlyVars = options?.requestMultiHeight
        ? [
              "wind_speed_10m",
              "wind_speed_80m",
              "wind_speed_120m",
              "wind_speed_180m",
              "wind_gusts_10m",
              "wind_direction_10m",
              "temperature_2m",
              "precipitation_probability",
          ].join(",")
        : "wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability";

    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        current: "wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability",
        hourly: hourlyVars,
        forecast_hours: String(Math.max(1, days * 24)),
        timezone: "auto",
        windspeed_unit: "kmh",
    });
    const res = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
}

export async function fetchFromProvider(
    provider: string,
    lat: number,
    lng: number,
    days: number,
    options?: { requestMultiHeight?: boolean }
): Promise<Record<string, unknown>> {
    switch (provider) {
        case "meteosource":
            return fetchFromMeteosource(lat, lng, days);
        case "met-norway":
            return fetchFromMetNorway(lat, lng, days);
        case "openweather":
            return fetchFromOpenWeather(lat, lng, days);
        case "visualcrossing":
            return fetchFromVisualCrossing(lat, lng, days);
        case "open-meteo":
        default:
            return fetchFromOpenMeteo(lat, lng, days, options);
    }
}

/** Maps user height (ft) to Open-Meteo wind variable. Met Norway only has 10m. */
export const HEIGHT_TO_OPEN_METEO_VAR: Record<string, string> = {
    ground: "wind_speed_10m",
    "500": "wind_speed_80m",
    "1000": "wind_speed_120m",
    "2000": "wind_speed_180m",
    "3000": "wind_speed_180m",
    "5000": "wind_speed_180m",
    "10000": "wind_speed_180m",
};

/** Base providers (no API keys required). */
const GO_TIMES_BASE_PROVIDERS = ["open-meteo", "met-norway"] as const;

/** Optional providers when API keys are configured. */
const GO_TIMES_OPTIONAL_PROVIDERS = [
    { id: "meteosource", env: "METEOSOURCE_API_KEY" },
    { id: "openweather", env: "OPENWEATHER_API_KEY" },
    { id: "visualcrossing", env: "VISUALCROSSING_API_KEY" },
] as const;

/** Providers to use for go-times. Includes optional providers when API keys are set. */
export function getGoTimesProviders(): string[] {
    const list: string[] = [...GO_TIMES_BASE_PROVIDERS];
    for (const { id, env } of GO_TIMES_OPTIONAL_PROVIDERS) {
        const key = process.env[env];
        if (key && String(key).trim()) {
            list.push(id);
        }
    }
    return list;
}

