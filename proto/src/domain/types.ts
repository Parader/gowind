export type LocationId = string

export interface Location {
  id: LocationId
  name: string
  latitude: number
  longitude: number
  notes?: string
  /**
   * Optional flag so we can highlight a \"home\" site in the UI.
   */
  isHome?: boolean
}

export interface UserSettings {
  /** Maximum steady wind speed in knots */
  maxWindKts: number
  /** Maximum gust speed in knots */
  maxGustKts: number
  /** Maximum allowed (gust - wind) spread in knots */
  maxGustDeltaKts: number
  /** Minimum comfortable temperature in °C */
  minTempC: number
  /** Maximum comfortable temperature in °C */
  maxTempC: number
  /** Whether any precipitation at all is acceptable */
  allowPrecipitation: boolean
  /**
   * Maximum precipitation probability in percent (0-100).
   * Ignored if allowPrecipitation is true.
   */
  maxPrecipProbabilityPct: number
  /** Minimum required duration of a window, in hours */
  minWindowDurationHours: number
  /** How far ahead to look for windows, in hours */
  horizonHours: number
  /**
   * If true, we slightly prefer early morning / late evening
   * hours in the scoring.
   */
  preferMorningAndEvening: boolean
  /** If true, only consider hours inside the configured time-of-day windows */
  restrictToTimeOfDay: boolean
  /** Morning window start hour (0-23, local time) */
  morningStartHour: number
  /** Morning window end hour (0-23, local time, exclusive) */
  morningEndHour: number
  /** Evening window start hour (0-23, local time) */
  eveningStartHour: number
  /** Evening window end hour (0-23, local time, exclusive) */
  eveningEndHour: number
  /** Which weather provider to use for forecasts (primary preference, legacy) */
  weatherProvider: WeatherProviderId
  /** Enable Open-Meteo provider */
  useOpenMeteo: boolean
  /** Enable WeatherAPI provider */
  useWeatherApi: boolean
  /** Enable Meteosource provider */
  useMeteosource: boolean
  /** Enable Visual Crossing provider */
  useVisualCrossing: boolean
  /** Optional API key for providers that require it (e.g. WeatherAPI) */
  weatherApiKey: string | null
  /** Optional API key for Meteosource */
  meteosourceApiKey: string | null
  /** Optional API key for Visual Crossing */
  visualCrossingApiKey: string | null
}

export type WeatherProviderId = 'open-meteo' | 'weatherapi' | 'meteosource' | 'visualcrossing'

export const defaultUserSettings: UserSettings = {
  maxWindKts: 10,
  maxGustKts: 15,
  maxGustDeltaKts: 5,
  minTempC: -20,
  maxTempC: 30,
  allowPrecipitation: false,
  maxPrecipProbabilityPct: 20,
  minWindowDurationHours: 1,
  horizonHours: 168,
  preferMorningAndEvening: true,
  restrictToTimeOfDay: false,
  morningStartHour: 7,
  morningEndHour: 12,
  eveningStartHour: 15,
  eveningEndHour: 18,
  weatherProvider: 'open-meteo',
  useOpenMeteo: true,
  useWeatherApi: false,
  useMeteosource: false,
  weatherApiKey: null,
  meteosourceApiKey: null,
  useVisualCrossing: false,
  visualCrossingApiKey: null,
}

export interface ForecastSlice {
  /** ISO timestamp for the forecast hour */
  time: string
  /** Steady wind at 10m, in knots */
  windSpeedKts: number
  /** Gust at 10m, in knots (may be null if not provided) */
  gustSpeedKts: number | null
  /** Temperature at 2m, in °C */
  temperatureC: number
  /** Probability of precipitation, percent (0-100), or null if unknown */
  precipProbabilityPct: number | null
}

export enum FlightRatingCategory {
  GOOD = 'GOOD',
  MARGINAL = 'MARGINAL',
  NO_GO = 'NO_GO',
}

export interface SliceEvaluation {
  locationId: LocationId
  providerId: WeatherProviderId
  slice: ForecastSlice
  category: FlightRatingCategory
  /**
   * Numeric score (0-100) used for ranking.
   * Higher is better.
   */
  score: number
  /** Human-readable reasons explaining the rating */
  reasons: string[]
}

export interface FlightWindow {
  id: string
  locationId: LocationId
  providerId: WeatherProviderId
  /** ISO start time of the first slice in the window */
  startTime: string
  /** ISO end time of the last slice in the window */
  endTime: string
  /** Overall window category (e.g. GOOD if all slices are GOOD) */
  category: FlightRatingCategory
  /** Average score across all slices in the window */
  averageScore: number
  /** All slice-level evaluations that belong to this window */
  slices: SliceEvaluation[]
}

export interface NextBestWindowResult {
  window: FlightWindow | null
  /** Other candidate windows sorted by quality */
  alternatives: FlightWindow[]
}

