import { Moon01, Sun } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { useT } from "@/providers/locale-provider";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

interface ThemeSwitcherProps {
    className?: string;
    size?: "sm" | "md";
    /** White icon chrome when the header uses light-on-dark contrast (e.g. landing hero). */
    lightIcon?: boolean;
}

export const ThemeSwitcher = ({ className, size = "md", lightIcon = false }: ThemeSwitcherProps) => {
    const t = useT();
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";

    const handleClick = () => {
        setTheme(isDark ? "light" : "dark");
    };

    const iconSize = size === "sm" ? "size-4" : "size-5";
    const padding = size === "sm" ? "p-1.5" : "p-2";

    return (
        <AriaButton
            aria-label={isDark ? t("common.theme.switchToLight") : t("common.theme.switchToDark")}
            onPress={handleClick}
            className={({ isFocusVisible, isHovered }) =>
                cx(
                    "cursor-pointer rounded-lg outline-focus-ring transition duration-100 ease-linear",
                    padding,
                    isHovered && (lightIcon ? "bg-white/10" : "bg-primary_hover"),
                    isFocusVisible && "outline-2 outline-offset-2",
                    className,
                )
            }
        >
            {isDark ? (
                <Sun className={cx(iconSize, lightIcon ? "text-white" : "text-fg-secondary")} aria-hidden="true" />
            ) : (
                <Moon01 className={cx(iconSize, lightIcon ? "text-white" : "text-fg-secondary")} aria-hidden="true" />
            )}
        </AriaButton>
    );
};
