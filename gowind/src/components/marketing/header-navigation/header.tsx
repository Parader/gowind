import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ChevronDown } from "@untitledui/icons";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { ThemeSwitcher } from "@/components/base/theme-switcher/theme-switcher";
import { GoWindLogo } from "@/components/foundations/logo/gowind-logo";
import { GoWindLogoMinimal } from "@/components/foundations/logo/gowind-logo-minimal";
import { HeaderProfileMenu } from "@/components/marketing/header-navigation/header-profile-menu";
import { useAuth } from "@/providers/auth-provider";
import { useSetup } from "@/providers/setup-provider";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

type HeaderNavItem = {
    label: string;
    href?: string;
    menu?: ReactNode;
};

const publicNavItems: HeaderNavItem[] = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
];

const legalNavItems: HeaderNavItem[] = [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
];

const MobileNavItem = (props: { className?: string; label: string; href?: string; children?: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (props.href) {
        return (
            <li>
                <NavLink
                    to={props.href}
                    className={({ isActive }) =>
                        cx(
                            "flex items-center justify-between px-4 py-3 text-md font-semibold hover:bg-primary_hover",
                            isActive ? "text-brand-600 dark:text-brand-400 bg-primary_hover" : "text-primary"
                        )
                    }
                >
                    {props.label}
                </NavLink>
            </li>
        );
    }

    return (
        <li className="flex flex-col gap-0.5">
            <button
                aria-expanded={isOpen}
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between px-4 py-3 text-md font-semibold text-primary hover:bg-primary_hover"
            >
                {props.label}{" "}
                <ChevronDown
                    className={cx("size-4 stroke-[2.625px] text-fg-quaternary transition duration-100 ease-linear", isOpen ? "-rotate-180" : "rotate-0")}
                />
            </button>
            {isOpen && <div>{props.children}</div>}
        </li>
    );
};

const MobileFooter = () => {
    const { user, isAdmin, isLoading, logout } = useAuth();
    const { needsFullOnboarding } = useSetup();

    return (
        <div className="flex flex-col gap-8 border-t border-secondary px-4 py-6">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-secondary">Theme</span>
                <ThemeSwitcher size="md" />
            </div>
            <div>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {legalNavItems.map((navItem) => (
                        <li key={navItem.label}>
                            <Button color="link-gray" size="lg" href={navItem.href}>
                                {navItem.label}
                            </Button>
                        </li>
                    ))}
                </ul>
            </div>
            {isLoading ? (
                <div className="h-10" aria-hidden="true" />
            ) : user ? (
                <div className="flex flex-col gap-3">
                    <NavLink
                        to="/go-time"
                        className={({ isActive }) =>
                            cx(
                                "rounded-lg px-4 py-2.5 text-md font-semibold transition",
                                isActive ? "bg-secondary text-brand-600 dark:text-brand-400" : "text-primary hover:bg-primary_hover"
                            )
                        }
                    >
                        Go Time
                    </NavLink>
                    {!needsFullOnboarding && (
                        <>
                            <NavLink
                                to="/locations"
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-lg px-4 py-2.5 text-md font-semibold transition",
                                        isActive ? "bg-secondary text-brand-600 dark:text-brand-400" : "text-primary hover:bg-primary_hover"
                                    )
                                }
                            >
                                Locations
                            </NavLink>
                            <NavLink
                                to="/preferences"
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-lg px-4 py-2.5 text-md font-semibold transition",
                                        isActive ? "bg-secondary text-brand-600 dark:text-brand-400" : "text-primary hover:bg-primary_hover"
                                    )
                                }
                            >
                                Preferences
                            </NavLink>
                        </>
                    )}
                    <NavLink
                        to="/account/settings"
                        className={({ isActive }) =>
                            cx(
                                "rounded-lg px-4 py-2.5 text-md font-semibold transition",
                                isActive ? "bg-secondary text-brand-600 dark:text-brand-400" : "text-primary hover:bg-primary_hover"
                            )
                        }
                    >
                        Account settings
                    </NavLink>
                    {isAdmin && (
                        <>
                            <NavLink
                                to="/data"
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-lg px-4 py-2.5 text-md font-semibold transition",
                                        isActive ? "bg-secondary text-brand-600 dark:text-brand-400" : "text-primary hover:bg-primary_hover"
                                    )
                                }
                            >
                                Data
                            </NavLink>
                            <NavLink
                                to="/admin"
                                className={({ isActive }) =>
                                    cx(
                                        "rounded-lg px-4 py-2.5 text-md font-semibold transition",
                                        isActive ? "bg-secondary text-brand-600 dark:text-brand-400" : "text-primary hover:bg-primary_hover"
                                    )
                                }
                            >
                                Admin
                            </NavLink>
                        </>
                    )}
                    <Button color="secondary" size="lg" onClick={() => logout()}>Log out</Button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <Button color="secondary" size="lg" href="/login">
                        Log in
                    </Button>
                </div>
            )}
        </div>
    );
};

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

const authenticatedNavItems: HeaderNavItem[] = [
    { label: "Go Time", href: "/go-time" },
    { label: "Locations", href: "/locations" },
    { label: "Preferences", href: "/preferences" },
];

const lightTextClass = "text-white";
const darkTextClass = "text-secondary";

export const Header = ({ items = publicNavItems, isFullWidth, isFloating, className }: HeaderProps) => {
    const headerRef = useRef<HTMLElement>(null);
    const overDarkBackground = useHeaderContrast(isFloating, headerRef);
    const lightContent = overDarkBackground;
    const { pathname } = useLocation();
    const { user, isAdmin, isLoading } = useAuth();
    const { needsFullOnboarding } = useSetup();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileHeaderHidden, setMobileHeaderHidden] = useState(false);
    const setupNavItems = needsFullOnboarding
        ? authenticatedNavItems.filter((item) => item.href === "/go-time")
        : authenticatedNavItems;
    const adminNavItems: HeaderNavItem[] = isAdmin ? [{ label: "Data", href: "/data" }] : [];
    const navItems = user ? [...setupNavItems, ...adminNavItems, ...items] : items;

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
                        <Link to="/" className="flex shrink-0">
                            <GoWindLogo variant={lightContent ? "light" : "dark"} className="h-8 md:max-lg:hidden" />
                            <GoWindLogoMinimal variant={lightContent ? "light" : "dark"} className="hidden h-8 md:inline-block lg:hidden" />
                        </Link>

                        {/* Desktop navigation */}
                        <nav className="max-md:hidden">
                            <ul className="flex items-center gap-0.5">
                                {navItems.map((navItem) => (
                                    <li key={navItem.label}>
                                        {navItem.menu ? (
                                            <AriaDialogTrigger>
                                                <AriaButton className={cx("flex cursor-pointer items-center gap-0.5 rounded-lg px-1.5 py-1 text-md font-semibold outline-focus-ring transition duration-100 ease-linear focus-visible:outline-2 focus-visible:outline-offset-2", lightContent ? "text-white hover:text-white/80" : "text-secondary hover:text-secondary_hover")}>
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
                                                        "flex cursor-pointer items-center gap-0.5 rounded-lg px-1.5 py-1 text-md font-semibold outline-focus-ring transition duration-100 ease-linear focus:outline-offset-2 focus-visible:outline-2",
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
                        <ThemeSwitcher size={isFloating ? "sm" : "md"} />
                        {isLoading ? (
                            <div className="size-10" aria-hidden="true" />
                        ) : user ? (
                            <HeaderProfileMenu size={isFloating ? "sm" : "md"} />
                        ) : (
                            <Button color="secondary" size={isFloating ? "md" : "lg"} href="/login">
                                Log in
                            </Button>
                        )}
                    </div>

                    {/* Mobile profile when logged in */}
                    {!isLoading && user && (
                        <div className="flex items-center gap-2 md:hidden">
                            <HeaderProfileMenu size="sm" />
                        </div>
                    )}

                    {/* Mobile menu and menu trigger */}
                    <AriaDialogTrigger isOpen={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <AriaButton
                            aria-label="Toggle navigation menu"
                            className={({ isFocusVisible, isHovered }) =>
                                cx(
                                    "group ml-auto cursor-pointer rounded-lg p-2 md:hidden",
                                    isHovered && "bg-primary_hover",
                                    isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                                )
                            }
                        >
                            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path
                                    className={cx("hidden group-aria-expanded:block", lightContent ? "text-white" : "text-secondary")}
                                    d="M18 6L6 18M6 6L18 18"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path
                                    className={cx("group-aria-expanded:hidden", lightContent ? "text-white" : "text-secondary")}
                                    d="M3 12H21M3 6H21M3 18H21"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </AriaButton>
                        <AriaPopover
                            triggerRef={headerRef}
                            className="h-calc(100%-72px) scrollbar-hide w-full overflow-y-auto shadow-lg md:hidden"
                            offset={0}
                            crossOffset={20}
                            containerPadding={0}
                            placement="bottom left"
                        >
                            <AriaDialog className="outline-hidden">
                                <nav className="w-full bg-primary shadow-lg">
                                    <ul className="flex flex-col gap-0.5 py-5">
                                        {navItems.map((navItem) =>
                                            navItem.menu ? (
                                                <MobileNavItem key={navItem.label} label={navItem.label}>
                                                    {navItem.menu}
                                                </MobileNavItem>
                                            ) : (
                                                <MobileNavItem key={navItem.label} label={navItem.label} href={navItem.href} />
                                            ),
                                        )}
                                    </ul>

                                    <MobileFooter />
                                </nav>
                            </AriaDialog>
                        </AriaPopover>
                    </AriaDialogTrigger>
                </div>
            </div>
        </header>
    );
};
