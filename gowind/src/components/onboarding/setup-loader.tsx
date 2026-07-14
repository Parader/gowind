import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";

/**
 * Syncs setup state with auth. Waits until auth finishes loading so a failed
 * `/auth/me` never leaves stale setup that can flash the onboarding wizard.
 */
export function SetupLoader({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth();
    const { loadForUser, clearForUser } = useSetup();

    useEffect(() => {
        if (isLoading) return;
        if (user?.id) {
            loadForUser(user.id);
        } else {
            clearForUser();
        }
    }, [isLoading, user?.id, loadForUser, clearForUser]);

    return <>{children}</>;
}
