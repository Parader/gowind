import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth/jwt.js";

function extractAuthTokens(req: Request): string[] {
    const tokens: string[] = [];
    const header = req.headers.authorization;
    if (typeof header === "string") {
        const match = header.match(/^Bearer\s+(.+)$/i);
        const bearer = match?.[1]?.trim();
        if (bearer) tokens.push(bearer);
    }
    const cookie = req.cookies?.token;
    if (typeof cookie === "string" && cookie.trim()) {
        tokens.push(cookie.trim());
    }
    return tokens;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Prefer Authorization Bearer (localStorage) over cookie. A stale/invalid cross-site
    // cookie must not block a valid Bearer token — that was logging mobile users out.
    const tokens = extractAuthTokens(req);
    if (tokens.length === 0) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    for (const token of tokens) {
        const payload = verifyToken(token);
        if (payload) {
            (req as Request & { userId?: string; userEmail?: string }).userId = payload.userId;
            (req as Request & { userId?: string; userEmail?: string }).userEmail = payload.email;
            next();
            return;
        }
    }

    res.status(401).json({ error: "Invalid or expired token" });
}
