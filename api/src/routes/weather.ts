/**
 * Weather API - uses cache to avoid hitting free providers on every request.
 * Cache: TTL + spatial radius (reuse data for nearby coordinates).
 */
import type { Request, Response } from "express";
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { checkWgrib2 } from "../services/grib2.js";
import { getCachedWeather, setCachedWeather } from "../services/weatherCache.js";
import { fetchFromProvider } from "../services/weatherFetch.js";
import { fetchFromEcGeomet } from "../services/weatherProviders/ecGeomet.js";
import { fetchFromMetNorway } from "../services/weatherProviders/metNorway.js";
import { fetchFromMeteosource } from "../services/weatherProviders/meteosource.js";
import { fetchFromNoaaGfs } from "../services/weatherProviders/noaaGfs.js";
import { fetchFromOpenWeather } from "../services/weatherProviders/openweather.js";
import { fetchFromVisualCrossing } from "../services/weatherProviders/visualCrossing.js";
import { recordApiCall } from "../services/apiCallCounter.js";

const router = Router();

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

async function fetchFromOpenMeteoLocal(lat: number, lng: number, days: number): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        hourly: "wind_speed_10m,wind_gusts_10m,temperature_2m,precipitation_probability",
        forecast_days: days.toString(),
        timezone: "auto",
        windspeed_unit: "kmh",
    });
    const res = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`);
    if (!res.ok) throw new Error(`Open-Meteo failed: ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
}

async function fetchFromProviderFull(
    provider: string,
    lat: number,
    lng: number,
    days: number
): Promise<Record<string, unknown>> {
    switch (provider) {
        case "meteosource":
            return fetchFromMeteosource(lat, lng, days);
        case "ec-geomet":
            return fetchFromEcGeomet(lat, lng, days);
        case "met-norway":
            return fetchFromMetNorway(lat, lng, days);
        case "noaa-gfs":
            return fetchFromNoaaGfs(lat, lng, days);
        case "openweather":
            return fetchFromOpenWeather(lat, lng, days);
        case "visualcrossing":
            return fetchFromVisualCrossing(lat, lng, days);
        case "open-meteo":
        default:
            return fetchFromOpenMeteoLocal(lat, lng, days);
    }
}

/**
 * GET /weather?lat=46.5&lng=-71.5&days=7
 * Returns hourly forecast. Uses cache when data is fresh and point is within radius.
 */
router.get("/", authMiddleware, async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const days = Math.min(16, Math.max(1, parseInt(req.query.days as string, 10) || 7));
    const heightsRaw = req.query.heights as string | undefined;
    const heights = heightsRaw
        ? heightsRaw.split(",").map((h) => h.trim()).filter(Boolean)
        : ["ground"];
    const provider = (req.query.provider as string) || "open-meteo";
    const hoursAhead = days * 24;

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Valid lat and lng required" });
    }

    const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";

    try {
        if (!forceRefresh) {
            const cached = await getCachedWeather({
                provider,
                lat,
                lng,
                forecastType: "hourly",
                hoursAhead,
            });

            if (cached) {
                return res.json({
                    ...cached.data,
                    _provider: provider,
                    _cached: true,
                    _fetchedAt: cached.fetchedAt,
                    _sourceLat: cached.sourceLat,
                    _sourceLng: cached.sourceLng,
                    _heights: heights,
                });
            }
        }

        recordApiCall(provider);
        const data = await fetchFromProviderFull(provider, lat, lng, days);
        await setCachedWeather(
            { provider, lat, lng, forecastType: "hourly", hoursAhead },
            data
        );

        return res.json({
            ...data,
            _provider: provider,
            _cached: false,
            _fetchedAt: new Date().toISOString(),
            _heights: heights,
        });
    } catch (err) {
        console.error("Weather fetch error:", err);
        return res.status(502).json({
            error: err instanceof Error ? err.message : "Weather fetch failed",
        });
    }
});

/**
 * GET /weather/wgrib2 — Check if wgrib2 is installed (needed for ec-geomet, noaa-gfs)
 */
router.get("/wgrib2", authMiddleware, async (_req: Request, res: Response) => {
    const available = await checkWgrib2();
    return res.json({ available });
});

export const weatherRoutes = router;
