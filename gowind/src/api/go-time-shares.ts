import { apiFetch } from "./client.js";
import type { GoTimeWindow } from "./goTimes";

export interface GoTimeShareSnapshot {
    window: GoTimeWindow;
    sharedAt: string;
}

export interface GoTimeShareResponse {
    shareId: string;
    snapshot: GoTimeShareSnapshot;
    expiresAt: string;
    createdAt: string;
}

export async function createGoTimeShare(snapshot: GoTimeShareSnapshot): Promise<GoTimeShareResponse> {
    return apiFetch("/go-time-shares", {
        method: "POST",
        body: JSON.stringify({ snapshot }),
    }) as Promise<GoTimeShareResponse>;
}

export async function getGoTimeShare(shareId: string): Promise<GoTimeShareResponse> {
    return apiFetch(`/go-time-shares/${encodeURIComponent(shareId)}`) as Promise<GoTimeShareResponse>;
}
