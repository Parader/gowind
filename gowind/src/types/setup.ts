export interface Location {
    id: string;
    name: string;
    lat: number;
    lng: number;
    region?: string;
}

/** Altitude in feet for weather/wind data: ground (10m) or AGL. */
export type WeatherHeightFt = "ground" | 500 | 1000 | 2000 | 3000 | 5000 | 10000;

export interface Preferences {
    /** Altitudes (ft) to fetch for wind/weather data. Multiple allowed. Default: ["ground"]. */
    weatherHeightFt?: WeatherHeightFt[];
    maxWindKph: number;
    maxGustKph: number;
    minWindKph?: number;
    /** Max allowed difference between gusts and wind speed (gusts - wind). E.g. 10 means gusts can be at most 10 km/h higher than wind. */
    maxGustWindDifferenceKph?: number;
    sports?: string[];
    minTempC?: number;
    maxTempC?: number;
    /** When true, use feels-like temperature instead of real temperature for filtering. */
    useFeelsLikeTemp?: boolean;
    /** Max precipitation probability (0-100%). Replaces maxPrecipitationMm. */
    maxPrecipitationProbabilityPercent?: number;
    /** @deprecated Use maxPrecipitationProbabilityPercent */
    maxPrecipitationMm?: number;
    /** Preferred wind directions (e.g. ["N", "NE"]). Empty or undefined = any direction. */
    preferredWindDirections?: string[];
    preferredTimeOfDay?: "morning" | "afternoon" | "evening" | "anytime";
    /** Start hour (0-23) when preferredTimeOfDay is "custom" */
    preferredTimeStartHour?: number;
    /** End hour (0-23) when preferredTimeOfDay is "custom" */
    preferredTimeEndHour?: number;
    /** Preferred time blocks (multi-select with customizable start/end). Replaces preferredTimeOfDay when set. */
    preferredTimeBlocks?: Array<{ id: string; label: string; start: number; end: number }>;
    minSessionLengthMinutes?: number;
}
