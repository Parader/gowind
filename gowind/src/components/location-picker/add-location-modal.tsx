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
import { SUGGESTED_LOCATIONS } from "@/components/onboarding/onboarding-data";
import type { Location } from "@/types/setup";

interface AddLocationModalProps {
    trigger: React.ReactNode;
    locationName: string;
    onLocationNameChange: (value: string) => void;
    selectedCoords: { lat: number; lng: number } | null;
    onCoordsChange: (lat: number, lng: number) => void;
    onAdd: (close: () => void) => void;
    onAddFromSuggested: (location: { name: string; lat: number; lng: number; region?: string }, close: () => void) => void;
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
    const suggestedNotYetAdded = SUGGESTED_LOCATIONS.filter(
        (s) =>
            !existingLocations.some(
                (l) => l.lat === s.lat && l.lng === s.lng && l.name === s.name
            )
    );
    const [mode, setMode] = useState<"predefined" | "custom">(
        suggestedNotYetAdded.length > 0 ? "predefined" : "custom"
    );
    return (
        <DialogTrigger>
            {trigger}
            <ModalOverlay isDismissable>
                {({ state }) => (
                    <Modal className="w-full max-w-2xl rounded-xl border border-secondary bg-white p-6 shadow-xl dark:bg-primary">
                        <Dialog className="flex w-full min-w-full flex-col items-stretch outline-hidden">
                            <ModalHeader
                                onClose={() => {
                                    onClose();
                                    state.close();
                                }}
                            >
                                <h3 className="text-lg font-semibold text-primary">Add location</h3>
                            </ModalHeader>
                            <div className="mt-6 flex w-full flex-col space-y-4">
                                <div className="flex gap-2">
                                    {suggestedNotYetAdded.length > 0 && (
                                        <Button
                                            size="sm"
                                            color={mode === "predefined" ? "primary" : "tertiary"}
                                            onClick={() => setMode("predefined")}
                                        >
                                            Predefined
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        color={mode === "custom" ? "primary" : "tertiary"}
                                        onClick={() => setMode("custom")}
                                    >
                                        Custom
                                    </Button>
                                </div>

                                {mode === "predefined" && suggestedNotYetAdded.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                        {suggestedNotYetAdded.map((s) => (
                                            <div
                                                key={s.id}
                                                className="flex w-full items-center gap-2 rounded-xl border border-secondary bg-white px-4 py-3 shadow-xs transition hover:border-secondary_alt dark:bg-primary"
                                            >
                                                <Map01 className="size-4 shrink-0 text-fg-quaternary" strokeWidth={1.5} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-primary">{s.name}</p>
                                                    <p className="text-xs text-tertiary">{s.region}</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    color="secondary"
                                                    className="shrink-0"
                                                    iconLeading={Plus}
                                                    onClick={() => {
                                                        onAddFromSuggested(
                                                            {
                                                                name: s.name,
                                                                lat: s.lat,
                                                                lng: s.lng,
                                                                region: s.region,
                                                            },
                                                            () => state.close()
                                                        );
                                                        onClose();
                                                    }}
                                                >
                                                    Add
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <Input
                                            name="newLocationName"
                                            label="Location name"
                                            placeholder="e.g. North field, Lake view"
                                            value={locationName}
                                            onChange={onLocationNameChange}
                                            size="md"
                                        />
                                        <div className="w-full">
                                            <p className="mb-2 text-sm font-medium text-secondary">
                                                Select on map
                                            </p>
                                            <LocationMapPicker
                                                value={selectedCoords}
                                                onChange={onCoordsChange}
                                                onSearchPlaceSelect={onLocationNameChange}
                                                height="360px"
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                size="md"
                                                color="primary"
                                                onClick={() => onAdd(() => state.close())}
                                                isDisabled={!locationName.trim() || !selectedCoords}
                                            >
                                                Add location
                                            </Button>
                                            <Button
                                                size="md"
                                                color="tertiary"
                                                onClick={() => {
                                                    onClose();
                                                    state.close();
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Dialog>
                    </Modal>
                )}
            </ModalOverlay>
        </DialogTrigger>
    );
}
