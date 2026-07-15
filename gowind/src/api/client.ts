import { getAuthToken } from "./auth-token.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

export async function apiFetch(path: string, options: RequestInit = {}) {
    const token = getAuthToken();
    let res: Response;
    try {
        res = await fetch(`${API_URL}${path}`, {
            ...options,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });
    } catch {
        throw new ApiError("Network request failed", 0);
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(err.error || "Request failed", res.status);
    }
    return res.json();
}
