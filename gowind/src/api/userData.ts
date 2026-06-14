import { apiFetch } from "./client.js";

export interface UserDataItem {
    _id: string;
    userId: string;
    type: string;
    data: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface UserDataListResponse {
    items: UserDataItem[];
}

export async function getUserData(type?: string): Promise<UserDataListResponse> {
    const params = type ? `?type=${encodeURIComponent(type)}` : "";
    return apiFetch(`/user-data${params}`);
}

export async function saveUserData(type: string, data: Record<string, unknown>): Promise<{ item: UserDataItem }> {
    return apiFetch("/user-data", {
        method: "POST",
        body: JSON.stringify({ type, data }),
    });
}

export async function deleteUserData(type: string): Promise<{ deleted: number }> {
    return apiFetch(`/user-data?type=${encodeURIComponent(type)}`, { method: "DELETE" });
}
