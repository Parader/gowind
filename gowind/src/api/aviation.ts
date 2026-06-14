import { apiFetch } from "./client.js";

export interface MetarItem {
    icaoId: string;
    lat: number;
    lon: number;
    name: string;
    temp?: number;
    dewp?: number;
    wdir?: number;
    wspd?: number;
    rawOb?: string;
    reportTime?: string;
    [key: string]: unknown;
}

export interface TafItem {
    icaoId: string;
    lat: number;
    lon: number;
    name: string;
    rawTAF?: string;
    validTimeFrom?: number;
    validTimeTo?: number;
    fcsts?: Array<{
        timeFrom: number;
        timeTo: number;
        wdir?: number | string;
        wspd?: number;
        wgst?: number | null;
        visib?: string | number;
        wxString?: string | null;
        clouds?: Array<{ cover: string; base: number }>;
    }>;
    [key: string]: unknown;
}

export async function getMetar(ids: string[]): Promise<MetarItem[]> {
    const idStr = ids.filter(Boolean).join(",");
    if (!idStr) return [];
    return apiFetch(`/aviation/metar?ids=${encodeURIComponent(idStr)}`);
}

export async function getTaf(ids: string[]): Promise<TafItem[]> {
    const idStr = ids.filter(Boolean).join(",");
    if (!idStr) return [];
    return apiFetch(`/aviation/taf?ids=${encodeURIComponent(idStr)}`);
}
