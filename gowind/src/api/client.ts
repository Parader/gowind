import { getAuthToken } from "./auth-token.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function apiFetch(path: string, options: RequestInit = {}) {
    const token = getAuthToken();
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Request failed");
    }
    return res.json();
}
