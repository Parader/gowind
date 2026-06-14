import type { Request, Response } from "express";
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { adminMiddleware } from "../middleware/adminAuth.js";
import { getApiCallCounts, resetApiCallCounts } from "../services/apiCallCounter.js";

const router = Router();

/** GET /admin/api-stats — API call counts (admin only) */
router.get("/api-stats", authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    const counts = getApiCallCounts();
    return res.json({ counts });
});

/** POST /admin/api-stats/reset — Reset counts (admin only) */
router.post("/api-stats/reset", authMiddleware, adminMiddleware, (_req: Request, res: Response) => {
    resetApiCallCounts();
    return res.json({ ok: true });
});

export const adminRoutes = router;
