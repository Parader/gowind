import { Heart } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

const footerColumns = [
    {
        title: "Pages",
        links: [
            { label: "Home", href: "/" },
            { label: "About", href: "/about" },
        ],
    },
    {
        title: "Legal",
        links: [
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
        ],
    },
];

export const Footer = () => {
    const currentYear = new Date().getFullYear();
    const donateUrl =
        import.meta.env.VITE_STRIPE_DONATE_URL?.trim() || import.meta.env.VITE_DONATE_URL?.trim();

    return (
        <footer className="glass-strong border-t border-white/10">
            <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
                <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-8">
                    <div className="flex max-w-sm flex-col items-start gap-3">
                        <span className="text-lg font-semibold text-primary">GoWind</span>
                        <p className="max-w-xs text-sm text-tertiary">
                            Know when and where to go. Find your next good wind window.
                        </p>
                        <p className="mt-2 text-xs text-quaternary">© {currentYear} GoWind. Free to use.</p>
                        {donateUrl ? (
                            <Button
                                size="sm"
                                color="secondary"
                                href={donateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                iconLeading={Heart}
                                className="mt-3 rounded-full border border-[#E1707A]/40 bg-[#E1707A] !text-white shadow-xs ring-0 hover:!bg-[#E4767E] hover:!text-white [&_[data-icon]]:!text-white"
                            >
                                Donate
                            </Button>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-8 md:gap-12">
                        {footerColumns.map((column) => (
                            <div key={column.title} className="flex flex-col gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-quaternary">
                                    {column.title}
                                </p>
                                <ul className="flex flex-col gap-2">
                                    {column.links.map((link) => (
                                        <li key={link.label}>
                                            <Button
                                                color="link-gray"
                                                size="sm"
                                                href={link.href}
                                                className="text-sm font-medium"
                                            >
                                                {link.label}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-10 flex flex-col gap-4 border-t border-secondary pt-8 md:flex-row md:items-center md:justify-between md:gap-0">
                    <p className="text-xs text-quaternary">
                        Weather data from Open-Meteo, WeatherAPI, Meteosource, and Visual Crossing.
                    </p>
                </div>
            </div>
        </footer>
    );
};
