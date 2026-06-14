import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";

export function SetupLoader({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { loadForUser, clearForUser } = useSetup();

    useEffect(() => {
        if (user?.id) {
            loadForUser(user.id);
        } else {
            clearForUser();
        }
    }, [user?.id, loadForUser, clearForUser]);

    return <>{children}</>;
}
