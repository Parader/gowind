import type { Request, Response, NextFunction } from "express";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

function isAdmin(email: string | undefined): boolean {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
    const userEmail = (req as Request & { userEmail?: string }).userEmail;
    if (!isAdmin(userEmail)) {
        res.status(403).json({ error: "Admin access required" });
        return;
    }
    next();
}

export { isAdmin };
