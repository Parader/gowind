import type { FC } from "react";
import {
    BarChartSquare02,
    Download01,
    Home02,
    InfoCircle,
    LogOut01,
    Map01,
    Menu02,
    Settings01,
    Shield01,
    Sliders01,
    Stars01,
    X,
} from "@untitledui/icons";
import {
    Button as AriaButton,
    Dialog as AriaDialog,
    DialogTrigger as AriaDialogTrigger,
    Modal as AriaModal,
    ModalOverlay as AriaModalOverlay,
} from "react-aria-components";
import { AvatarLabelGroup } from "@/components/base/avatar/avatar-label-group";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { LanguageSwitcher } from "@/components/base/language-switcher/language-switcher";
import { ThemeSwitcher } from "@/components/base/theme-switcher/theme-switcher";
import { GoWindLogo } from "@/components/foundations/logo/gowind-logo";
import type { User } from "@/api/auth";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { MARKETING_HOME_PATH } from "@/lib/paths";
import { useT } from "@/providers/locale-provider";
import { cx } from "@/utils/cx";

type MobileNavLink = {
    label: string;
    href: string;
    icon?: FC<{ className?: string }>;
};

const legalNavHrefs = ["/privacy", "/terms"] as const;

const publicNavItems: { href: string; icon: FC<{ className?: string }> }[] = [
    { href: MARKETING_HOME_PATH, icon: Home02 },
    { href: "/about", icon: InfoCircle },
];

const legalLabelKey: Record<string, string> = {
    "/privacy": "common.legal.privacy",
    "/terms": "common.legal.terms",
};

const publicLabelKey: Record<string, string> = {
    "/": "common.nav.home",
    [MARKETING_HOME_PATH]: "common.nav.home",
    "/about": "common.nav.about",
};

const appNavIcons: Record<string, FC<{ className?: string }>> = {
    "/go-time": Stars01,
    "/locations": Map01,
    "/preferences": Sliders01,
    "/data": BarChartSquare02,
    "/admin": Shield01,
};

interface HeaderMobileMenuProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    appNavItems: MobileNavLink[];
    effectiveUser: User | null;
    isLoading: boolean;
    onLogout: () => void;
    triggerClassName?: string;
    lightTrigger?: boolean;
}

export const HeaderMobileMenu = ({
    isOpen,
    onOpenChange,
    appNavItems,
    effectiveUser,
    isLoading,
    onLogout,
    triggerClassName,
    lightTrigger,
}: HeaderMobileMenuProps) => {
    const t = useT();
    const { install, available } = usePwaInstall();
    const close = () => onOpenChange(false);

    const appItems = appNavItems.map((item) => ({
        ...item,
        icon: item.icon ?? appNavIcons[item.href],
    }));

    return (
        <AriaDialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
            <AriaButton
                aria-label={t("common.mobileMenu.open")}
                className={({ isFocusVisible, isHovered }) =>
                    cx(
                        "group relative ml-auto cursor-pointer rounded-lg p-2 md:hidden",
                        isHovered && "bg-primary_hover",
                        isFocusVisible && "outline-2 outline-offset-2 outline-focus-ring",
                        triggerClassName,
                    )
                }
            >
                <Menu02
                    className={cx(
                        "size-6 transition duration-200 ease-in-out group-aria-expanded:opacity-0",
                        lightTrigger ? "text-white" : "text-secondary",
                    )}
                />
                <X
                    className={cx(
                        "absolute size-6 opacity-0 transition duration-200 ease-in-out group-aria-expanded:opacity-100",
                        lightTrigger ? "text-white" : "text-secondary",
                    )}
                />
            </AriaButton>

            <AriaModalOverlay
                isDismissable
                className={({ isEntering, isExiting }) =>
                    cx(
                        "fixed inset-0 z-50 cursor-pointer bg-overlay/70 pr-16 backdrop-blur-md md:hidden",
                        isEntering && "duration-300 ease-in-out animate-in fade-in",
                        isExiting && "duration-200 ease-in-out animate-out fade-out",
                    )
                }
            >
                {({ state }) => (
                    <>
                        <AriaButton
                            aria-label={t("common.mobileMenu.close")}
                            onPress={() => state.close()}
                            className="fixed top-3 right-2 z-[60] flex cursor-pointer items-center justify-center rounded-lg p-2 text-fg-white/80 outline-focus-ring hover:bg-white/10 hover:text-fg-white focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <X className="size-6" />
                        </AriaButton>

                        <AriaModal className="w-full cursor-auto will-change-transform md:hidden">
                            <AriaDialog className="flex h-dvh flex-col bg-primary outline-hidden focus:outline-hidden md:hidden">
                                <div className="flex shrink-0 items-center border-b border-secondary px-4 py-3">
                                    <GoWindLogo className="h-8" />
                                </div>

                                <div className="min-h-0 flex-1 overflow-y-auto">
                                    {effectiveUser ? (
                                        <div className="border-b border-secondary px-4 py-4">
                                            <AvatarLabelGroup
                                                size="md"
                                                src={effectiveUser.image}
                                                title={effectiveUser.name ?? effectiveUser.email}
                                                subtitle={effectiveUser.name ? effectiveUser.email : ""}
                                                initials={
                                                    effectiveUser.name
                                                        ? effectiveUser.name
                                                              .split(" ")
                                                              .map((part) => part[0])
                                                              .join("")
                                                              .slice(0, 2)
                                                              .toUpperCase()
                                                        : effectiveUser.email.slice(0, 2).toUpperCase()
                                                }
                                            />
                                        </div>
                                    ) : null}

                                    <Dropdown.Menu selectionMode="none" disallowEmptySelection={false} className="py-2">
                                        {appItems.length > 0 ? (
                                            <Dropdown.Section>
                                                <Dropdown.SectionHeader className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-tertiary uppercase">
                                                    {t("common.mobileMenu.sections.app")}
                                                </Dropdown.SectionHeader>
                                                {appItems.map((item) => (
                                                    <Dropdown.Item
                                                        key={item.href}
                                                        href={item.href}
                                                        icon={item.icon}
                                                        onAction={close}
                                                    >
                                                        {item.label}
                                                    </Dropdown.Item>
                                                ))}
                                            </Dropdown.Section>
                                        ) : null}

                                        <Dropdown.Section>
                                            {appItems.length > 0 ? <Dropdown.Separator /> : null}
                                            <Dropdown.SectionHeader className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-tertiary uppercase">
                                                {t("common.mobileMenu.sections.site")}
                                            </Dropdown.SectionHeader>
                                            {publicNavItems.map((item) => (
                                                <Dropdown.Item
                                                    key={item.href}
                                                    href={item.href}
                                                    icon={item.icon}
                                                    onAction={close}
                                                >
                                                    {t(publicLabelKey[item.href] ?? item.href)}
                                                </Dropdown.Item>
                                            ))}
                                        </Dropdown.Section>

                                        {effectiveUser ? (
                                            <Dropdown.Section>
                                                <Dropdown.Separator />
                                                <Dropdown.SectionHeader className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-tertiary uppercase">
                                                    {t("common.mobileMenu.sections.account")}
                                                </Dropdown.SectionHeader>
                                                <Dropdown.Item
                                                    href="/account/settings"
                                                    icon={Settings01}
                                                    onAction={close}
                                                >
                                                    {t("common.nav.accountSettings")}
                                                </Dropdown.Item>
                                                {!available ? null : (
                                                    <Dropdown.Item
                                                        icon={Download01}
                                                        onAction={() => {
                                                            close();
                                                            void install();
                                                        }}
                                                    >
                                                        {t("pwaInstall.install")}
                                                    </Dropdown.Item>
                                                )}
                                                <Dropdown.Item icon={LogOut01} onAction={() => { close(); onLogout(); }}>
                                                    {t("common.nav.logOut")}
                                                </Dropdown.Item>
                                            </Dropdown.Section>
                                        ) : null}

                                        <Dropdown.Section>
                                            <Dropdown.Separator />
                                            <Dropdown.SectionHeader className="px-4 pt-2 pb-1 text-xs font-semibold tracking-wide text-tertiary uppercase">
                                                {t("common.mobileMenu.sections.legal")}
                                            </Dropdown.SectionHeader>
                                            {legalNavHrefs.map((href) => (
                                                <Dropdown.Item key={href} href={href} onAction={close}>
                                                    {t(legalLabelKey[href] ?? href)}
                                                </Dropdown.Item>
                                            ))}
                                        </Dropdown.Section>
                                    </Dropdown.Menu>
                                </div>

                                <div className="shrink-0 border-t border-secondary px-4 py-4">
                                    <div className="flex flex-col gap-2 rounded-lg bg-secondary_alt px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium text-secondary">{t("common.theme.label")}</span>
                                            <ThemeSwitcher size="md" />
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium text-secondary">{t("common.language.label")}</span>
                                            <LanguageSwitcher size="md" className="min-w-0 shrink" />
                                        </div>
                                    </div>

                                    {!effectiveUser && !isLoading ? (
                                        <Button color="primary" size="lg" className="mt-3 w-full" href="/login" onClick={close}>
                                            {t("common.nav.logIn")}
                                        </Button>
                                    ) : null}
                                </div>
                            </AriaDialog>
                        </AriaModal>
                    </>
                )}
            </AriaModalOverlay>
        </AriaDialogTrigger>
    );
};
