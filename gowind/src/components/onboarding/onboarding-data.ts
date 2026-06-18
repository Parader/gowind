import type { Preferences } from "@/types/setup";
import type { TranslateParams } from "@/providers/locale-provider";

export const SPORTS = [
    { id: "paragliding" },
    { id: "hang-gliding" },
    { id: "kitesurfing" },
    { id: "windsurfing" },
    { id: "wing-foiling" },
    { id: "sailing" },
    { id: "surfing" },
    { id: "sup" },
    { id: "paramotoring" },
    { id: "running" },
    { id: "hiking" },
    { id: "biking" },
] as const;

export type SportId = (typeof SPORTS)[number]["id"];

const SPORT_I18N_KEY: Record<SportId, string> = {
    paragliding: "paragliding",
    "hang-gliding": "hangGliding",
    kitesurfing: "kitesurfing",
    windsurfing: "windsurfing",
    "wing-foiling": "wingFoiling",
    sailing: "sailing",
    surfing: "surfing",
    sup: "sup",
    paramotoring: "paramotoring",
    running: "running",
    hiking: "hiking",
    biking: "biking",
};

export function sportListKey(id: SportId | string): string {
    return `onboarding.sportsList.${SPORT_I18N_KEY[id as SportId] ?? id}`;
}

export function sportPresetLabelKey(id: string): string {
    return `preferences.presets.labels.${SPORT_I18N_KEY[id as SportId] ?? id}`;
}

export interface SuggestedLocation {
    id: string;
    lat: number;
    lng: number;
}

export const SUGGESTED_LOCATIONS: SuggestedLocation[] = [
    { id: "montreal", lat: 45.5017, lng: -73.5673 },
    { id: "quebec-city", lat: 46.8139, lng: -71.2082 },
    { id: "airpro-paramotor", lat: 46.5872, lng: -71.5613 },
];

const SUGGESTED_LOCATION_I18N_KEY: Record<string, string> = {
    montreal: "montreal",
    "quebec-city": "quebecCity",
    "airpro-paramotor": "airproParamotor",
};

export function suggestedLocationNameKey(id: string): string {
    const key = SUGGESTED_LOCATION_I18N_KEY[id] ?? id;
    return `onboarding.suggestedLocations.${key}.name`;
}

export function suggestedLocationRegionKey(id: string): string {
    const key = SUGGESTED_LOCATION_I18N_KEY[id] ?? id;
    return `onboarding.suggestedLocations.${key}.region`;
}

export interface SportPreset {
    maxWindKph: number;
    maxGustKph: number;
    minWindKph: number;
    maxGustWindDifferenceKph?: number;
    minTempC: number;
    maxTempC: number;
    useFeelsLikeTemp?: boolean;
    maxPrecipitationProbabilityPercent: number;
    preferredTimeOfDay: NonNullable<Preferences["preferredTimeOfDay"]>;
    preferredWindDirections?: string[];
    minSessionLengthMinutes: number;
}

export const WIND_DIRECTION_IDS = [
    "any",
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
] as const;

export type WindDirectionId = (typeof WIND_DIRECTION_IDS)[number];

const WIND_DIRECTION_I18N_KEY: Record<WindDirectionId, string> = {
    any: "any",
    N: "n",
    NE: "ne",
    E: "e",
    SE: "se",
    S: "s",
    SW: "sw",
    W: "w",
    NW: "nw",
};

export function windDirectionKey(id: WindDirectionId): string {
    return `onboarding.windDirections.${WIND_DIRECTION_I18N_KEY[id]}`;
}

export const TIME_OF_DAY_IDS = ["morning", "afternoon", "evening", "anytime"] as const;

export type TimeOfDayId = (typeof TIME_OF_DAY_IDS)[number];

const TIME_OF_DAY_SCHEDULE: Record<TimeOfDayId, { start: number; end: number }> = {
    morning: { start: 6, end: 12 },
    afternoon: { start: 12, end: 17 },
    evening: { start: 17, end: 24 },
    anytime: { start: 0, end: 24 },
};

export function timeOfDayKey(id: TimeOfDayId | string): string {
    return `preferences.timeOfDay.${id}`;
}

export function getTimeOfDayOptions(t: (key: string, params?: TranslateParams) => string) {
    return TIME_OF_DAY_IDS.map((id) => ({
        id,
        label: t(timeOfDayKey(id)),
        start: TIME_OF_DAY_SCHEDULE[id].start,
        end: TIME_OF_DAY_SCHEDULE[id].end,
    }));
}

export const SPORT_PRESETS: Record<string, SportPreset> = {
    paragliding: {
        maxWindKph: 25,
        maxGustKph: 35,
        minWindKph: 5,
        maxGustWindDifferenceKph: 10,
        minTempC: 5,
        maxTempC: 35,
        maxPrecipitationProbabilityPercent: 0,
        preferredTimeOfDay: "morning",
        minSessionLengthMinutes: 60,
    },
    "hang-gliding": {
        maxWindKph: 30,
        maxGustKph: 40,
        minWindKph: 8,
        minTempC: 5,
        maxTempC: 35,
        maxPrecipitationProbabilityPercent: 0,
        preferredTimeOfDay: "afternoon",
        minSessionLengthMinutes: 90,
    },
    kitesurfing: {
        maxWindKph: 35,
        maxGustKph: 45,
        minWindKph: 12,
        minTempC: 10,
        maxTempC: 40,
        maxPrecipitationProbabilityPercent: 0,
        preferredTimeOfDay: "afternoon",
        minSessionLengthMinutes: 90,
    },
    windsurfing: {
        maxWindKph: 35,
        maxGustKph: 45,
        minWindKph: 10,
        minTempC: 10,
        maxTempC: 40,
        maxPrecipitationProbabilityPercent: 0,
        preferredTimeOfDay: "afternoon",
        minSessionLengthMinutes: 60,
    },
    "wing-foiling": {
        maxWindKph: 30,
        maxGustKph: 40,
        minWindKph: 8,
        minTempC: 10,
        maxTempC: 40,
        maxPrecipitationProbabilityPercent: 0,
        preferredTimeOfDay: "afternoon",
        minSessionLengthMinutes: 60,
    },
    sailing: {
        maxWindKph: 40,
        maxGustKph: 50,
        minWindKph: 5,
        minTempC: 5,
        maxTempC: 40,
        maxPrecipitationProbabilityPercent: 20,
        preferredTimeOfDay: "anytime",
        minSessionLengthMinutes: 120,
    },
    surfing: {
        maxWindKph: 25,
        maxGustKph: 35,
        minWindKph: 0,
        minTempC: 10,
        maxTempC: 35,
        maxPrecipitationProbabilityPercent: 0,
        preferredTimeOfDay: "morning",
        minSessionLengthMinutes: 60,
    },
    sup: {
        maxWindKph: 20,
        maxGustKph: 28,
        minWindKph: 0,
        minTempC: 15,
        maxTempC: 40,
        maxPrecipitationProbabilityPercent: 10,
        preferredTimeOfDay: "morning",
        minSessionLengthMinutes: 45,
    },
    paramotoring: {
        maxWindKph: 15,
        maxGustKph: 20,
        minWindKph: 0,
        maxGustWindDifferenceKph: 5,
        minTempC: 5,
        maxTempC: 35,
        maxPrecipitationProbabilityPercent: 0,
        preferredTimeOfDay: "morning",
        minSessionLengthMinutes: 60,
    },
    running: {
        maxWindKph: 30,
        maxGustKph: 40,
        minWindKph: 0,
        minTempC: -5,
        maxTempC: 35,
        maxPrecipitationProbabilityPercent: 25,
        preferredTimeOfDay: "morning",
        minSessionLengthMinutes: 30,
    },
    hiking: {
        maxWindKph: 40,
        maxGustKph: 50,
        minWindKph: 0,
        minTempC: -10,
        maxTempC: 35,
        maxPrecipitationProbabilityPercent: 50,
        preferredTimeOfDay: "morning",
        minSessionLengthMinutes: 120,
    },
    biking: {
        maxWindKph: 35,
        maxGustKph: 45,
        minWindKph: 0,
        minTempC: 0,
        maxTempC: 40,
        maxPrecipitationProbabilityPercent: 20,
        preferredTimeOfDay: "anytime",
        minSessionLengthMinutes: 45,
    },
};
