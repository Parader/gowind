import { useState } from "react";
import { Map01, Plus } from "@untitledui/icons";
import {
    Dialog,
    DialogTrigger,
    Modal,
    ModalHeader,
    ModalOverlay,
} from "@/components/application/modals/modal";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { LocationMapPicker } from "@/components/location-picker/location-map-picker";
import {
    SUGGESTED_LOCATIONS,
    suggestedLocationNameKey,
    suggestedLocationRegionKey,
} from "@/components/onboarding/onboarding-data";
import { useT } from "@/providers/locale-provider";
import type { Location } from "@/types/setup";

interface AddLocationModalProps {
    trigger: React.ReactNode;
    locationName: string;
    onLocationNameChange: (value: string) => void;
    selectedCoords: { lat: number; lng: number } | null;
    onCoordsChange: (lat: number, lng: number) => void;
    onAdd: (close: () => void) => void;
    onAddFromSuggested: (
        location: { name: string; lat: number; lng: number; region?: string },
        close: () => void,
    ) => void;
    onClose: () => void;
    existingLocations?: Location[];
}

export function AddLocationModal({
    trigger,
    locationName,
    onLocationNameChange,
    selectedCoords,
    onCoordsChange,
    onAdd,
    onAddFromSuggested,
    onClose,
    existingLocations = [],
}: AddLocationModalProps) {
    const t = useT();
    const suggestedNotYetAdded = SUGGESTED_LOCATIONS.filter(
        (s) =>
            !existingLocations.some(
                (l) =>
                    l.lat === s.lat &&
                    l.lng === s.lng &&
                    l.name === t(suggestedLocationNameKey(s.id)),
            ),
    );
    const [mode, setMode] = useState<"predefined" | "custom">(
        suggestedNotYetAdded.length > 0 ? "predefined" : "custom",
    );

    const canSubmitCustom = Boolean(locationName.trim() && selectedCoords);

    return (
        <DialogTrigger>
            {trigger}
            <ModalOverlay isDismissable>
                {({ state }) => (
                    <Modal className="flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-secondary bg-white shadow-xl dark:bg-primary">
                        <Dialog className="flex w-full min-w-full flex-col items-stretch outline-hidden">
                            <div className="shrink-0 px-6 pt-6">
                                <ModalHeader
                                    onClose={() => {
                                        onClose();
                                        state.close();
                                    }}
                                >
                                    <h3 className="text-lg font-semibold text-primary">
                                        {t("locationPicker.addModal.title")}
                                    </h3>
                                </ModalHeader>
                            </div>

                            <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-6 pb-4">
                                <div className="flex w-full flex-col space-y-4">
                                    <div className="flex gap-2">
                                        {suggestedNotYetAdded.length > 0 && (
                                            <Button
                                                size="sm"
                                                color={mode === "predefined" ? "primary" : "tertiary"}
                                                onClick={() => setMode("predefined")}
                                            >
                                                {t("locationPicker.addModal.predefined")}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            color={mode === "custom" ? "primary" : "tertiary"}
                                            onClick={() => setMode("custom")}
                                        >
                                            {t("locationPicker.addModal.custom")}
                                        </Button>
                                    </div>

                                    {mode === "predefined" && suggestedNotYetAdded.length > 0 ? (
                                        <div className="flex flex-col gap-2">
                                            {suggestedNotYetAdded.map((s) => {
                                                const name = t(suggestedLocationNameKey(s.id));
                                                const region = t(suggestedLocationRegionKey(s.id));
                                                return (
                                                    <div
                                                        key={s.id}
                                                        className="flex w-full items-center gap-2 rounded-xl border border-secondary bg-white px-4 py-3 shadow-xs transition hover:border-secondary_alt dark:bg-primary"
                                                    >
                                                        <Map01
                                                            className="size-4 shrink-0 text-fg-quaternary"
                                                            strokeWidth={1.5}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium text-primary">
                                                                {name}
                                                            </p>
                                                            <p className="text-xs text-tertiary">{region}</p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            color="secondary"
                                                            className="shrink-0"
                                                            iconLeading={Plus}
                                                            onClick={() => {
                                                                onAddFromSuggested(
                                                                    {
                                                                        name,
                                                                        lat: s.lat,
                                                                        lng: s.lng,
                                                                        region,
                                                                    },
                                                                    () => state.close(),
                                                                );
                                                                onClose();
                                                            }}
                                                        >
                                                            {t("locationPicker.addModal.add")}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <form
                                            className="flex w-full flex-col space-y-4"
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                if (!canSubmitCustom) return;
                                                (document.activeElement as HTMLElement | null)?.blur?.();
                                                onAdd(() => state.close());
                                            }}
                                        >
                                            <Input
                                                name="newLocationName"
                                                label={t("locationPicker.addModal.locationNameLabel")}
                                                placeholder={t(
                                                    "locationPicker.addModal.locationNamePlaceholder",
                                                )}
                                                value={locationName}
                                                onChange={onLocationNameChange}
                                                size="md"
                                                enterKeyHint="done"
                                                autoComplete="off"
                                            />
                                            <div className="w-full">
                                                <p className="mb-2 text-sm font-medium text-secondary">
                                                    {t("locationPicker.addModal.selectOnMap")}
                                                </p>
                                                <LocationMapPicker
                                                    value={selectedCoords}
                                                    onChange={onCoordsChange}
                                                    onSearchPlaceSelect={onLocationNameChange}
                                                    height="280px"
                                                />
                                            </div>
                                            {/* Invisible submit so Enter / iOS Done confirms when ready */}
                                            <button type="submit" className="sr-only" tabIndex={-1}>
                                                {t("locationPicker.addModal.title")}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>

                            {mode === "custom" || suggestedNotYetAdded.length === 0 ? (
                                <div className="sticky bottom-0 shrink-0 border-t border-secondary bg-white px-6 py-4 dark:bg-primary">
                                    <div className="flex gap-2">
                                        <Button
                                            size="md"
                                            color="primary"
                                            type="button"
                                            onClick={() => {
                                                if (!canSubmitCustom) return;
                                                (document.activeElement as HTMLElement | null)?.blur?.();
                                                onAdd(() => state.close());
                                            }}
                                            isDisabled={!canSubmitCustom}
                                        >
                                            {t("locationPicker.addModal.title")}
                                        </Button>
                                        <Button
                                            size="md"
                                            color="tertiary"
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                state.close();
                                            }}
                                        >
                                            {t("common.actions.cancel")}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                        </Dialog>
                    </Modal>
                )}
            </ModalOverlay>
        </DialogTrigger>
    );
}
