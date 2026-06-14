import type { Preferences } from "@/types/setup";

export const SPORTS = [
    { id: "paragliding", label: "Paragliding" },
    { id: "hang-gliding", label: "Hang gliding" },
    { id: "kitesurfing", label: "Kitesurfing" },
    { id: "windsurfing", label: "Windsurfing" },
    { id: "wing-foiling", label: "Wing foiling" },
    { id: "sailing", label: "Sailing" },
    { id: "surfing", label: "Surfing" },
    { id: "sup", label: "SUP / Paddleboarding" },
    { id: "paramotoring", label: "Paramotoring" },
    { id: "running", label: "Running" },
    { id: "hiking", label: "Hiking" },
    { id: "biking", label: "Biking" },
] as const;

export type SportId = (typeof SPORTS)[number]["id"];

export interface SuggestedLocation {
    id: string;
    name: string;
    region: string;
    lat: number;
    lng: number;
}

export const SUGGESTED_LOCATIONS: SuggestedLocation[] = [
    { id: "montreal", name: "Montreal", region: "Quebec", lat: 45.5017, lng: -73.5673 },
    { id: "quebec-city", name: "Quebec City", region: "Quebec", lat: 46.8139, lng: -71.2082 },
    { id: "airpro-paramotor", name: "Airpro Paramotor", region: "Saint-Apollinaire, Quebec", lat: 46.5872, lng: -71.5613 },
];

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
    label: string;
}

export const WIND_DIRECTION_PRESETS = [
    { id: "any", label: "Any" },
    { id: "N", label: "N" },
    { id: "NE", label: "NE" },
    { id: "E", label: "E" },
    { id: "SE", label: "SE" },
    { id: "S", label: "S" },
    { id: "SW", label: "SW" },
    { id: "W", label: "W" },
    { id: "NW", label: "NW" },
] as const;

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
        label: "Paragliding",
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
        label: "Hang gliding",
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
        label: "Kitesurfing",
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
        label: "Windsurfing",
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
        label: "Wing foiling",
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
        label: "Sailing",
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
        label: "Surfing",
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
        label: "SUP / Paddleboarding",
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
        label: "Paramotoring",
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
        label: "Running",
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
        label: "Hiking",
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
        label: "Biking",
    },
};
