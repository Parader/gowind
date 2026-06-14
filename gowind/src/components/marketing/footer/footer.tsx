import { Button } from "@/components/base/buttons/button";

const footerColumns = [
    {
        title: "Product",
        links: [
            { label: "Go Time", href: "/go-time" },
            { label: "Locations", href: "/locations" },
            { label: "Preferences", href: "/preferences" },
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
    const columns = donateUrl
        ? [
              ...footerColumns,
              {
                  title: "Support",
                  links: [{ label: "Say thanks", href: donateUrl, external: true }],
              },
          ]
        : footerColumns;

    return (
        <footer className="glass-strong border-t border-white/10">
            <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
                <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-8">
                    <div className="flex flex-col gap-3">
                        <span className="text-lg font-semibold text-primary">GoWind</span>
                        <p className="max-w-xs text-sm text-tertiary">
                            Know when and where to go. Find your next good wind window.
                        </p>
                        <p className="mt-2 text-xs text-quaternary">© {currentYear} GoWind. Free to use.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-12">
                        {columns.map((column) => (
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
                                                target={"external" in link && link.external ? "_blank" : undefined}
                                                rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
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
