import type { BotConfig } from "../config.js";
import { logger } from "./logger.js";

const TIMEOUT_MS = 10_000;

export interface StToolsMessage {
  embeds: object[];
  components?: object[];
}

export const UNAVAILABLE: StToolsMessage = {
  embeds: [
    {
      title: "Hub unavailable",
      description: "The hangout hub did not answer. Try again in a minute.",
      color: 0xf59e0b,
      footer: { text: "StoryTime Hub" },
    },
  ],
};

/** POSTs to st-tools `/api/bot/<route>`; null when unconfigured, down, or non-2xx. */
export async function callStTools(
  config: Pick<BotConfig, "stToolsUrl" | "botApiSecret">,
  route: string,
  body: object
): Promise<unknown | null> {
  if (!config.stToolsUrl || !config.botApiSecret) {
    return null;
  }
  try {
    const res = await fetch(`${config.stToolsUrl}/api/bot/${route}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.botApiSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    logger.error("st-tools call failed", { route, error: String(error) });
    return null;
  }
}

/** The `message` of an st-tools `{ ok, message }` answer, or the fallback embed. */
export async function messageFromStTools(
  config: Pick<BotConfig, "stToolsUrl" | "botApiSecret">,
  route: string,
  body: object
): Promise<StToolsMessage> {
  const answer = (await callStTools(config, route, body)) as { message?: StToolsMessage } | null;
  return answer?.message?.embeds ? answer.message : UNAVAILABLE;
}

export async function tickStTools(
  config: Pick<BotConfig, "stToolsUrl" | "botApiSecret">
): Promise<void> {
  await callStTools(config, "tick", {});
}
