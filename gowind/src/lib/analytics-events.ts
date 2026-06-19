/** PostHog event names — snake_case for funnels and flows. */
export const AnalyticsEvents = {
    pageView: "$pageview",

    cookieConsentUpdated: "cookie_consent_updated",

    userSignedUp: "user_signed_up",
    userLoggedIn: "user_logged_in",
    userLoggedOut: "user_logged_out",
    authFailed: "auth_failed",
    oauthStarted: "oauth_started",

    onboardingStarted: "onboarding_started",
    onboardingStepViewed: "onboarding_step_viewed",
    onboardingSportsSaved: "onboarding_sports_saved",
    onboardingCompleted: "onboarding_completed",

    goTimeLoaded: "go_time_loaded",
    goTimeFocusViewChanged: "go_time_focus_view_changed",
    goTimeGoodOnlyToggled: "go_time_good_only_toggled",
    goTimeLocationFilterChanged: "go_time_location_filter_changed",
    goTimeWindowShared: "go_time_window_shared",
    goTimeShareViewed: "go_time_share_viewed",

    locationAdded: "location_added",
    locationRemoved: "location_removed",

    preferencesSaved: "preferences_saved",

    landingCtaClicked: "landing_cta_clicked",

    languageChanged: "language_changed",
    themeChanged: "theme_changed",
} as const;

export type AnalyticsSource = "onboarding" | "locations" | "preferences";
