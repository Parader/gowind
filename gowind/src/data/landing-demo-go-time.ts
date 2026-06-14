import type { GoTimeWindow, GoTimeWindowSeriesPoint } from "@/api/goTimes";

function startOfLocalDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function addDaysLocal(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

/** `dayOffset` from today (0 = today), local time. */
function localDayAtHour(dayOffset: number, hour: number, minute: number): Date {
    const d = addDaysLocal(startOfLocalDay(new Date()), dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
}

function addHours(d: Date, hours: number): Date {
    const x = new Date(d);
    x.setHours(x.getHours() + hours);
    return x;
}

type SeriesRow = {
    windKmh: number;
    gustKmh: number;
    tempC: number;
    precipPct: number;
    suitability: number;
    reliability: number;
    windDirDeg: number;
};

function buildWindowFromSeries(opts: {
    id: string;
    locationId: string;
    locationName: string;
    locationLat: number;
    locationLng: number;
    start: Date;
    end: Date;
    category: "GOOD" | "MARGINAL" | "NO_GO";
    averageScore: number;
    seriesRows: SeriesRow[];
    reliabilityExplanation: string;
    evaluationNotes: string[];
}): GoTimeWindow {
    const { seriesRows, start } = opts;
    const winds = seriesRows.map((r) => r.windKmh);
    const gusts = seriesRows.map((r) => r.gustKmh);
    const temps = seriesRows.map((r) => r.tempC);
    const precips = seriesRows.map((r) => r.precipPct);
    const suits = seriesRows.map((r) => r.suitability);
    const rels = seriesRows.map((r) => r.reliability);

    const minWindKmh = Math.round(Math.min(...winds));
    const maxWindKmh = Math.round(Math.max(...winds));
    const maxGustKmh = Math.round(Math.max(...gusts));
    const minTempC = Math.round(Math.min(...temps));
    const maxTempC = Math.round(Math.max(...temps));
    const minPrecipPct = Math.round(Math.min(...precips));
    const maxPrecipPct = Math.round(Math.max(...precips));
    const suitabilityScore = suits.reduce((a, b) => a + b, 0) / suits.length;
    const reliabilityScore = rels.reduce((a, b) => a + b, 0) / rels.length;

    const windowSeries: GoTimeWindowSeriesPoint[] = seriesRows.map((row, i) => ({
        time: addHours(start, i).toISOString(),
        windKmh: row.windKmh,
        gustKmh: row.gustKmh,
        tempC: row.tempC,
        precipPct: row.precipPct,
        windDirDeg: row.windDirDeg,
        suitability: row.suitability,
        reliability: row.reliability,
    }));

    const dirSum = seriesRows.reduce(
        (acc, r) => {
            const rad = (r.windDirDeg * Math.PI) / 180;
            return { x: acc.x + Math.cos(rad), y: acc.y + Math.sin(rad) };
        },
        { x: 0, y: 0 },
    );
    const avgWindDirDeg =
        Math.round((Math.atan2(dirSum.y, dirSum.x) * 180) / Math.PI + 360) % 360;

    return {
        id: opts.id,
        locationId: opts.locationId,
        locationName: opts.locationName,
        locationLat: opts.locationLat,
        locationLng: opts.locationLng,
        startTime: opts.start.toISOString(),
        endTime: opts.end.toISOString(),
        category: opts.category,
        suitabilityScore,
        averageScore: opts.averageScore,
        reliabilityScore,
        confidence: reliabilityScore,
        reliabilityExplanation: opts.reliabilityExplanation,
        providerCount: 4,
        minWindKmh,
        maxWindKmh,
        hasGusts: true,
        maxGustKmh,
        minTempC,
        maxTempC,
        hasPrecip: true,
        minPrecipPct,
        maxPrecipPct,
        evaluationNotes: opts.evaluationNotes,
        byProvider: [
            {
                providerId: "open-meteo",
                hourCount: 3,
                minWindKmh: minWindKmh - 1,
                maxWindKmh: maxWindKmh + 1,
                minGustKmh: maxGustKmh - 4,
                maxGustKmh: maxGustKmh + 2,
                minTempC,
                maxTempC,
                minPrecipPct: Math.max(0, minPrecipPct - 1),
                maxPrecipPct: maxPrecipPct + 1,
                avgScore: opts.averageScore - 1,
            },
            {
                providerId: "meteosource",
                hourCount: 3,
                minWindKmh,
                maxWindKmh,
                minGustKmh: maxGustKmh - 3,
                maxGustKmh,
                minTempC,
                maxTempC,
                minPrecipPct,
                maxPrecipPct,
                avgScore: opts.averageScore,
            },
            {
                providerId: "visualcrossing",
                hourCount: 3,
                minWindKmh: minWindKmh + 1,
                maxWindKmh: maxWindKmh + 2,
                minGustKmh: maxGustKmh - 2,
                maxGustKmh: maxGustKmh + 3,
                minTempC: minTempC - 1,
                maxTempC: maxTempC + 1,
                minPrecipPct,
                maxPrecipPct: maxPrecipPct + 2,
                avgScore: opts.averageScore,
            },
        ],
        windowSeries,
        avgWindDirDeg,
    };
}

/** Rotating samples for the marketing landing — different place, day, time, score, wind, and category. */
export function getLandingDemoGoTimeWindows(): GoTimeWindow[] {
    return [
        buildWindowFromSeries({
            id: "landing-demo-a",
            locationId: "landing-demo-loc-a",
            locationName: "North Ridge Field",
            locationLat: 47.6062,
            locationLng: -122.3321,
            start: localDayAtHour(1, 14, 0),
            end: localDayAtHour(1, 17, 0),
            category: "GOOD",
            averageScore: 87,
            reliabilityExplanation:
                "Forecasts agree well for this window; multiple models show similar wind and gust trends.",
            evaluationNotes: [
                "Wind stays within your configured limits for this window.",
                "Gust ratio is acceptable relative to your max gust setting.",
            ],
            seriesRows: [
                { windKmh: 18, gustKmh: 28, tempC: 14, precipPct: 5, suitability: 0.85, reliability: 0.82, windDirDeg: 268 },
                { windKmh: 20, gustKmh: 30, tempC: 15, precipPct: 8, suitability: 0.88, reliability: 0.82, windDirDeg: 272 },
                { windKmh: 22, gustKmh: 32, tempC: 15, precipPct: 10, suitability: 0.87, reliability: 0.83, windDirDeg: 276 },
                { windKmh: 21, gustKmh: 31, tempC: 14, precipPct: 12, suitability: 0.86, reliability: 0.83, windDirDeg: 274 },
            ],
        }),
        buildWindowFromSeries({
            id: "landing-demo-b",
            locationId: "landing-demo-loc-b",
            locationName: "East Bluff Launch",
            locationLat: 45.5152,
            locationLng: -122.6784,
            start: localDayAtHour(0, 9, 0),
            end: localDayAtHour(0, 12, 0),
            category: "MARGINAL",
            averageScore: 68,
            reliabilityExplanation:
                "Models mostly agree; a little spread on gusts, but the overall trend is consistent.",
            evaluationNotes: [
                "Wind is on the lower side of your preferred range for part of the window.",
                "Gusts occasionally brush your upper limit—worth a closer look.",
            ],
            seriesRows: [
                { windKmh: 12, gustKmh: 22, tempC: 11, precipPct: 15, suitability: 0.62, reliability: 0.78, windDirDeg: 310 },
                { windKmh: 14, gustKmh: 24, tempC: 12, precipPct: 18, suitability: 0.66, reliability: 0.79, windDirDeg: 312 },
                { windKmh: 13, gustKmh: 25, tempC: 12, precipPct: 20, suitability: 0.64, reliability: 0.78, windDirDeg: 308 },
                { windKmh: 15, gustKmh: 26, tempC: 13, precipPct: 22, suitability: 0.67, reliability: 0.8, windDirDeg: 315 },
            ],
        }),
        buildWindowFromSeries({
            id: "landing-demo-c",
            locationId: "landing-demo-loc-c",
            locationName: "South Mesa",
            locationLat: 40.015,
            locationLng: -105.2705,
            start: localDayAtHour(4, 10, 30),
            end: localDayAtHour(4, 14, 0),
            category: "GOOD",
            averageScore: 92,
            reliabilityExplanation:
                "Strong agreement between sources; conditions are stable through the window.",
            evaluationNotes: [
                "Wind and gusts sit comfortably inside your limits.",
                "Temperature and precipitation look favorable for your session length.",
            ],
            seriesRows: [
                { windKmh: 26, gustKmh: 38, tempC: 18, precipPct: 2, suitability: 0.92, reliability: 0.88, windDirDeg: 240 },
                { windKmh: 28, gustKmh: 40, tempC: 19, precipPct: 3, suitability: 0.93, reliability: 0.89, windDirDeg: 242 },
                { windKmh: 30, gustKmh: 42, tempC: 19, precipPct: 4, suitability: 0.94, reliability: 0.89, windDirDeg: 245 },
                { windKmh: 29, gustKmh: 41, tempC: 18, precipPct: 5, suitability: 0.93, reliability: 0.88, windDirDeg: 243 },
            ],
        }),
        buildWindowFromSeries({
            id: "landing-demo-d",
            locationId: "landing-demo-loc-d",
            locationName: "Harbor Point",
            locationLat: 32.7157,
            locationLng: -117.1611,
            start: localDayAtHour(2, 18, 0),
            end: localDayAtHour(2, 21, 0),
            category: "GOOD",
            averageScore: 79,
            reliabilityExplanation:
                "Coastal flow is modeled consistently; minor differences in gust peaks only.",
            evaluationNotes: [
                "Evening block lines up with your preferred time-of-day settings.",
                "Sea breeze pattern matches what several models show for this spot.",
            ],
            seriesRows: [
                { windKmh: 16, gustKmh: 26, tempC: 20, precipPct: 8, suitability: 0.78, reliability: 0.84, windDirDeg: 200 },
                { windKmh: 17, gustKmh: 27, tempC: 20, precipPct: 9, suitability: 0.8, reliability: 0.85, windDirDeg: 205 },
                { windKmh: 18, gustKmh: 28, tempC: 19, precipPct: 10, suitability: 0.79, reliability: 0.85, windDirDeg: 210 },
                { windKmh: 17, gustKmh: 27, tempC: 19, precipPct: 11, suitability: 0.78, reliability: 0.84, windDirDeg: 208 },
            ],
        }),
    ];
}

/** How long each full landing demo card is shown before switching to the next sample. */
export const LANDING_DEMO_ROTATE_MS = 4000;
