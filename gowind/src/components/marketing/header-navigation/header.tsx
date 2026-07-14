import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ChevronDown } from "@untitledui/icons";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { LanguageSwitcher } from "@/components/base/language-switcher/language-switcher";
import { ThemeSwitcher } from "@/components/base/theme-switcher/theme-switcher";
import { GoWindLogo } from "@/components/foundations/logo/gowind-logo";
import { GoWindLogoMinimal } from "@/components/foundations/logo/gowind-logo-minimal";
import { HeaderMobileMenu } from "@/components/marketing/header-navigation/header-mobile-menu";
import { HeaderProfileMenu } from "@/components/marketing/header-navigation/header-profile-menu";
import { MARKETING_HOME_PATH } from "@/lib/paths";
import { getCachedAuthUser, useAuth } from "@/providers/auth-provider";
import { useLocale } from "@/providers/locale-provider";
import { useSetup } from "@/providers/setup-provider";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

type HeaderNavItem = {
    label: string;
    href?: string;
    menu?: ReactNode;
};

const publicNavHrefs = [
    { href: MARKETING_HOME_PATH },
    { href: "/about" },
] as const;

const authenticatedNavHrefs = [
    { href: "/go-time" },
    { href: "/locations" },
    { href: "/preferences" },
] as const;

interface HeaderProps {
    items?: HeaderNavItem[];
    isFullWidth?: boolean;
    isFloating?: boolean;
    className?: string;
}

/**
 * `data-header-contrast="light"` — use **white** header chrome (white logo & links). Only tag sections where you want that;
 * all other floating rows use **dark** header chrome (foreground logo & links).
 */
function isProbeInLightNavSection(probeX: number, probeY: number): boolean {
    const root = document.querySelector("main") ?? document.body;
    const sections = root.querySelectorAll('[data-header-contrast="light"]');
    const matches: Element[] = [];
    for (const el of sections) {
        const r = el.getBoundingClientRect();
        if (probeX >= r.left && probeX <= r.right && probeY >= r.top && probeY <= r.bottom) {
            matches.push(el);
        }
    }
    return matches.length > 0;
}

const LIGHT_PAGE_ROUTES = ["/go-time", "/locations", "/preferences", "/data", "/about", "/login", "/signup", "/account", "/admin", "/privacy", "/terms"];

function useHeaderContrast(isFloating: boolean | undefined, headerRef: RefObject<HTMLElement | null>) {
    const [overDarkBackground, setOverDarkBackground] = useState(false);
    const { pathname } = useLocation();
    const { theme } = useTheme();
    const [systemDark, setSystemDark] = useState(
        () => (typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false),
    );

    const isDarkMode = theme === "dark" || (theme === "system" && systemDark);
    const isLightPage = LIGHT_PAGE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

    useEffect(() => {
        if (theme !== "system") return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = () => setSystemDark(mq.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [theme]);

    useEffect(() => {
        if (isDarkMode) {
            setOverDarkBackground(true);
            return;
        }
        if (!isFloating || isLightPage) {
            setOverDarkBackground(false);
            return;
        }

        const check = () => {
            const centerX = window.innerWidth / 2;
            const rect = headerRef.current?.getBoundingClientRect();
            const headerBottom = rect != null && rect.height > 0 ? rect.bottom : isFloating ? 76 : 88;
            /**
             * Sample the vertical middle of the header strip — matches what shows through the glass
             * (using only the row below the header often missed the tagged section at scroll boundaries).
             */
            const midHeaderY =
                rect != null && rect.height > 0
                    ? (rect.top + rect.bottom) / 2
                    : Math.min(Math.max(headerBottom / 2, 1), window.innerHeight - 2);
            const primaryY = Math.min(Math.max(midHeaderY, 1), window.innerHeight - 2);

            const lightNav = isProbeInLightNavSection(centerX, primaryY);
            /** `overDarkBackground` = light nav (white logo/links) when true. */
            setOverDarkBackground(lightNav);
        };

        check();
        const raf = requestAnimationFrame(() => check());
        const timeout = window.setTimeout(check, 100);
        window.addEventListener("scroll", check, { passive: true });
        window.addEventListener("resize", check);
        const observer = new ResizeObserver(check);
        observer.observe(document.documentElement);
        if (headerRef.current) observer.observe(headerRef.current);

        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(timeout);
            window.removeEventListener("scroll", check);
            window.removeEventListener("resize", check);
            observer.disconnect();
        };
    }, [isFloating, isDarkMode, isLightPage, headerRef, pathname]);

    return overDarkBackground;
}

const navLabelKey: Record<string, string> = {
    "/": "common.nav.home",
    [MARKETING_HOME_PATH]: "common.nav.home",
    "/about": "common.nav.about",
    "/go-time": "common.nav.goTime",
    "/locations": "common.nav.locations",
    "/preferences": "common.nav.preferences",
    "/data": "common.nav.data",
    "/admin": "common.nav.admin",
};

function hrefToNavItem(href: string, t: (key: string) => string): HeaderNavItem {
    return { href, label: t(navLabelKey[href] ?? href) };
}

const lightTextClass = "text-white";
const darkTextClass = "text-secondary";

export const Header = ({ items, isFullWidth, isFloating, className }: HeaderProps) => {
    const { t } = useLocale();
    const headerRef = useRef<HTMLElement>(null);
    const overDarkBackground = useHeaderContrast(isFloating, headerRef);
    const lightContent = overDarkBackground;
    const { pathname } = useLocation();
    const { user, isAdmin, isLoading, logout } = useAuth();
    const { needsFullOnboarding } = useSetup();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false);
    const effectiveUser = user ?? (isLoading ? getCachedAuthUser() : null);

    const publicNavItems = publicNavHrefs.map(({ href }) => hrefToNavItem(href, t));
    const authenticatedNavItems = authenticatedNavHrefs.map(({ href }) => hrefToNavItem(href, t));
    const extraItems = items ?? publicNavItems;

    const setupNavItems = needsFullOnboarding
        ? authenticatedNavItems.filter((item) => item.href === "/go-time")
        : authenticatedNavItems;
    const adminNavItems: HeaderNavItem[] = isAdmin
        ? [hrefToNavItem("/data", t), hrefToNavItem("/admin", t)]
        : [];
    const navItems = effectiveUser ? [...setupNavItems, ...adminNavItems, ...extraItems] : extraItems;
    const mobileAppNavItems = setupNavItems
        .concat(adminNavItems)
        .filter((item): item is HeaderNavItem & { href: string } => Boolean(item.href))
        .map((item) => ({ label: item.label, href: item.href }));

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        let lastY = window.scrollY;
        const handleScroll = () => {
            if (window.innerWidth >= 768) {
                setMobileHeaderHidden(false);
                lastY = window.scrollY;
                return;
            }

            const currentY = window.scrollY;
            const delta = currentY - lastY;
            if (mobileMenuOpen || currentY < 24) {
                setMobileHeaderHidden(false);
            } else if (delta > 8) {
                setMobileHeaderHidden(true);
            } else if (delta < -8) {
                setMobileHeaderHidden(false);
            }
            lastY = currentY;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleScroll);
        handleScroll();
        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleScroll);
        };
    }, [mobileMenuOpen]);

    return (
        <header
            ref={headerRef}
            className={cx(
                "sticky top-0 z-50 flex h-18 w-full items-center justify-center bg-primary shadow-sm transition-transform duration-200 ease-out md:h-20 md:bg-transparent md:shadow-none",
                isFloating && "h-16 md:h-19 md:pt-3",
                isFullWidth && !isFloating ? "has-aria-expanded:bg-primary" : "max-md:has-aria-expanded:bg-primary",
                mobileHeaderHidden && "-translate-y-full md:translate-y-0",
                className,
            )}
        >
            <div className="flex size-full max-w-container flex-1 items-center justify-center pr-3 pl-4 md:px-8">
                <div
                    className={cx(
                        "flex w-full justify-between gap-4 transition-[background-color,backdrop-filter] duration-200 ease-out max-md:bg-primary",
                        isFloating && "ring-secondary_alt md:rounded-2xl md:py-3 md:pr-3 md:pl-4 md:ring-1",
                        isFloating && "md:glass",
                    )}
                >
                    <div className="flex flex-1 items-center gap-5">
                        <Link to={MARKETING_HOME_PATH} className="flex shrink-0">
                            <GoWindLogo variant={lightContent ? "light" : "dark"} className="h-8 md:max-lg:hidden" />
                            <GoWindLogoMinimal variant={lightContent ? "light" : "dark"} className="hidden h-8 md:inline-block lg:hidden" />
                        </Link>

                        {/* Desktop navigation */}
                        <nav className="max-md:hidden">
                            <ul className="flex items-center gap-0.5">
                                {navItems.map((navItem) => (
                                    <li key={navItem.href ?? navItem.label}>
                                        {navItem.menu ? (
                                            <AriaDialogTrigger>
                                                <AriaButton className={cx("flex cursor-pointer items-center gap-0.5 whitespace-nowrap rounded-lg px-1.5 py-1 text-md font-semibold outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2", lightContent ? "text-white hover:text-white/80" : "text-secondary hover:text-secondary_hover")}>
                                                    <span className="px-0.5">{navItem.label}</span>

                                                    <ChevronDown className={cx("size-4 rotate-0 stroke-[2.625px] transition duration-100 ease-linear in-aria-expanded:-rotate-180", lightContent ? "text-white/80" : "text-fg-quaternary")} />
                                                </AriaButton>

                                                <AriaPopover
                                                    className={({ isEntering, isExiting }) =>
                                                        cx(
                                                            "hidden origin-top will-change-transform md:block",
                                                            isFullWidth && "w-full",
                                                            isEntering && "duration-200 ease-out animate-in fade-in slide-in-from-top-1",
                                                            isExiting && "duration-150 ease-in animate-out fade-out slide-out-to-top-1",
                                                        )
                                                    }
                                                    offset={isFloating || isFullWidth ? 0 : 8}
                                                    containerPadding={0}
                                                    triggerRef={(isFloating && isFullWidth) || isFullWidth ? headerRef : undefined}
                                                >
                                                    {({ isEntering, isExiting }) => (
                                                        <AriaDialog
                                                            className={cx(
                                                                "mx-auto origin-top outline-hidden",
                                                                isFloating && "max-w-7xl px-8 pt-3",
                                                                // Have to use the scale animation inside the popover to avoid
                                                                // miscalculating the popover's position when opening.
                                                                isEntering && !isFullWidth && "duration-200 ease-out animate-in zoom-in-95",
                                                                isExiting && !isFullWidth && "duration-150 ease-in animate-out zoom-out-95",
                                                            )}
                                                        >
                                                            {navItem.menu}
                                                        </AriaDialog>
                                                    )}
                                                </AriaPopover>
                                            </AriaDialogTrigger>
                                        ) : (
                                            <NavLink
                                                to={navItem.href ?? "/"}
                                                className={({ isActive }) =>
                                                    cx(
                                                        "flex cursor-pointer items-center gap-0.5 whitespace-nowrap rounded-lg px-1.5 py-1 text-md font-semibold outline-focus-ring transition duration-100 ease-linear focus:outline-offset-2 focus-visible:outline-2",
                                                        lightContent ? "hover:text-white/80" : "hover:text-secondary_hover",
                                                        isActive ? "text-brand-600 dark:text-brand-400" : lightContent ? lightTextClass : darkTextClass
                                                    )
                                                }
                                            >
                                                <span className="px-0.5">{navItem.label}</span>
                                            </NavLink>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </div>

                    <div className="hidden items-center gap-2 md:flex">
                        <LanguageSwitcher compact lightIcon={lightContent} size={isFloating ? "sm" : "md"} />
                        <ThemeSwitcher lightIcon={lightContent} size={isFloating ? "sm" : "md"} />
                        {isLoading && !effectiveUser ? (
                            <div className="size-10" aria-hidden="true" />
                        ) : effectiveUser ? (
                            <HeaderProfileMenu size={isFloating ? "sm" : "md"} />
                        ) : (
                            <Button color="secondary" size={isFloating ? "md" : "lg"} href="/login">
                                {t("common.nav.logIn")}
                            </Button>
                        )}
                    </div>

                    <HeaderMobileMenu
                        isOpen={mobileMenuOpen}
                        onOpenChange={setMobileMenuOpen}
                        appNavItems={mobileAppNavItems}
                        effectiveUser={effectiveUser}
                        isLoading={isLoading}
                        onLogout={() => void logout()}
                        lightTrigger={lightContent}
                    />
                </div>
            </div>
        </header>
    );
};
