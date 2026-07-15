import { useState, useRef, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import {
    PreferencesForm,
    type PreferencesFormHandle,
} from "@/components/preferences/preferences-form";
import {
    PREF_SUBSTEPS,
    PreferencesSubstepLayout,
} from "@/components/preferences/preferences-substep-layout";
import { OnboardingQuestionnaire } from "@/components/onboarding/onboarding-questionnaire";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";
import { useT } from "@/providers/locale-provider";

function initialSubIndexFromUrl(searchParams: URLSearchParams): number {
    const raw = searchParams.get("section");
    const idx = PREF_SUBSTEPS.findIndex((p) => p.section === raw);
    return idx >= 0 ? idx : 0;
}

export const Preferences = () => {
    const t = useT();
    const { user, isLoading, hasSession } = useAuth();
    const { needsFullOnboarding } = useSetup();
    const [searchParams, setSearchParams] = useSearchParams();
    const [prefSubIndex, setPrefSubIndex] = useState(() =>
        initialSubIndexFromUrl(searchParams)
    );
    const formRef = useRef<PreferencesFormHandle>(null);

    useEffect(() => {
        const section = PREF_SUBSTEPS[prefSubIndex].section;
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                if (next.get("section") === section) return prev;
                next.set("section", section);
                return next;
            },
            { replace: true }
        );
    }, [prefSubIndex, setSearchParams]);

    const jumpToPrefSubstep = (i: number) => {
        formRef.current?.flushSave();
        setPrefSubIndex(i);
    };

    if (isLoading || (hasSession && !user)) {
        return (
            <main className="flex flex-1 items-center justify-center px-4 py-16">
                <LoadingIndicator type="dot-circle" size="lg" label={t("common.actions.loading")} />
            </main>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (needsFullOnboarding) {
        return <OnboardingQuestionnaire />;
    }

    return (
        <main className="flex-1">
            <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
                <PreferencesSubstepLayout
                    activeIndex={prefSubIndex}
                    onSelectSubstep={jumpToPrefSubstep}
                    title={t("preferences.page.title")}
                    description={t("preferences.page.descriptionAutoSave")}
                >
                    <PreferencesForm
                        ref={formRef}
                        embedded
                        embeddedLockedSection={PREF_SUBSTEPS[prefSubIndex].section}
                    />
                </PreferencesSubstepLayout>
            </div>
        </main>
    );
};
