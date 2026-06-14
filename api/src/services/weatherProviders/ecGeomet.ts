/**
 * Environment Canada GDPS via MSC Datamart (GeoMet GRIB2 pipeline)
 * https://eccc-msc.github.io/open-data/msc-data/nwp_gdps/readme_gdps-datamart_en/
 *
 * Uses model_gem_global 15km lat/lon GRIB2. Cycles 00/12 UTC, 3-hourly forecast.
 * Requires wgrib2 for GRIB2 decoding.
 */
import { extractPointFromGrib2 } from "../grib2.js";

const DATAMART_BASE = "https://dd.weather.gc.ca/today/model_gem_global/15km/grib2/lat_lon";

/** Variables we need: UGRD, VGRD at 10m; TMP at 2m; GUST at 10m (use GUST_MAX if GUST missing) */
const VAR_LEVELS: Array<{ var: string; level: string }> = [
    { var: "UGRD", level: "TGL_10" },
    { var: "VGRD", level: "TGL_10" },
    { var: "TMP", level: "TGL_2" },
    { var: "GUST_MAX", level: "TGL_10" },
];

/** Get latest GDPS run (00 or 12 UTC). Data available ~3–4h after cycle. */
function getLatestRun(): { yyyymmdd: string; cycle: string } {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyymmdd = `${utcDate.getUTCFullYear()}${pad(utcDate.getUTCMonth() + 1)}${pad(utcDate.getUTCDate())}`;

    let cycle = "00";
    if (utcHour >= 12) cycle = "12";
    // If before ~04Z, previous 12Z run may be most recent
    if (utcHour < 4) {
        const yesterday = new Date(utcDate);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        return {
            yyyymmdd: `${yesterday.getUTCFullYear()}${pad(yesterday.getUTCMonth() + 1)}${pad(yesterday.getUTCDate())}`,
            cycle: "12",
        };
    }
    return { yyyymmdd, cycle };
}

function fileName(varName: string, level: string, yyyymmdd: string, cycle: string, fh: number): string {
    const fhh = String(fh).padStart(3, "0");
    return `CMC_glb_${varName}_${level}_latlon.15x.15_${yyyymmdd}${cycle}_P${fhh}.grib2`;
}

/** EC uses -180..180 lon; pass-through */
function lonForWgrib2(lng: number): number {
    return lng;
}

export async function fetchFromEcGeomet(
    lat: number,
    lng: number,
    days: number
): Promise<Record<string, unknown>> {
    const { yyyymmdd, cycle } = getLatestRun();
    const runBase = new Date(Date.UTC(
        parseInt(yyyymmdd.slice(0, 4), 10),
        parseInt(yyyymmdd.slice(4, 6), 10) - 1,
        parseInt(yyyymmdd.slice(6, 8), 10),
        parseInt(cycle, 10),
        0,
        0
    ));

    const hoursNeeded = Math.min(days * 24, 168);
    const lon = lonForWgrib2(lng);

    const time: string[] = [];
    const wind_speed_10m: number[] = [];
    const wind_gusts_10m: number[] = [];
    const temperature_2m: number[] = [];
    const precipitation_probability: number[] = [];

    // GDPS is 3-hourly: 0, 3, 6, ..., 168. Expand to hourly by repeating each 3h value.
    const fhStep = 3;
    for (let fh = 0; fh < hoursNeeded; fh += fhStep) {
        const fhh = String(fh).padStart(3, "0");
        const fetchAndExtract = async ({ var: v, level: lev }: { var: string; level: string }) => {
            const fname = fileName(v, lev, yyyymmdd, cycle, fh);
            const url = `${DATAMART_BASE}/${cycle}/${fhh}/${fname}`;
            const res = await fetch(url);
            if (!res.ok) {
                if (fh === 0 && res.status === 404) {
                    throw new Error(`EC GDPS: run ${yyyymmdd}/${cycle} not yet available. Try again later.`);
                }
                throw new Error(`EC GDPS failed: ${res.status} ${url}`);
            }
            const buf = Buffer.from(await res.arrayBuffer());
            return extractPointFromGrib2(buf, lon, lat);
        };
        const results = await Promise.all(VAR_LEVELS.map(fetchAndExtract));
        const allVars: Record<string, number> = Object.assign({}, ...results);

        const u = allVars.UGRD ?? 0;
        const v = allVars.VGRD ?? 0;
        const windMs = Math.sqrt(u * u + v * v);
        const windKmh = windMs * 3.6;
        const gustMs = allVars.GUST_MAX ?? allVars.GUST ?? windMs;
        const gustKmh = gustMs * 3.6;

        for (let h = 0; h < fhStep && time.length < hoursNeeded; h++) {
            const t = new Date(runBase.getTime() + (fh + h) * 60 * 60 * 1000);
            time.push(t.toISOString().slice(0, 19));
            wind_speed_10m.push(windKmh);
            wind_gusts_10m.push(gustKmh);
            temperature_2m.push(allVars.TMP ?? 0);
            precipitation_probability.push(0);
        }
    }

    return {
        latitude: lat,
        longitude: lng,
        timezone: "UTC",
        hourly: {
            time,
            wind_speed_10m,
            wind_gusts_10m,
            temperature_2m,
            precipitation_probability,
        },
    };
}
