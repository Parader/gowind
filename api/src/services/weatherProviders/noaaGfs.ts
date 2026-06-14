/**
 * NOAA GFS via NOMADS - raw model output
 * https://nomads.ncep.noaa.gov/
 * Requires wgrib2 for GRIB2 decoding.
 */
import { extractPointFromGrib2 } from "../grib2.js";

const NOMADS_BASE = "https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl";

/** Get date and cycle for latest available GFS run. Runs at 00, 06, 12, 18 UTC. Data available ~4-5h after. */
function getLatestRun(): { yyyymmdd: string; cycle: string } {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyymmdd = `${utcDate.getUTCFullYear()}${pad(utcDate.getUTCMonth() + 1)}${pad(utcDate.getUTCDate())}`;

    let cycle = "00";
    if (utcHour >= 6) cycle = "06";
    if (utcHour >= 12) cycle = "12";
    if (utcHour >= 18) cycle = "18";
    if (utcHour < 4) {
        const yesterday = new Date(utcDate);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        return {
            yyyymmdd: `${yesterday.getUTCFullYear()}${pad(yesterday.getUTCMonth() + 1)}${pad(yesterday.getUTCDate())}`,
            cycle: "18",
        };
    }
    return { yyyymmdd, cycle };
}

/** Build subset box around point (±0.5° to keep file small) */
function subsetParams(lat: number, lon: number): Record<string, string> {
    const d = 0.5;
    return {
        leftlon: String(Math.max(-180, lon - d)),
        rightlon: String(Math.min(360, lon + d)),
        toplat: String(Math.min(90, lat + d)),
        bottomlat: String(Math.max(-90, lat - d)),
    };
}

export async function fetchFromNoaaGfs(
    lat: number,
    lng: number,
    days: number
): Promise<Record<string, unknown>> {
    const { yyyymmdd, cycle } = getLatestRun();
    const dir = `/gfs.${yyyymmdd}/${cycle}/atmos`;
    const subset = subsetParams(lat, lng);

    const time: string[] = [];
    const wind_speed_10m: number[] = [];
    const wind_gusts_10m: number[] = [];
    const temperature_2m: number[] = [];
    const precipitation_probability: number[] = [];

    const runBase = new Date(Date.UTC(
        parseInt(yyyymmdd.slice(0, 4), 10),
        parseInt(yyyymmdd.slice(4, 6), 10) - 1,
        parseInt(yyyymmdd.slice(6, 8), 10),
        parseInt(cycle, 10),
        0,
        0
    ));

    const hoursNeeded = Math.min(days * 24, 168);
    const lonNorm = lng < 0 ? lng + 360 : lng;

    for (let fh = 0; fh < hoursNeeded; fh += 1) {
        const validTime = new Date(runBase.getTime() + fh * 60 * 60 * 1000);
        time.push(validTime.toISOString().slice(0, 19));

        const params = new URLSearchParams({
            file: `gfs.t${cycle}z.pgrb2.0p25.f${String(fh).padStart(3, "0")}`,
            dir,
            lev_10_m_above_ground: "on",
            lev_2_m_above_ground: "on",
            var_UGRD: "on",
            var_VGRD: "on",
            var_TMP: "on",
            var_GUST: "on",
            ...subset,
        });

        const url = `${NOMADS_BASE}?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) {
            if (fh === 0 && res.status === 404) {
                throw new Error(`NOAA GFS: run ${yyyymmdd}/${cycle} not yet available. Try again later.`);
            }
            throw new Error(`NOAA GFS failed: ${res.status}`);
        }

        const buf = Buffer.from(await res.arrayBuffer());
        const values = await extractPointFromGrib2(buf, lonNorm, lat);

        const u = values.UGRD ?? 0;
        const v = values.VGRD ?? 0;
        const windMs = Math.sqrt(u * u + v * v);
        const windKmh = windMs * 3.6;
        wind_speed_10m.push(windKmh);
        wind_gusts_10m.push(values.GUST != null ? values.GUST * 3.6 : windKmh);
        temperature_2m.push(values.TMP ?? 0);
        precipitation_probability.push(0);
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
