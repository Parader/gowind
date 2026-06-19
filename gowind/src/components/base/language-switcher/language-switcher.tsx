import { Globe01 } from "@untitledui/icons";
import { Button as AriaButton, ListBox, ListBoxItem, Popover, Select } from "react-aria-components";
import { useLocale, type Locale } from "@/providers/locale-provider";
import { cx } from "@/utils/cx";

const LOCALES: Locale[] = ["en", "fr"];

interface LanguageSwitcherProps {
    className?: string;
    size?: "sm" | "md";
    /** Icon-only trigger for desktop header chrome. */
    compact?: boolean;
    /** White icon chrome when the header uses light-on-dark contrast (e.g. landing hero). */
    lightIcon?: boolean;
}

export const LanguageSwitcher = ({ className, size = "md", compact = false, lightIcon = false }: LanguageSwitcherProps) => {
    const { locale, setLocale, t } = useLocale();
    const iconSize = size === "sm" ? "size-4" : "size-5";
    const padding = size === "sm" ? "p-1.5" : "p-2";

    return (
        <Select
            aria-label={t("common.language.switchAria")}
            selectedKey={locale}
            onSelectionChange={(key) => {
                if (key === "en" || key === "fr") setLocale(key);
            }}
            className={className}
        >
            <AriaButton
                className={({ isFocusVisible, isHovered }) =>
                    cx(
                        "cursor-pointer rounded-lg outline-focus-ring transition duration-100 ease-linear",
                        compact ? padding : "flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium",
                        compact ? undefined : lightIcon ? "text-white" : "text-secondary",
                        isHovered && (lightIcon ? "bg-white/10" : "bg-primary_hover"),
                        isFocusVisible && "outline-2 outline-offset-2",
                    )
                }
            >
                <Globe01 className={cx(iconSize, lightIcon ? "text-white" : "text-fg-secondary")} aria-hidden="true" />
                {compact ? (
                    <span className="sr-only">{t(`common.language.${locale}`)}</span>
                ) : (
                    <span className="truncate">{t(`common.language.${locale}`)}</span>
                )}
            </AriaButton>
            <Popover
                placement="bottom end"
                className="min-w-[8.5rem] rounded-lg border border-secondary bg-primary py-1 shadow-lg outline-hidden"
            >
                <ListBox className="outline-hidden">
                    {LOCALES.map((id) => (
                        <ListBoxItem
                            key={id}
                            id={id}
                            textValue={t(`common.language.${id}`)}
                            className={({ isFocused, isSelected }) =>
                                cx(
                                    "cursor-pointer px-3 py-2 text-sm outline-hidden",
                                    isFocused && "bg-primary_hover",
                                    isSelected && "font-semibold text-brand-600 dark:text-brand-400",
                                    !isSelected && "text-secondary",
                                )
                            }
                        >
                            {t(`common.language.${id}`)}
                        </ListBoxItem>
                    ))}
                </ListBox>
            </Popover>
        </Select>
    );
};
