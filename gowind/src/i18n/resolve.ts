import type { MessageTree } from "./types";

export function resolveMessage(messages: MessageTree, key: string): string | undefined {
    const parts = key.split(".");
    let current: unknown = messages;
    for (const part of parts) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as MessageTree)[part];
    }
    return typeof current === "string" ? current : undefined;
}
