import { useEffect } from "react";
import { useLocation } from "react-router";
import { trackPageView } from "@/lib/analytics";

/**
 * Scrolls the window to the top when the route pathname changes.
 */
export function ScrollToTop() {
    const { pathname, search } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    useEffect(() => {
        trackPageView(pathname, search);
    }, [pathname, search]);

    return null;
}
