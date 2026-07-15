import { Outlet, useLocation } from "react-router";
import { PwaInstallBanner } from "@/components/application/pwa-install-banner";
import { Footer } from "@/components/marketing/footer/footer";
import { Header } from "@/components/marketing/header-navigation/header";
import {
    APP_BACKGROUND_IMAGE,
    APP_BACKGROUND_IMAGE_OPACITY,
    APP_BACKGROUND_SCRIM_OPACITY,
} from "@/config/app-background";

const sharedNavItems = [{ label: "About", href: "/about" }];

export const AppLayout = () => {
    const { pathname } = useLocation();
    const showAppBackground = pathname !== "/";

    return (
        <div
            className={
                showAppBackground
                    ? "relative flex min-h-screen flex-col"
                    : "flex min-h-screen flex-col bg-primary"
            }
        >
            {showAppBackground && (
                <>
                    <div
                        aria-hidden
                        className="pointer-events-none fixed inset-0 z-0 bg-primary"
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none fixed inset-0 z-[1] bg-cover bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${APP_BACKGROUND_IMAGE})`,
                            opacity: APP_BACKGROUND_IMAGE_OPACITY,
                        }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none fixed inset-0 z-[2] bg-primary"
                        style={{ opacity: APP_BACKGROUND_SCRIM_OPACITY }}
                    />
                </>
            )}

            <div className="relative z-10 flex min-h-screen flex-col">
                <Header items={sharedNavItems} isFullWidth isFloating />
                <div className="min-h-[70vh] flex-1">
                    <Outlet />
                </div>
                <Footer />
            </div>
            <PwaInstallBanner />
        </div>
    );
};
