export type Locale = "en" | "fr";

export type MessageValue = string | MessageTree;

export interface MessageTree {
    [key: string]: MessageValue;
}

export type Messages = MessageTree;
