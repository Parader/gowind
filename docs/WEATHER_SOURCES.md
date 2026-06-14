# Weather data sources

Overview of integrated and planned weather providers.

## Integrated (JSON / REST)

| Provider | Key | Limit | Notes |
|----------|-----|-------|-------|
| Open-Meteo | No | None | Primary free option, 16-day hourly |
| OpenWeather | Yes | ~1000/day | 5-day, 3h intervals |
| Meteosource | Yes | 400/day | Free: ~12h hourly, 7d via daily fallback |
| Visual Crossing | Yes | ~1000/day | 7–15 day hourly |
| EC GeoMet (GDPS) | No | None | Datamart GRIB2, wgrib2 required, 7d 3h→1h |
| MET Norway | No | <20/s | Locationforecast 2.0, User-Agent required, Nordic best |
| NOAA GFS | No | None | NOMADS GRIB2, wgrib2 required, 7d hourly |
| AviationWeather | No | None | METAR, TAF (station-based) |

## Planned / design

### 2) NOAA GFS via NOMADS — integrated

**Why:** Free, raw, independent, global. GFS runs to forecast hour 384 (~16 days). NOMADS provides geographic subsetting.

**Implementation:** filter_gfs_0p25.pl with subset box, wgrib2 for point extraction. Provider ID: `noaa-gfs`. Requires wgrib2 ([GitHub](https://github.com/NOAA-EMC/wgrib2)).

### 3) Environment Canada GDPS / MSC GeoMet — integrated

**Why:** Free, independent, valuable for Canada/North Atlantic. GDPS is global, 10-day lead.

**Implementation:** Datamart GRIB2 at `dd.weather.gc.ca/today/model_gem_global/15km/grib2/lat_lon/{HH}/{hhh}/`. Fetches UGRD, VGRD, TMP, GUST_MAX per forecast hour (3-hourly: 0–168h), uses wgrib2 for point extraction, expands to hourly. Provider ID: `ec-geomet`. Requires wgrib2 ([GitHub](https://github.com/NOAA-EMC/wgrib2)).

### 3b) MET Norway Locationforecast — integrated

**Why:** Free, no API key, best for Nordic/Arctic. MEPS 2.5 km short-range; ECMWF for medium-range. Global coverage via ECMWF.

**Implementation:** `api.met.no/weatherapi/locationforecast/2.0/compact`. User-Agent with contact (email or URL) required; set `MET_NORWAY_USER_AGENT`. Variable resolution: 1h for 0–60h (Nordic/Arctic), 6h thereafter; we expand to hourly. Provider ID: `met-norway`.

### 4) AviationWeather (integrated)

**Endpoints:**
- `GET /api/aviation/metar?ids=CYQB,CYUL,KJFK`
- `GET /api/aviation/taf?ids=CYQB,CYUL,KJFK`

**Use:** METAR/TAF for bias correction, airport sanity checks, PIREP for spot validation. Station-based, not grid forecasts.

### 5) Meteostat

**Why:** Historical observations interpolated to any point. Useful for validating forecasts (what actually happened vs what was predicted) and bias correction.

**Important:** Meteostat provides **historical data only**, not forecasts. Data has a 2–3 hour lag; some observations arrive days later.

**Endpoint:**
```
GET https://meteostat.p.rapidapi.com/point/hourly
  ?lat={lat}&lon={lon}&start={YYYY-MM-DD}&end={YYYY-MM-DD}
  &alt={m}&tz=auto&model=true&units=metric
```

**Headers:** `x-rapidapi-host: meteostat.p.rapidapi.com`, `x-rapidapi-key: {key}`

**Key:** Requires RapidAPI subscription (free tier: 500 req/month).

**Response:** `{ time, temp, wspd, wpgt, wdir, prcp, rhum, pres, ... }` – wind already in km/h.

**Limits:** Max 30 days per request. Data aggregated from NOAA, DWD, Environment Canada, etc.

**Use:** Fetch last 7 days of observations for a location to compare with forecast models. Complements AviationWeather (station obs) with interpolated point data.
