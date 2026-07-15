import { useCallback, useEffect, useSyncExternalStore } from "react";

const DISMISS_KEY = "gowind_pwa_install_dismissed";
const SHOW_INSTALL_HELP_EVENT = "gowind:show-pwa-install";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallMode = "chromium" | "ios" | "manual";

type PwaInstallSnapshot = {
    deferredPrompt: BeforeInstallPromptEvent | null;
    visible: boolean;
    mode: InstallMode;
    installed: boolean;
    dismissed: boolean;
};

function isStandaloneDisplay(): boolean {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true;
}

function isIosDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function detectMode(hasNativePrompt: boolean): InstallMode {
    if (hasNativePrompt) return "chromium";
    if (isIosDevice()) return "ios";
    return "manual";
}

function readDismissed(): boolean {
    try {
        return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
        return false;
    }
}

function writeDismissed(value: boolean) {
    try {
        if (value) localStorage.setItem(DISMISS_KEY, "1");
        else localStorage.removeItem(DISMISS_KEY);
    } catch {
        /* ignore */
    }
}

let snapshot: PwaInstallSnapshot = {
    deferredPrompt: null,
    visible: false,
    mode: "manual",
    installed: false,
    dismissed: false,
};

const listeners = new Set<() => void>();
let bootstrapped = false;

function emit() {
    for (const listener of listeners) listener();
}

function setSnapshot(partial: Partial<PwaInstallSnapshot>) {
    snapshot = { ...snapshot, ...partial };
    emit();
}

function bootstrapPwaInstall() {
    if (bootstrapped || typeof window === "undefined") return;
    bootstrapped = true;

    const installed = isStandaloneDisplay();
    const dismissed = readDismissed();
    setSnapshot({
        installed,
        dismissed,
        mode: detectMode(false),
        visible: false,
    });

    if (installed) return;

    const onBeforeInstall = (event: Event) => {
        event.preventDefault();
        const promptEvent = event as BeforeInstallPromptEvent;
        setSnapshot({
            deferredPrompt: promptEvent,
            mode: "chromium",
            visible: !snapshot.dismissed,
        });
    };

    const onShowInstallHelp = () => {
        setSnapshot({
            mode: detectMode(Boolean(snapshot.deferredPrompt)),
            visible: true,
            dismissed: false,
        });
    };

    const onInstalled = () => {
        writeDismissed(true);
        setSnapshot({
            installed: true,
            visible: false,
            deferredPrompt: null,
            dismissed: true,
        });
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener(SHOW_INSTALL_HELP_EVENT, onShowInstallHelp);
    window.addEventListener("appinstalled", onInstalled);

    // Always surface a soft prompt — browsers rarely show a native install UI on their own.
    window.setTimeout(() => {
        if (snapshot.installed || snapshot.dismissed || snapshot.visible) return;
        setSnapshot({
            mode: detectMode(Boolean(snapshot.deferredPrompt)),
            visible: true,
        });
    }, 1200);
}

function subscribe(listener: () => void) {
    bootstrapPwaInstall();
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot() {
    bootstrapPwaInstall();
    return snapshot;
}

function getServerSnapshot(): PwaInstallSnapshot {
    return {
        deferredPrompt: null,
        visible: false,
        mode: "manual",
        installed: false,
        dismissed: false,
    };
}

export function usePwaInstall() {
    const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const dismiss = useCallback(() => {
        writeDismissed(true);
        setSnapshot({
            visible: false,
            dismissed: true,
            deferredPrompt: null,
        });
    }, []);

    const showHelp = useCallback(() => {
        writeDismissed(false);
        setSnapshot({
            mode: detectMode(Boolean(snapshot.deferredPrompt)),
            visible: true,
            dismissed: false,
        });
    }, []);

    const install = useCallback(async () => {
        const promptEvent = snapshot.deferredPrompt;
        if (!promptEvent) {
            showHelp();
            return;
        }
        await promptEvent.prompt();
        try {
            await promptEvent.userChoice;
        } catch {
            /* ignore */
        }
        writeDismissed(true);
        setSnapshot({
            deferredPrompt: null,
            visible: false,
            dismissed: true,
        });
    }, [showHelp]);

    // Keep React Strict Mode / remounts honest about standalone display.
    useEffect(() => {
        if (isStandaloneDisplay() && !snapshot.installed) {
            setSnapshot({ installed: true, visible: false });
        }
    }, []);

    return {
        visible: state.visible,
        mode: state.mode,
        install,
        dismiss,
        showHelp,
        canPrompt: Boolean(state.deferredPrompt),
        installed: state.installed,
        available: !state.installed,
    };
}

export function requestPwaInstallHelp() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(SHOW_INSTALL_HELP_EVENT));
}
