import { Navigate } from "react-router";
import { LocationsManager } from "@/components/location-picker/locations-manager";
import { OnboardingQuestionnaire } from "@/components/onboarding/onboarding-questionnaire";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";

export const Locations = () => {
    const { user, isLoading } = useAuth();
    const { needsFullOnboarding } = useSetup();

    if (!isLoading && !user) {
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
