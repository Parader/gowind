import { useEffect } from "react";
import { useLocation } from "react-router";

const DEFAULT_TITLE = "GoWind — Find your next good wind window";
const DEFAULT_DESCRIPTION =
    "GoWind analyzes forecasts and highlights when conditions match your limits — so you spend less time checking and more time outside.";

const ROUTE_META: Record<string, { title: string; description?: string }> = {
    "/": {
        title: DEFAULT_TITLE,
    },
    "/go-time": {
        title: "Go Time — GoWind",
        description: "See when and where conditions match your preferences.",
    },
    "/go-time/share": {
        title: "Shared Go Time window — GoWind",
        description: "A shared wind window snapshot from GoWind. Always verify current conditions before flying.",
    },
    "/signup": {
        title: "Sign up — GoWind",
    },
    "/login": {
        title: "Log in — GoWind",
    },
    "/about": {
        title: "About — GoWind",
    },
};

function setMetaTag(attr: "name" | "property", key: string, content: string) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute("content", content);
}

/** Keep document title and social meta in sync when navigating client-side. */
export function DocumentMeta() {
    const { pathname, search } = useLocation();

    useEffect(() => {
        const routeKey = pathname.startsWith("/go-time/share") ? "/go-time/share" : pathname;
        const meta = ROUTE_META[routeKey] ?? { title: DEFAULT_TITLE };
        const description = meta.description ?? DEFAULT_DESCRIPTION;
        const url = `${window.location.origin}${pathname}${search}`;

        document.title = meta.title;
        setMetaTag("name", "description", description);
        setMetaTag("property", "og:title", meta.title);
        setMetaTag("property", "og:description", description);
        setMetaTag("property", "og:url", url);
        setMetaTag("name", "twitter:title", meta.title);
        setMetaTag("name", "twitter:description", description);
    }, [pathname, search]);

    return null;
}
