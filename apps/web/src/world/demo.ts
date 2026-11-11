import { applyChunk, completeReply, startReply } from "@yaklabs/catalog/reply";
import type { ThreadMessage } from "@yaklabs/catalog/thread";
import { brief } from "../demo/scenarios/brief";
import { interrupted } from "../demo/scenarios/interrupted";
import { returned } from "../demo/scenarios/returned";
import { wordingOf } from "../demo/replies";
import type { Beat, Opening, Script } from "../demo/script";
import { ids } from "./ids";
import { show, worldOf, type WorldSpec } from "./spec";

// Keep the wording beside an answered question, as the running transcript does.
function userTurn(
  id: string,
  beat: Extract<Beat, { kind: "user" | "answer" }>,
  previous: ThreadMessage | undefined,
): ThreadMessage {
  return {
    id,
    role: "user",
    text: beat.text,
    time: "",
    ...(beat.kind === "answer" && previous?.role === "agent"
      ? { question: wordingOf(previous.asks) }
      : {}),
  };
}

// Authored beats folded by the same reply reducer as playback, once at load. No typing, clock,
// or simulated request is needed to explore the finished conversations.
function finished(script: Script): Script & { opening: Opening } {
  const turns: ThreadMessage[] = [...(script.opening?.turns ?? [])];
  for (const beat of script.beats) {
    if (beat.kind === "user" || beat.kind === "answer") {
      turns.push(userTurn(`${script.id}-${turns.length + 1}`, beat, turns.at(-1)));
    } else if (beat.kind === "reply") {
      const reply = beat.events.reduce(
        (turn, event) => applyChunk(turn, event.chunk),
        startReply(`${script.id}-${turns.length + 1}`, ""),
      );
      turns.push(completeReply(reply));
    }
  }
  return {
    ...script,
    beats: [],
    opening: { awayMinutes: script.opening?.awayMinutes ?? 0, turns },
  };
}

/** The completed conversation shown when a welcome choice is pressed. */
export const FINISHED_BRIEF = finished(brief);

/**
 * The Demo over the device's threads: all conversations ready to explore from the first frame.
 */
export const DEMO_WORLD: WorldSpec = worldOf({
  projects: [
    {
      id: ids.project,
      name: "Demo",
      threads: [show(FINISHED_BRIEF), show(finished(interrupted)), show(finished(returned))],
    },
  ],
});
