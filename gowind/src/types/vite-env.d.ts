/// <reference types="vite/client" />

import type { DetailedHTMLProps, HTMLAttributes } from "react";

interface ImportMetaEnv {
    /** Stripe publishable key (`pk_test_…` / `pk_live_…`) — only for client-side Stripe.js if you add it later. */
    readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
    /**
     * Stripe donation link for the landing “Say thanks” section.
     * Use a Payment Link or Checkout URL from the Stripe Dashboard (Products → Payment links, or Checkout).
     */
    readonly VITE_STRIPE_DONATE_URL?: string;
    /** Fallback support URL if `VITE_STRIPE_DONATE_URL` is not set (e.g. another provider). */
    readonly VITE_DONATE_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module "react" {
    namespace JSX {
        interface IntrinsicElements {
            "iphone-16-max": DetailedHTMLProps<
                HTMLAttributes<HTMLElement> & { mode?: "light" | "dark" },
                HTMLElement
            >;
        }
    }
}
