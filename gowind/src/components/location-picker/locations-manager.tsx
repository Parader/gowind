import { useState } from "react";
import { Map01, Plus, Trash01 } from "@untitledui/icons";
import { AddLocationModal } from "@/components/location-picker/add-location-modal";
import { Button } from "@/components/base/buttons/button";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { LocationsMapView } from "@/components/location-picker/locations-map-view";
import { useSetup } from "@/providers/setup-provider";
import { useT } from "@/providers/locale-provider";
import { cx } from "@/utils/cx";

export interface LocationsManagerProps {
    headingLevel?: "h1" | "h2";
    title?: string;
    description?: string;
    className?: string;
}

/**
 * Shared locations UI: add via modal (predefined + custom map), list with delete, map view.
 * Used by the Locations page and onboarding location step.
 */
export function LocationsManager({
    headingLevel = "h1",
    title,
    description,
    className,
}: LocationsManagerProps) {
    const t = useT();
    const resolvedTitle = title ?? t("locationPicker.manager.title");
    const resolvedDescription = description ?? t("locationPicker.manager.description");
    const { locations, addLocation, removeLocation } = useSetup();
    const [locationName, setLocationName] = useState("");
    const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

    const handleAddLocation = (close: () => void) => {
        const name = locationName.trim();
        if (!name || !selectedCoords) return;
        addLocation({ name, lat: selectedCoords.lat, lng: selectedCoords.lng });
        setLocationName("");
        setSelectedCoords(null);
        close();
    };

    const handleAddFromSuggested = (
        location: { name: string; lat: number; lng: number; region?: string },
        close: () => void
    ) => {
        addLocation(location);
        close();
    };

    const handleCloseModal = () => {
        setLocationName("");
        setSelectedCoords(null);
    };

    const HeadingTag = headingLevel === "h1" ? "h1" : "h2";

    return (
        <div className={cx("w-full", className)}>
            <div className="mb-6 h-px w-12 bg-brand-400" />
            <HeadingTag className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                {resolvedTitle}
            </HeadingTag>
            <p className="mt-2 text-md text-tertiary">{resolvedDescription}</p>

            <div className="mt-10 space-y-10">
                <section>
                    {locations.length > 0 && (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
                            <AddLocationModal
                                trigger={
                                    <Button size="md" color="primary" iconLeading={Plus}>
                                        {t("locationPicker.manager.addLocation")}
                                    </Button>
                                }
                                locationName={locationName}
                                onLocationNameChange={setLocationName}
                                selectedCoords={selectedCoords}
                                onCoordsChange={(lat, lng) => setSelectedCoords({ lat, lng })}
                                onAdd={handleAddLocation}
                                onAddFromSuggested={handleAddFromSuggested}
                                onClose={handleCloseModal}
                                existingLocations={locations}
                            />
                        </div>
                    )}

                    {locations.length === 0 ? (
                        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-secondary bg-white px-6 py-8 dark:bg-primary">
                            <Map01 className="size-12 text-quaternary" strokeWidth={1.5} />
                            <p className="mt-4 text-tertiary">{t("locationPicker.manager.empty")}</p>
                            <AddLocationModal
                                trigger={
                                    <Button
                                        size="lg"
                                        color="primary"
                                        className="mt-4"
                                        iconLeading={Plus}
                                    >
                                        {t("locationPicker.manager.addLocation")}
                                    </Button>
                                }
                                locationName={locationName}
                                onLocationNameChange={setLocationName}
                                selectedCoords={selectedCoords}
                                onCoordsChange={(lat, lng) => setSelectedCoords({ lat, lng })}
                                onAdd={handleAddLocation}
                                onAddFromSuggested={handleAddFromSuggested}
                                onClose={handleCloseModal}
                                existingLocations={locations}
                            />
                        </div>
                    ) : (
                        <div className="mt-6 divide-y divide-secondary overflow-hidden rounded-lg border border-secondary bg-white dark:bg-primary">
                            {locations.map((loc) => (
                                <div
                                    key={loc.id}
                                    className="flex items-center justify-between p-4"
                                >
                                    <div>
                                        <p className="font-medium text-primary">{loc.name}</p>
                                        <p className="text-sm text-tertiary">
                                            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                                        </p>
                                    </div>
                                    <Dropdown.Root>
                                        <Dropdown.DotsButton
                                            aria-label={t("locationPicker.manager.optionsFor", { name: loc.name })}
                                        />
                                        <Dropdown.Popover className="w-min">
                                            <Dropdown.Menu>
                                                <Dropdown.Item
                                                    icon={Trash01}
                                                    label={t("common.actions.delete")}
                                                    onAction={() => removeLocation(loc.id)}
                                                />
                                            </Dropdown.Menu>
                                        </Dropdown.Popover>
                                    </Dropdown.Root>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {locations.length > 0 && (
                    <section>
                        <LocationsMapView locations={locations} height="320px" />
                    </section>
                )}
            </div>
        </div>
    );
}
