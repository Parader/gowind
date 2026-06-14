import { apiFetch } from "./client.js";

export interface User {
    id: string;
    email: string;
    name?: string;
    image?: string;
}

export async function signup(email: string, password: string, name?: string): Promise<{ user: User }> {
    return apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
    });
}

export async function login(email: string, password: string): Promise<{ user: User }> {
    return apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export async function getMe(): Promise<{ user: User; isAdmin?: boolean }> {
    return apiFetch("/auth/me");
}

export async function logout(): Promise<void> {
    await apiFetch("/auth/logout", { method: "POST" });
}

export function getGoogleLoginUrl(): string {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
    return `${API_URL}/auth/google`;
}
