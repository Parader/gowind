import { apiFetch } from "./client.js";
import type { GoTimeWindow } from "./goTimes.js";

export type SavedGoTimeStatus = "upcoming" | "passed";

export interface SavedGoTimeItem {
    key: string;
    locationId: string;
    startTime: string;
    endTime: string;
    savedAt: string;
    status: SavedGoTimeStatus;
    window: GoTimeWindow;
}

export interface SavedGoTimesResponse {
    items: SavedGoTimeItem[];
    item?: SavedGoTimeItem;
}

export function savedGoTimeKey(locationId: string, startTime: string): string {
    return `${locationId}|${startTime}`;
}

export function keyForGoTimeWindow(w: Pick<GoTimeWindow, "locationId" | "startTime">): string {
    return savedGoTimeKey(w.locationId, w.startTime);
}

export async function listSavedGoTimes(): Promise<SavedGoTimesResponse> {
    return apiFetch("/saved-go-times") as Promise<SavedGoTimesResponse>;
}

export async function saveGoTimeWindow(window: GoTimeWindow): Promise<SavedGoTimesResponse> {
    return apiFetch("/saved-go-times", {
        method: "POST",
        body: JSON.stringify({ window }),
    }) as Promise<SavedGoTimesResponse>;
}

export async function unsaveGoTimeWindow(key: string): Promise<SavedGoTimesResponse> {
    return apiFetch(`/saved-go-times/${encodeURIComponent(key)}`, {
        method: "DELETE",
    }) as Promise<SavedGoTimesResponse>;
}
