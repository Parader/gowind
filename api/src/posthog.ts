import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY?.trim();

const posthog = apiKey
    ? new PostHog(apiKey, {
          host: process.env.POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
          flushAt: 1,
          flushInterval: 0,
      })
    : null;

export default posthog;

export function captureServerEvent(
    distinctId: string,
    event: string,
    properties?: Record<string, unknown>,
): void {
    if (!posthog) return;
    posthog.capture({ distinctId, event, properties });
}
