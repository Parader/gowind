import { Download01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useT } from "@/providers/locale-provider";
import { cx } from "@/utils/cx";

type PwaInstallHeroCtaProps = {
    className?: string;
    size?: "md" | "lg";
    color?: "primary" | "secondary" | "tertiary";
};

/** Always-visible Install control for hero / page headers when the app is not installed. */
export function PwaInstallHeroCta({
    className,
    size = "lg",
    color = "secondary",
}: PwaInstallHeroCtaProps) {
    const t = useT();
    const { available, install, canPrompt, showHelp } = usePwaInstall();

    if (!available) return null;

    return (
        <Button
            size={size}
            color={color}
            className={cx("rounded-full", className)}
            iconLeading={Download01}
            onClick={() => {
                if (canPrompt) void install();
                else showHelp();
            }}
        >
            {t("pwaInstall.install")}
        </Button>
    );
}
