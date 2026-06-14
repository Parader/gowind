/**
 * Aviation Weather API proxy - METAR, TAF
 * https://aviationweather.gov/api/data/
 * No API key required. Use as aviation truth layer for bias correction and sanity checks.
 */
import type { Request, Response } from "express";
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";

import { recordApiCall } from "../services/apiCallCounter.js";

const router = Router();
const AVIATION_BASE = "https://aviationweather.gov/api/data";

async function proxyAviation(path: string, params: Record<string, string>): Promise<unknown> {
    recordApiCall(`aviation-${path}`);
    const url = `${AVIATION_BASE}/${path}?${new URLSearchParams({ ...params, format: "json" }).toString()}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
        throw new Error(`Aviation Weather API failed: ${res.status}`);
    }
    return res.json();
}

/** GET /aviation/metar?ids=CYQB,CYUL,KJFK */
router.get("/metar", authMiddleware, async (req: Request, res: Response) => {
    const ids = req.query.ids as string;
    if (!ids || !ids.trim()) {
        return res.status(400).json({ error: "ids parameter required (e.g. ids=CYQB,CYUL,KJFK)" });
    }
    try {
        const data = await proxyAviation("metar", { ids: ids.trim() });
        return res.json(data);
    } catch (err) {
        console.error("Aviation METAR error:", err);
        return res.status(502).json({
            error: err instanceof Error ? err.message : "METAR fetch failed",
        });
    }
});

/** GET /aviation/taf?ids=CYQB,CYUL,KJFK */
router.get("/taf", authMiddleware, async (req: Request, res: Response) => {
    const ids = req.query.ids as string;
    if (!ids || !ids.trim()) {
        return res.status(400).json({ error: "ids parameter required (e.g. ids=CYQB,CYUL,KJFK)" });
    }
    try {
        const data = await proxyAviation("taf", { ids: ids.trim() });
        return res.json(data);
    } catch (err) {
        console.error("Aviation TAF error:", err);
        return res.status(502).json({
            error: err instanceof Error ? err.message : "TAF fetch failed",
        });
    }
});

export const aviationRoutes = router;
