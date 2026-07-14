import type { GoTimeFocusView } from "@/components/go-time/go-time-focus-views";
import { GO_TIME_ALL_LOCATIONS } from "@/components/go-time/go-time-focus-views";

export interface GoTimeViewPrefs {
    focusView: GoTimeFocusView;
    goodOnly: boolean;
    locationFilterId: string;
}

const DEFAULT_PREFS: GoTimeViewPrefs = {
    focusView: "next",
    goodOnly: true,
    locationFilterId: GO_TIME_ALL_LOCATIONS,
};

function storageKey(userId: string): string {
    return `gowind_go_time_view_${userId}`;
}

export function readGoTimeViewPrefs(userId: string | undefined | null): GoTimeViewPrefs {
    if (!userId) return { ...DEFAULT_PREFS };
    try {
        const raw = localStorage.getItem(storageKey(userId));
        if (!raw) return { ...DEFAULT_PREFS };
        const parsed = JSON.parse(raw) as Partial<GoTimeViewPrefs>;
        const focusView =
            parsed.focusView === "next" || parsed.focusView === "best" || parsed.focusView === "all"
                ? parsed.focusView
                : DEFAULT_PREFS.focusView;
        return {
            focusView,
            goodOnly: typeof parsed.goodOnly === "boolean" ? parsed.goodOnly : DEFAULT_PREFS.goodOnly,
            locationFilterId:
                typeof parsed.locationFilterId === "string" && parsed.locationFilterId
                    ? parsed.locationFilterId
                    : DEFAULT_PREFS.locationFilterId,
        };
    } catch {
        return { ...DEFAULT_PREFS };
    }
}

export function writeGoTimeViewPrefs(userId: string, prefs: GoTimeViewPrefs): void {
    try {
        localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
    } catch {
        /* ignore quota / private mode */
    }
}
