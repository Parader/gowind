/**
 * GRIB2 point extraction via wgrib2 CLI.
 * Requires wgrib2 to be installed: https://github.com/NOAA-EMC/wgrib2
 * On Windows: choco install wgrib2, or build from GitHub.
 */
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/** Extract value at lon,lat from GRIB2 buffer. Returns map of variable name -> value. */
export async function extractPointFromGrib2(
    gribBuffer: Buffer,
    lon: number,
    lat: number
): Promise<Record<string, number>> {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `grib2_${Date.now()}_${Math.random().toString(36).slice(2)}.grb2`);
    try {
        fs.writeFileSync(tmpFile, gribBuffer);
        return await runWgrib2Lon(tmpFile, lon, lat);
    } finally {
        try {
            fs.unlinkSync(tmpFile);
        } catch {
            /* ignore */
        }
    }
}

/** wgrib2 -lon outputs lines like: 1:0:d=...:UGRD:10 m above ground:...:lon=270,lat=20,val=5.2 */
function runWgrib2Lon(filePath: string, lon: number, lat: number): Promise<Record<string, number>> {
    return new Promise((resolve, reject) => {
        const args = [filePath, "-s", "-lon", String(lon), String(lat)];
        const proc = spawn("wgrib2", args, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        proc.stdout?.on("data", (d) => (stdout += d.toString()));
        proc.stderr?.on("data", (d) => (stderr += d.toString()));
        proc.on("close", (code) => {
            if (code !== 0) {
                if (stderr.includes("not found") || stderr.includes("command not found") || code === 127) {
                    reject(new Error("wgrib2 not found. Install from https://github.com/NOAA-EMC/wgrib2"));
                } else {
                    reject(new Error(`wgrib2 failed: ${stderr || stdout || code}`));
                }
                return;
            }
            const result: Record<string, number> = {};
            for (const line of stdout.split("\n")) {
                const valMatch = line.match(/val=([\d.-]+)/);
                if (!valMatch) continue;
                const val = parseFloat(valMatch[1]);
                if (Number.isNaN(val)) continue;
                const parts = line.split(":");
                const varName = parts[3];
                if (varName && /^[A-Z0-9_]+$/.test(varName)) {
                    result[varName] = val;
                }
            }
            resolve(result);
        });
        proc.on("error", (err) => {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                reject(new Error("wgrib2 not found. Install from https://github.com/NOAA-EMC/wgrib2"));
            } else {
                reject(err);
            }
        });
    });
}

/** Check if wgrib2 is available. */
export async function checkWgrib2(): Promise<boolean> {
    return new Promise((resolve) => {
        const proc = spawn("wgrib2", ["-version"], { stdio: "ignore" });
        proc.on("close", (code) => resolve(code === 0));
        proc.on("error", () => resolve(false));
    });
}
