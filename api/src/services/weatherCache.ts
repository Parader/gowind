/**
 * Weather cache service: avoid hitting free APIs on every request.
 * Reuses data within a radius (spatial) and only fetches when stale (TTL).
 * Per-provider config: radius, TTL, and daily limit awareness.
 */

import { WeatherCache } from "../models/WeatherCache.js";
import { getProviderConfig } from "../config/weatherProviders.js";

const MAX_CACHE_ENTRIES = Number(process.env.WEATHER_MAX_CACHE_ENTRIES) || 500;

/** Haversine distance in km between two points */
function haversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export interface WeatherCacheLookup {
    provider: string;
    lat: number;
    lng: number;
    forecastType: string;
    hoursAhead?: number;
}

export interface WeatherCacheEntry {
    data: Record<string, unknown>;
    fetchedAt: Date;
    sourceLat: number;
    sourceLng: number;
}

/**
 * Find a valid cached entry within radius. Returns null if none found or all stale.
 * Uses per-provider radius and TTL.
 */
export async function getCachedWeather(
    lookup: WeatherCacheLookup
): Promise<WeatherCacheEntry | null> {
    const { provider, lat, lng, forecastType, hoursAhead } = lookup;
    const config = getProviderConfig(provider);
    const now = Date.now();
    const staleBefore = new Date(now - config.ttlMs);

    const hoursFilter =
        hoursAhead != null
            ? { hoursAhead }
            : { $or: [{ hoursAhead: null }, { hoursAhead: { $exists: false } }] };

    const latDelta = config.radiusKm / 111; // ~111km per degree lat
    const lngDelta = config.radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    const candidates = await WeatherCache.find({
        provider,
        forecastType,
        fetchedAt: { $gte: staleBefore },
        lat: { $gte: lat - latDelta, $lte: lat + latDelta },
        lng: { $gte: lng - lngDelta, $lte: lng + lngDelta },
        ...hoursFilter,
    })
        .sort({ fetchedAt: -1 })
        .limit(50)
        .lean();

    for (const doc of candidates) {
        const dist = haversineKm(lat, lng, doc.lat, doc.lng);
        if (dist <= config.radiusKm) {
            return {
                data: doc.data as Record<string, unknown>,
                fetchedAt: doc.fetchedAt,
                sourceLat: doc.lat,
                sourceLng: doc.lng,
            };
        }
    }
    return null;
}

/**
 * Store a weather response in the cache.
 */
export async function setCachedWeather(
    lookup: WeatherCacheLookup,
    data: Record<string, unknown>
): Promise<void> {
    const count = await WeatherCache.countDocuments();
    if (count >= MAX_CACHE_ENTRIES) {
        const oldest = await WeatherCache.findOne().sort({ fetchedAt: 1 });
        if (oldest) await WeatherCache.deleteOne({ _id: oldest._id });
    }

    const filter: Record<string, unknown> = {
        provider: lookup.provider,
        lat: lookup.lat,
        lng: lookup.lng,
        forecastType: lookup.forecastType,
    };
    if (lookup.hoursAhead != null) filter.hoursAhead = lookup.hoursAhead;

    await WeatherCache.findOneAndUpdate(
        filter,
        {
            $set: {
                data,
                fetchedAt: new Date(),
            },
        },
        { upsert: true, new: true }
    );
}

export function getCacheConfig(provider = "open-meteo") {
    const config = getProviderConfig(provider);
    return {
        ttlMs: config.ttlMs,
        radiusKm: config.radiusKm,
        limitDaily: config.limitDaily,
        maxEntries: MAX_CACHE_ENTRIES,
    };
}
