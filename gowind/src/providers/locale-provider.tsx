import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { interpolate } from "@/i18n/interpolate";
import { en } from "@/i18n/messages/en";
import { fr } from "@/i18n/messages/fr";
import { resolveMessage } from "@/i18n/resolve";
import type { Locale, Messages } from "@/i18n/types";

export type { Locale };

const STORAGE_KEY = "ui-locale";

const catalogs: Record<Locale, Messages> = { en, fr };

export type TranslateParams = Record<string, string | number>;

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: TranslateParams) => string;
    dateLocale: string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

function detectInitialLocale(): Locale {
    if (typeof window === "undefined") return "en";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr") return saved;
    const browser = navigator.language.toLowerCase();
    if (browser.startsWith("fr")) return "fr";
    return "en";
}

export const useLocale = (): LocaleContextType => {
    const ctx = useContext(LocaleContext);
    if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
    return ctx;
};

/** Shorthand for `useLocale().t` */
export const useT = () => useLocale().t;

interface LocaleProviderProps {
    children: ReactNode;
}

export const LocaleProvider = ({ children }: LocaleProviderProps) => {
    const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

    const setLocale = useCallback((next: Locale) => {
        setLocaleState(next);
        localStorage.setItem(STORAGE_KEY, next);
    }, []);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    const t = useCallback(
        (key: string, params?: TranslateParams): string => {
            const messages = catalogs[locale];
            const value = resolveMessage(messages, key) ?? resolveMessage(catalogs.en, key);
            if (value == null) {
                if (import.meta.env.DEV) console.warn(`Missing translation: ${key}`);
                return key;
            }
            return interpolate(value, params);
        },
        [locale],
    );

    const dateLocale = locale === "fr" ? "fr-CA" : "en-CA";

    const value = useMemo(
        () => ({ locale, setLocale, t, dateLocale }),
        [locale, setLocale, t, dateLocale],
    );

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};
