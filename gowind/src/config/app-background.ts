/**
 * Background art shown behind the app (all routes except `/` landing hero).
 * Files live in `gowind/public/` — served at `/bg_1.png`, etc.
 * One variant is chosen at random on each full page load (same image everywhere for that load).
 */
export const APP_BACKGROUND_OPTIONS = ["/bg_1.png", "/bg_2.png", "/bg_3.png"] as const;

export const APP_BACKGROUND_IMAGE =
    APP_BACKGROUND_OPTIONS[Math.floor(Math.random() * APP_BACKGROUND_OPTIONS.length)]!;

/** Image layer opacity (0–1). Increase if the art is too subtle. */
export const APP_BACKGROUND_IMAGE_OPACITY = 0.22;

/** Tint over the image so text/UI stay readable (0–1, higher = more solid). */
export const APP_BACKGROUND_SCRIM_OPACITY = 0.68;