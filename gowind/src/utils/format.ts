/**
 * Format a date as elapsed time (e.g. "2m ago", "1h ago").
 */
export function formatTimeAgo(date: string | Date): string {
    const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
    const now = Date.now();
    const sec = Math.floor((now - then) / 1000);

    if (sec < 0) return "just now";
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return `${Math.floor(sec / 604800)}w ago`;
}
