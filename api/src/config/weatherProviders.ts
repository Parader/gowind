/**
 * Per-provider weather cache configuration.
 * Some providers have daily rate limits (e.g. 1000/day), others are unlimited.
 * Radius and TTL are per provider so we can tune for each API's constraints.
 */

export interface WeatherProviderConfig {
    /** Cache radius in km — reuse data for points within this distance (default 1) */
    radiusKm: number;
    /** TTL in ms — data is stale after this (default 1 hour) */
    ttlMs: number;
    /** Daily request limit — null = unlimited (for awareness / future rate limiting) */
    limitDaily: number | null;
}

const DEFAULT_RADIUS_KM = 1;
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function readNum(env: string | undefined, def: number): number {
    if (!env) return def;
    const n = Number(env);
    return Number.isNaN(n) ? def : n;
}

function readLimit(env: string | undefined): number | null {
    if (!env || env.trim() === "") return null;
    const n = parseInt(env, 10);
    return Number.isNaN(n) ? null : n;
}

function providerKey(name: string): string {
    return name.toUpperCase().replace(/-/g, "_");
}

/**
 * Get config for a provider. Uses env overrides:
 * - WEATHER_<PROVIDER>_RADIUS_KM
 * - WEATHER_<PROVIDER>_TTL_MS
 * - WEATHER_<PROVIDER>_LIMIT_DAILY (empty = unlimited)
 */
export function getProviderConfig(provider: string): WeatherProviderConfig {
    const key = providerKey(provider);
    const limitEnv = process.env[`WEATHER_${key}_LIMIT_DAILY`];
    const limitDaily =
        limitEnv !== undefined
            ? readLimit(limitEnv) // explicit: "" = unlimited, "1000" = 1000
            : (PROVIDER_DEFAULTS[provider]?.limitDaily ?? null);

    return {
        radiusKm: readNum(
            process.env[`WEATHER_${key}_RADIUS_KM`] ?? process.env.WEATHER_CACHE_RADIUS_KM,
            PROVIDER_DEFAULTS[provider]?.radiusKm ?? DEFAULT_RADIUS_KM
        ),
        ttlMs: readNum(
            process.env[`WEATHER_${key}_TTL_MS`] ?? process.env.WEATHER_CACHE_TTL_MS,
            PROVIDER_DEFAULTS[provider]?.ttlMs ?? DEFAULT_TTL_MS
        ),
        limitDaily,
    };
}

/** Known providers with typical limits (for reference) */
export const PROVIDER_DEFAULTS: Record<string, WeatherProviderConfig> = {
    "open-meteo": {
        radiusKm: 1,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: null, // no hard limit
    },
    weatherapi: {
        radiusKm: 1,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: 1000, // free tier ~1k/day
    },
    meteosource: {
        radiusKm: 1,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: 400, // free tier: 400 calls/day, ~12–24h hourly data
    },
    openweather: {
        radiusKm: 1,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: 1000, // free tier ~1k/day
    },
    visualcrossing: {
        radiusKm: 1,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: 1000,
    },
    "ec-geomet": {
        radiusKm: 5,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: null, // free, no key; cache aggressively (many GRIB fetches per request)
    },
    "met-norway": {
        radiusKm: 1,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: null, // free, User-Agent required; stay under 20 req/s
    },
    "noaa-gfs": {
        radiusKm: 5,
        ttlMs: DEFAULT_TTL_MS,
        limitDaily: null, // free, wgrib2 required
    },
};
