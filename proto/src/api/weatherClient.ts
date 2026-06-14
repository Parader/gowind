import type { ForecastSlice, Location, WeatherProviderId } from '../domain/types'

interface OpenMeteoResponse {
  hourly?: {
    time: string[]
    wind_speed_10m?: number[]
    wind_gusts_10m?: number[]
    temperature_2m?: number[]
    precipitation_probability?: number[]
  }
}

// OpenWeather 5-day / 3‑hour forecast response (simplified)
// Docs: https://openweathermap.org/forecast5
interface OpenWeatherForecastResponse {
  list?: Array<{
    dt?: number
    main?: {
      temp?: number
    }
    wind?: {
      speed?: number // m/s
      gust?: number // m/s
    }
    pop?: number // precipitation probability 0–1
  }>
}

async function getFromOpenMeteo(
  location: Location,
  hoursAhead: number,
): Promise<ForecastSlice[]> {
  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
    hourly: [
      'wind_speed_10m',
      'wind_gusts_10m',
      'temperature_2m',
      'precipitation_probability',
    ].join(','),
    timezone: 'auto',
    windspeed_unit: 'kn',
  })

  // Open-Meteo limits by forecast_days, not hours; approximate days needed.
  const days = Math.max(1, Math.ceil(hoursAhead / 24))
  params.set('forecast_days', days.toString())

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch forecast: ${res.status}`)
  }

  const data = (await res.json()) as OpenMeteoResponse
  const hourly = data.hourly

  if (!hourly || !hourly.time || hourly.time.length === 0) {
    return []
  }

  const {
    time,
    wind_speed_10m = [],
    wind_gusts_10m = [],
    temperature_2m = [],
    precipitation_probability = [],
  } = hourly

  const now = Date.now()
  const horizonMs = hoursAhead * 60 * 60 * 1000

  const slices: ForecastSlice[] = []

  for (let i = 0; i < time.length; i++) {
    const ts = new Date(time[i]).getTime()
    if (ts < now || ts > now + horizonMs) {
      continue
    }

    const windKnots = wind_speed_10m[i] ?? null
    const gustKnots = wind_gusts_10m[i] ?? null
    const tempC = temperature_2m[i] ?? null
    const precipPct = precipitation_probability[i] ?? null

    if (windKnots == null || tempC == null) {
      // Require at least wind and temperature to make a call.
      continue
    }

    slices.push({
      time: time[i],
      windSpeedKts: windKnots,
      gustSpeedKts: gustKnots == null ? null : gustKnots,
      temperatureC: tempC,
      precipProbabilityPct: precipPct == null ? null : precipPct,
    })
  }

  return slices
}

const KPH_TO_KTS = 0.539957
const MPS_TO_KTS = 1.943844 // 1 m/s ≈ 1.943844 kt

async function getFromWeatherApi(
  location: Location,
  hoursAhead: number,
  apiKey: string,
): Promise<ForecastSlice[]> {
  // Use OpenWeather 5‑day / 3‑hour forecast as the \"Weather API\" provider.
  // Docs: https://openweathermap.org/current?collection=current_forecast
  // and https://openweathermap.org/forecast5
  const params = new URLSearchParams({
    lat: location.latitude.toString(),
    lon: location.longitude.toString(),
    appid: apiKey,
    units: 'metric', // temp in °C, wind in m/s
  })

  const url = `https://api.openweathermap.org/data/2.5/forecast?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`OpenWeather forecast failed: ${res.status}`)
  }

  const data = (await res.json()) as OpenWeatherForecastResponse & {
    cod?: number | string
    message?: string
  }
  // OpenWeather returns HTTP 200 for auth/rate-limit errors with cod + message in body
  const cod = data.cod
  if (cod != null && cod !== 200 && cod !== '200') {
    throw new Error(data.message ?? `OpenWeather error ${cod}`)
  }
  const entries = data.list ?? []
  if (entries.length === 0) return []

  const now = Date.now()
  const horizonMs = hoursAhead * 60 * 60 * 1000

  const slices: ForecastSlice[] = []

  for (const entry of entries) {
    if (!entry.dt) continue
    const ts = entry.dt * 1000
    if (ts < now || ts > now + horizonMs) continue

    const tempC = entry.main?.temp
    const windMs = entry.wind?.speed
    if (tempC == null || windMs == null) continue

    const gustMs = entry.wind?.gust ?? null
    const pop = entry.pop // 0–1

    slices.push({
      time: new Date(ts).toISOString(),
      windSpeedKts: windMs * MPS_TO_KTS,
      gustSpeedKts: gustMs == null ? null : gustMs * MPS_TO_KTS,
      temperatureC: tempC,
      precipProbabilityPct:
        pop == null || Number.isNaN(pop) ? null : Math.round(pop * 100),
    })
  }

  return slices
}

interface MeteosourcePointResponse {
  hourly?: {
    data?: Array<{
      date?: string
      temperature?: number
      wind?: { speed?: number; gusts?: number }
      probability?: { precipitation?: number }
      precipitation?: { probability?: number }
    }>
  }
  daily?: {
    data?: Array<{
      day?: string
      all_day?: {
        temperature?: number
        wind?: { speed?: number; gusts?: number }
        precipitation?: { total?: number; probability?: number }
      }
    }>
  }
}

async function getFromMeteosource(
  location: Location,
  hoursAhead: number,
  apiKey: string,
): Promise<ForecastSlice[]> {
  const params = new URLSearchParams({
    lat: location.latitude.toString(),
    lon: location.longitude.toString(),
    sections: 'hourly,daily',
    units: 'ca',
    language: 'en',
    key: apiKey,
  })

  const url = `https://www.meteosource.com/api/v1/free/point?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Meteosource forecast failed: ${res.status}`)
  }

  const data = (await res.json()) as MeteosourcePointResponse
  const hourly = data.hourly?.data ?? []
  const daily = data.daily?.data ?? []

  const now = Date.now()
  const horizonMs = hoursAhead * 60 * 60 * 1000
  const slices: ForecastSlice[] = []
  const seen = new Set<string>()

  // Add hourly slices (units 'ca' = wind in km/h)
  for (const h of hourly) {
    if (!h.date) continue
    const ts = new Date(h.date).getTime()
    if (Number.isNaN(ts) || ts < now || ts > now + horizonMs) continue

    const tempC = h.temperature
    const windKph = h.wind?.speed
    if (tempC == null || windKph == null) continue

    const gustKph = h.wind?.gusts ?? null
    const precipProb =
      h.precipitation?.probability ?? h.probability?.precipitation
    seen.add(h.date)

    slices.push({
      time: h.date,
      windSpeedKts: windKph * KPH_TO_KTS,
      gustSpeedKts: gustKph == null ? null : gustKph * KPH_TO_KTS,
      temperatureC: tempC,
      precipProbabilityPct:
        precipProb == null || Number.isNaN(precipProb) ? null : precipProb,
    })
  }

  // Fill remaining hours from daily to reach 7 days (168h)
  const targetHours = Math.min(168, hoursAhead)
  if (slices.length < targetHours && daily.length > 0) {
    for (const d of daily) {
      if (!d.day || !d.all_day || slices.length >= targetHours) continue

      const tempC = d.all_day.temperature ?? 0
      const windKph = d.all_day.wind?.speed ?? 0
      const gustKph = d.all_day.wind?.gusts ?? null
      const precipProb = d.all_day.precipitation?.probability ?? null

      for (let h = 0; h < 24 && slices.length < targetHours; h++) {
        const hourStr = h.toString().padStart(2, '0')
        const dateStr = `${d.day}T${hourStr}:00:00`
        const ts = new Date(dateStr).getTime()
        if (ts < now || ts > now + horizonMs || seen.has(dateStr)) continue
        seen.add(dateStr)

        slices.push({
          time: dateStr,
          windSpeedKts: windKph * KPH_TO_KTS,
          gustSpeedKts: gustKph == null ? null : gustKph * KPH_TO_KTS,
          temperatureC: tempC,
          precipProbabilityPct:
            precipProb == null || Number.isNaN(precipProb) ? null : precipProb,
        })
      }
    }
    slices.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }

  return slices
}

/** Timeline API: days[].hours[] use time-only datetime (e.g. "12:00:00"); combine with day.datetime for full timestamp. */
interface VisualCrossingTimelineResponse {
  timezone?: string
  tzoffset?: number
  days?: Array<{
    datetime?: string
    hours?: Array<{
      datetime?: string
      temp?: number
      windspeed?: number
      windgust?: number
      precipprob?: number
    }>
  }>
}

async function getFromVisualCrossing(
  location: Location,
  hoursAhead: number,
  apiKey: string,
): Promise<ForecastSlice[]> {
  const base = 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
  const params = new URLSearchParams({
    unitGroup: 'metric',
    include: 'hours',
    key: apiKey,
    contentType: 'json',
  })

  const url = `${base}/${location.latitude},${location.longitude}?${params.toString()}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Visual Crossing forecast failed: ${res.status}`)
  }

  const data = (await res.json()) as VisualCrossingTimelineResponse
  const days = data.days ?? []
  const tzOffsetHours = data.tzoffset ?? 0

  const now = Date.now()
  const horizonMs = hoursAhead * 60 * 60 * 1000

  const slices: ForecastSlice[] = []

  for (const day of days) {
    const dayDate = day.datetime
    const hours = day.hours ?? []
    for (const h of hours) {
      if (!h.datetime || !dayDate) continue
      // Hour datetime is time-only (e.g. "00:00:00", "12:00:00"); combine with day for full local time, then apply offset.
      const localIso = `${dayDate}T${h.datetime}`
      const offsetSign = tzOffsetHours >= 0 ? '+' : '-'
      const offsetAbs = Math.abs(tzOffsetHours)
      const oh = Math.floor(offsetAbs)
      const om = Math.round((offsetAbs % 1) * 60)
      const offsetStr = `${offsetSign}${String(oh).padStart(2, '0')}:${String(om).padStart(2, '0')}`
      const ts = new Date(`${localIso}${offsetStr}`).getTime()
      if (Number.isNaN(ts) || ts < now || ts > now + horizonMs) continue

      const tempC = h.temp
      const windKph = h.windspeed

      if (tempC == null || windKph == null) continue

      const gustKph = h.windgust ?? null
      const precipProb = h.precipprob

      slices.push({
        time: new Date(ts).toISOString(),
        windSpeedKts: windKph * KPH_TO_KTS,
        gustSpeedKts: gustKph == null ? null : gustKph * KPH_TO_KTS,
        temperatureC: tempC,
        precipProbabilityPct:
          precipProb == null || Number.isNaN(precipProb) ? null : precipProb,
      })
    }
  }

  return slices
}

/**
 * Fetch hourly forecast data for a given location using the selected provider.
 * If a provider is selected without a key (where required), returns an empty list.
 */
export async function getHourlyForecast(
  location: Location,
  hoursAhead: number,
  provider: WeatherProviderId,
  weatherApiKey?: string | null,
  meteosourceApiKey?: string | null,
  visualCrossingApiKey?: string | null,
): Promise<ForecastSlice[]> {
  if (provider === 'weatherapi') {
    if (!weatherApiKey) {
      return []
    }
    try {
      return await getFromWeatherApi(location, hoursAhead, weatherApiKey)
    } catch (e) {
      console.error(e)
      return []
    }
  }

  if (provider === 'meteosource') {
    if (!meteosourceApiKey) {
      return []
    }
    try {
      return await getFromMeteosource(location, hoursAhead, meteosourceApiKey)
    } catch (e) {
      console.error(e)
      return []
    }
  }

  if (provider === 'visualcrossing') {
    if (!visualCrossingApiKey) {
      return []
    }
    try {
      return await getFromVisualCrossing(location, hoursAhead, visualCrossingApiKey)
    } catch (e) {
      console.error(e)
      return []
    }
  }

  return getFromOpenMeteo(location, hoursAhead)
}

