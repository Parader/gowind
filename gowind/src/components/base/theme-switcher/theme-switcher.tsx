import { Moon01, Sun } from "@untitledui/icons";
import { Button as AriaButton } from "react-aria-components";
import { useTheme } from "@/providers/theme-provider";
import { cx } from "@/utils/cx";

interface ThemeSwitcherProps {
    className?: string;
    size?: "sm" | "md";
}

export const ThemeSwitcher = ({ className, size = "md" }: ThemeSwitcherProps) => {
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";

    const handleClick = () => {
        setTheme(isDark ? "light" : "dark");
    };

    const iconSize = size === "sm" ? "size-4" : "size-5";
    const padding = size === "sm" ? "p-1.5" : "p-2";

    return (
        <AriaButton
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onPress={handleClick}
            className={({ isFocusVisible, isHovered }) =>
                cx(
                    "cursor-pointer rounded-lg outline-focus-ring transition duration-100 ease-linear",
                    padding,
                    isHovered && "bg-primary_hover",
                    isFocusVisible && "outline-2 outline-offset-2",
                    className,
                )
            }
        >
            {isDark ? (
                <Sun className={cx(iconSize, "text-white")} aria-hidden="true" />
            ) : (
                <Moon01 className={cx(iconSize, "text-fg-secondary")} aria-hidden="true" />
            )}
        </AriaButton>
    );
};
