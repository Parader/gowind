/**
 * In-memory counter for external API calls.
 * Resets on server restart.
 */

const counts = new Map<string, number>();

export function recordApiCall(apiName: string): void {
    const current = counts.get(apiName) ?? 0;
    counts.set(apiName, current + 1);
}

export function getApiCallCounts(): Record<string, number> {
    const entries = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
}

export function resetApiCallCounts(): void {
    counts.clear();
}
