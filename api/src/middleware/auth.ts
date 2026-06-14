import type { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { verifyToken } from "../auth/jwt.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const payload = verifyToken(token);
    if (!payload) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }
    (req as Request & { userId?: string; userEmail?: string }).userId = payload.userId;
    (req as Request & { userId?: string; userEmail?: string }).userEmail = payload.email;
    next();
}
