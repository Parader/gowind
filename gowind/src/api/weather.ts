import { apiFetch } from "./client.js";
import type { WeatherHeightFt } from "@/types/setup";

export interface WeatherResponse {
    hourly?: {
        time?: string[];
        wind_speed_10m?: number[];
        wind_gusts_10m?: number[];
        temperature_2m?: number[];
        precipitation_probability?: number[];
    };
    _provider: string;
    _cached: boolean;
    _fetchedAt: string;
    _sourceLat?: number;
    _sourceLng?: number;
}

export async function getWeather(
    lat: number,
    lng: number,
    days = 7,
    heights?: WeatherHeightFt[],
    options?: { refresh?: boolean; provider?: string }
): Promise<WeatherResponse> {
    const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        days: days.toString(),
    });
    if (heights?.length) {
        params.set("heights", heights.join(","));
    }
    if (options?.refresh) {
        params.set("refresh", "1");
    }
    if (options?.provider) {
        params.set("provider", options.provider);
    }
    return apiFetch(`/weather?${params.toString()}`);
}

/** Check if wgrib2 is available (needed for ec-geomet, noaa-gfs) */
export async function checkWgrib2(): Promise<boolean> {
    try {
        const data = (await apiFetch("/weather/wgrib2")) as { available?: boolean };
        return data.available === true;
    } catch {
        return false;
    }
}
