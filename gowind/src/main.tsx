import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { AccountSettings } from "@/pages/account-settings";
import { Admin } from "@/pages/admin";
import { GoTime } from "@/pages/go-time";
import { GoTimeShare } from "@/pages/go-time-share";
import { Locations } from "@/pages/locations";
import { Data } from "@/pages/data";
import { Preferences } from "@/pages/preferences";
import { Privacy } from "@/pages/privacy";
import { Terms } from "@/pages/terms";
import { About } from "@/pages/about";
import { Landing03 } from "@/pages/landing-03";
import { Login } from "@/pages/login";
import { NotFound } from "@/pages/not-found";
import { Signup } from "@/pages/signup";
import { AppLayout } from "@/layouts/app-layout";
import { ScrollToTop } from "@/components/scroll-to-top";
import { SetupLoader } from "@/components/onboarding/setup-loader";
import { AuthProvider } from "@/providers/auth-provider";
import { SetupProvider } from "@/providers/setup-provider";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="light">
            <BrowserRouter>
                <ScrollToTop />
                <AuthProvider>
                    <SetupProvider>
                        <SetupLoader>
                    <RouteProvider>
                        <Routes>
                            <Route path="/go-time/share" element={<GoTimeShare />} />
                            <Route element={<AppLayout />}>
                                <Route path="/" element={<Landing03 />} />
                                <Route path="/about" element={<About />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/signup" element={<Signup />} />
                                <Route path="/account/settings" element={<AccountSettings />} />
                                <Route path="/admin" element={<Admin />} />
                                <Route path="/go-time" element={<GoTime />} />
                                <Route path="/data" element={<Data />} />
                                <Route path="/locations" element={<Locations />} />
                                <Route path="/preferences" element={<Preferences />} />
                                <Route path="/privacy" element={<Privacy />} />
                                <Route path="/terms" element={<Terms />} />
                                <Route path="*" element={<NotFound />} />
                            </Route>
                        </Routes>
                    </RouteProvider>
                        </SetupLoader>
                    </SetupProvider>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
