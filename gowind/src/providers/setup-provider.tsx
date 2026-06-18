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
    /** True until the user finishes the setup wizard (review) with at least one location saved. */
    needsFullOnboarding: boolean;
    completeOnboarding: () => void;
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
    const [onboardingComplete, setOnboardingComplete] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const persistToApi = useCallback(
        async (locs: Location[], prefs: Preferences | null, wizardComplete?: boolean) => {
            if (!currentUserId) return;
            setIsSaving(true);
            const completeFlag = wizardComplete ?? onboardingComplete;
            try {
                await setupApi.putSetup(locs, prefs, completeFlag);
            } catch {
                // Fallback to localStorage if API fails
                try {
                    localStorage.setItem(getStorageKey(currentUserId, "locations"), JSON.stringify(locs));
                    localStorage.setItem(getStorageKey(currentUserId, "preferences"), JSON.stringify(prefs ?? {}));
                    localStorage.setItem(
                        getStorageKey(currentUserId, "onboarding"),
                        completeFlag ? "1" : "0",
                    );
                } catch {
                    /* ignore */
                }
            } finally {
                setIsSaving(false);
            }
        },
        [currentUserId, onboardingComplete]
    );

    const clearForUser = useCallback(() => {
        setCurrentUserId(null);
        setLocations([]);
        setPreferencesState(null);
        setOnboardingComplete(false);
    }, []);

    const loadForUser = useCallback(async (userId: string) => {
        setCurrentUserId(userId);
        try {
            const { locations: locs, preferences: prefs, onboardingComplete: complete } = await setupApi.getSetup();
            const validLocs = (locs ?? []).filter(
                (l): l is Location => l && typeof l.lat === "number" && typeof l.lng === "number"
            );
            setLocations(validLocs);
            setPreferencesState(prefs && typeof prefs === "object" ? prefs : null);
            setOnboardingComplete(complete === true);
        } catch {
            // Fallback to localStorage if API fails
            try {
                const locJson = localStorage.getItem(getStorageKey(userId, "locations"));
                const prefJson = localStorage.getItem(getStorageKey(userId, "preferences"));
                const onboardingFlag = localStorage.getItem(getStorageKey(userId, "onboarding"));
                const parsedLocations = locJson ? JSON.parse(locJson) : [];
                setLocations(
                    parsedLocations.filter(
                        (l: Location) => typeof l.lat === "number" && typeof l.lng === "number"
                    )
                );
                setPreferencesState(prefJson ? JSON.parse(prefJson) : null);
                setOnboardingComplete(onboardingFlag === "1");
            } catch {
                setLocations([]);
                setPreferencesState(null);
                setOnboardingComplete(false);
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

    const completeOnboarding = useCallback(() => {
        setOnboardingComplete(true);
        persistToApi(locations, preferences, true);
    }, [locations, preferences, persistToApi]);

    const isSetupComplete = locations.length > 0 && preferences !== null;
    const needsFullOnboarding = !onboardingComplete || !isSetupComplete;

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
            completeOnboarding,
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
            completeOnboarding,
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
