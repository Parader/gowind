import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Location, Preferences } from "@/types/setup";
import * as setupApi from "@/api/setup";

const STORAGE_KEY_PREFIX = "gowind_setup_";

function getStorageKey(userId: string, key: string) {
    return `${STORAGE_KEY_PREFIX}${userId}_${key}`;
}

interface SetupContextValue {
    locations: Location[];
    preferences: Preferences | null;
    addLocation: (location: Omit<Location, "id">) => void;
    removeLocation: (id: string) => void;
    updateLocation: (id: string, updates: Partial<Pick<Location, "name" | "lat" | "lng" | "region">>) => void;
    setPreferences: (preferences: Preferences) => void;
    isSetupComplete: boolean;
    /** True only when both preferences and locations are empty (first-time user). Questionnaire shown only in this case or when user clicks "Run setup again". */
    needsFullOnboarding: boolean;
    loadForUser: (userId: string) => void;
    clearForUser: () => void;
    isSaving: boolean;
}

const defaultPreferences: Preferences = {
    weatherHeightFt: ["ground"],
    maxWindKph: 25,
    maxGustKph: 35,
    minWindKph: 5,
};

const SetupContext = createContext<SetupContextValue | null>(null);

export function SetupProvider({ children }: { children: ReactNode }) {
    const [locations, setLocations] = useState<Location[]>([]);
    const [preferences, setPreferencesState] = useState<Preferences | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const persistToApi = useCallback(
        async (locs: Location[], prefs: Preferences | null) => {
            if (!currentUserId) return;
            setIsSaving(true);
            try {
                await setupApi.putSetup(locs, prefs);
            } catch {
                // Fallback to localStorage if API fails
                try {
                    localStorage.setItem(getStorageKey(currentUserId, "locations"), JSON.stringify(locs));
                    localStorage.setItem(getStorageKey(currentUserId, "preferences"), JSON.stringify(prefs ?? {}));
                } catch {
                    /* ignore */
                }
            } finally {
                setIsSaving(false);
            }
        },
        [currentUserId]
    );

    const clearForUser = useCallback(() => {
        setCurrentUserId(null);
        setLocations([]);
        setPreferencesState(null);
    }, []);

    const loadForUser = useCallback(async (userId: string) => {
        setCurrentUserId(userId);
        try {
            const { locations: locs, preferences: prefs } = await setupApi.getSetup();
            const validLocs = (locs ?? []).filter(
                (l): l is Location => l && typeof l.lat === "number" && typeof l.lng === "number"
            );
            setLocations(validLocs);
            setPreferencesState(prefs && typeof prefs === "object" ? prefs : null);
        } catch {
            // Fallback to localStorage if API fails
            try {
                const locJson = localStorage.getItem(getStorageKey(userId, "locations"));
                const prefJson = localStorage.getItem(getStorageKey(userId, "preferences"));
                const parsedLocations = locJson ? JSON.parse(locJson) : [];
                setLocations(
                    parsedLocations.filter(
                        (l: Location) => typeof l.lat === "number" && typeof l.lng === "number"
                    )
                );
                setPreferencesState(prefJson ? JSON.parse(prefJson) : null);
            } catch {
                setLocations([]);
                setPreferencesState(null);
            }
        }
    }, []);

    const addLocation = useCallback(
        (location: Omit<Location, "id">) => {
            const newLoc: Location = {
                ...location,
                id: crypto.randomUUID(),
            };
            setLocations((prev) => {
                const next = [...prev, newLoc];
                persistToApi(next, preferences);
                return next;
            });
        },
        [preferences, persistToApi]
    );

    const removeLocation = useCallback(
        (id: string) => {
            setLocations((prev) => {
                const next = prev.filter((l) => l.id !== id);
                persistToApi(next, preferences);
                return next;
            });
        },
        [preferences, persistToApi]
    );

    const updateLocation = useCallback(
        (id: string, updates: Partial<Pick<Location, "name" | "lat" | "lng" | "region">>) => {
            setLocations((prev) => {
                const next = prev.map((l) => (l.id === id ? { ...l, ...updates } : l));
                persistToApi(next, preferences);
                return next;
            });
        },
        [preferences, persistToApi]
    );

    const setPreferences = useCallback(
        (prefs: Preferences) => {
            setPreferencesState(prefs);
            persistToApi(locations, prefs);
        },
        [locations, persistToApi]
    );

    const isSetupComplete = locations.length > 0 && preferences !== null;
    const needsFullOnboarding = locations.length === 0 && preferences === null;

    const value = useMemo(
        () => ({
            locations,
            preferences,
            addLocation,
            removeLocation,
            updateLocation,
            setPreferences,
            isSetupComplete,
            needsFullOnboarding,
            loadForUser,
            clearForUser,
            isSaving,
        }),
        [
            locations,
            preferences,
            addLocation,
            removeLocation,
            updateLocation,
            setPreferences,
            isSetupComplete,
            needsFullOnboarding,
            loadForUser,
            clearForUser,
            isSaving,
        ]
    );

    return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

export function useSetup() {
    const ctx = useContext(SetupContext);
    if (!ctx) throw new Error("useSetup must be used within SetupProvider");
    return ctx;
}

export { defaultPreferences };
