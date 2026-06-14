import type { ImgHTMLAttributes } from "react";
import { cx } from "@/utils/cx";

export const GoWindLogo = ({
    variant,
    className,
    ...props
}: ImgHTMLAttributes<HTMLImageElement> & { variant?: "light" | "dark" }) => {
    return (
        <img
            src={variant === "light" ? "/gowind_logo_white.svg" : "/gowind_logo.svg"}
            alt="GoWind"
            {...props}
            className={cx("h-8 w-auto", className)}
        />
    );
};
