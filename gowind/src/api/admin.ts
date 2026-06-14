import { apiFetch } from "./client.js";

export interface ApiStats {
    counts: Record<string, number>;
}

export async function getApiStats(): Promise<ApiStats> {
    return apiFetch("/admin/api-stats");
}

export async function resetApiStats(): Promise<void> {
    await apiFetch("/admin/api-stats/reset", { method: "POST" });
}
