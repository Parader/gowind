import { Navigate } from "react-router";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { LocationsManager } from "@/components/location-picker/locations-manager";
import { OnboardingQuestionnaire } from "@/components/onboarding/onboarding-questionnaire";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";
import { useT } from "@/providers/locale-provider";

export const Locations = () => {
    const t = useT();
    const { user, isLoading } = useAuth();
    const { needsFullOnboarding } = useSetup();

    if (isLoading) {
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
                <LocationsManager />
            </div>
        </main>
    );
};
