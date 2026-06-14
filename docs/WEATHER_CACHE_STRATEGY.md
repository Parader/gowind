# Weather API Cache Strategy

Free weather APIs (Open-Meteo, etc.) have rate limits. We cache responses to:
1. Avoid hitting APIs on every load
2. Reduce latency for repeat requests
3. Stay within free-tier limits

## Principles

### 1. TTL (Time-to-Live)
- **Hourly forecasts**: 1 hour — Open-Meteo updates ~hourly
- **Daily forecasts**: 3–6 hours
- **Current conditions**: 15–30 minutes

Data is considered stale after TTL and triggers a fresh fetch.

### 2. Spatial Reuse
Weather is similar for nearby points. If we have cached data for (lat, lng), we reuse it for requests within a **radius**:

- **Default radius**: 1 km — per location
- **Configurable per provider** — radius, TTL, and daily limit

We use the Haversine formula to compute distance between the requested point and cached points.

### 3. Cache Key
`{ provider, lat, lng, forecastType, hoursAhead }` — but for spatial lookup we find the nearest cached entry within radius and check TTL.

### 4. Storage
- **Server-side** (MongoDB) — shared across all users, one fetch serves many
- Each cache entry stores: `lat`, `lng`, `provider`, `forecastType`, `data`, `fetchedAt`

## Flow

```
Request (lat, lng, provider, forecastType)
    → Find cached entry within radius, not stale
    → If hit: return cached data
    → If miss: fetch from API, store in cache, return
```

## API

**GET /weather?lat=46.5&lng=-71.5&days=3** (auth required)

- Returns Open-Meteo hourly forecast
- Uses cache: reuse if point within 1km and data &lt; 1h old
- Response includes `_cached`, `_fetchedAt`, `_sourceLat`, `_sourceLng` when from cache

## Configuration

Global defaults (overridable per provider):

| Setting                | Default | Description                            |
|------------------------|---------|----------------------------------------|
| `WEATHER_CACHE_TTL_MS` | 3600000 | 1 hour per location                    |
| `WEATHER_CACHE_RADIUS_KM` | 1     | Reuse data within this distance (km)   |
| `WEATHER_MAX_CACHE_ENTRIES` | 500 | Evict oldest when exceeded         |

**Per-provider overrides** (e.g. Open-Meteo, WeatherAPI):

| Pattern                         | Example | Description                        |
|---------------------------------|---------|------------------------------------|
| `WEATHER_<PROVIDER>_RADIUS_KM`  | `WEATHER_OPENMETEO_RADIUS_KM=1` | Radius for that provider      |
| `WEATHER_<PROVIDER>_TTL_MS`     | `WEATHER_WEATHERAPI_TTL_MS=3600000` | TTL for that provider       |
| `WEATHER_<PROVIDER>_LIMIT_DAILY` | `WEATHER_WEATHERAPI_LIMIT_DAILY=1000` | Daily API limit (empty = unlimited) |

Provider names use underscores (e.g. `OPENMETEO`, `WEATHERAPI`). Limits are for awareness and future rate limiting; cache reduces API calls.
