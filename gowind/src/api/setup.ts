import { apiFetch } from "./client.js";
import type { Location, Preferences } from "@/types/setup";

export interface SetupResponse {
    locations: Location[];
    preferences: Preferences | null;
}

export async function getSetup(): Promise<SetupResponse> {
    return apiFetch("/setup");
}

export async function putSetup(locations: Location[], preferences: Preferences | null): Promise<SetupResponse> {
    return apiFetch("/setup", {
        method: "PUT",
        body: JSON.stringify({ locations, preferences }),
    });
}
