import { Download01, XClose } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useT } from "@/providers/locale-provider";

export function PwaInstallBanner() {
    const t = useT();
    const { visible, mode, install, dismiss, canPrompt } = usePwaInstall();

    if (!visible || !mode) return null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[55] flex justify-center p-4 sm:p-6">
            <div
                role="status"
                className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-secondary bg-primary px-4 py-3 shadow-xl ring-1 ring-secondary sm:px-5 sm:py-4"
            >
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-secondary">
                    <Download01 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-primary">{t("pwaInstall.title")}</p>
                    <p className="mt-0.5 text-sm text-tertiary">
                        {mode === "ios" ? t("pwaInstall.iosDescription") : t("pwaInstall.description")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {mode === "chromium" && canPrompt && (
                            <Button size="sm" color="primary" onClick={() => void install()}>
                                {t("pwaInstall.install")}
                            </Button>
                        )}
                        <Button size="sm" color="secondary" onClick={dismiss}>
                            {t("pwaInstall.dismiss")}
                        </Button>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={dismiss}
                    className="rounded-lg p-1 text-fg-quaternary transition hover:bg-primary_hover hover:text-fg-secondary"
                    aria-label={t("pwaInstall.dismiss")}
                >
                    <XClose className="size-4" />
                </button>
            </div>
        </div>
    );
}
