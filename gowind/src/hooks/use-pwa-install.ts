import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "gowind_pwa_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandaloneDisplay(): boolean {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true;
}

function isIosSafari(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isWebkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isIOS && isWebkit;
}

function wasDismissed(): boolean {
    try {
        return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
        return false;
    }
}

export function usePwaInstall() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState<"chromium" | "ios" | null>(null);

    useEffect(() => {
        if (isStandaloneDisplay() || wasDismissed()) return;

        const onBeforeInstall = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
            setMode("chromium");
            setVisible(true);
        };

        window.addEventListener("beforeinstallprompt", onBeforeInstall);

        // iOS never fires beforeinstallprompt — show a short Add to Home Screen tip.
        let iosTimer: number | undefined;
        if (isIosSafari()) {
            iosTimer = window.setTimeout(() => {
                if (isStandaloneDisplay() || wasDismissed()) return;
                setMode("ios");
                setVisible(true);
            }, 2500);
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", onBeforeInstall);
            if (iosTimer) window.clearTimeout(iosTimer);
        };
    }, []);

    const dismiss = useCallback(() => {
        try {
            localStorage.setItem(DISMISS_KEY, "1");
        } catch {
            /* ignore */
        }
        setVisible(false);
        setDeferredPrompt(null);
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        try {
            await deferredPrompt.userChoice;
        } catch {
            /* ignore */
        }
        setDeferredPrompt(null);
        setVisible(false);
        try {
            localStorage.setItem(DISMISS_KEY, "1");
        } catch {
            /* ignore */
        }
    }, [deferredPrompt]);

    return {
        visible,
        mode,
        install,
        dismiss,
        canPrompt: Boolean(deferredPrompt),
    };
}
