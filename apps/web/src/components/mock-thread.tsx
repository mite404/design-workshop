import { ChatThreadPanel } from "@yaklabs/catalog";
import { threads } from "@yaklabs/catalog/thread";
import { FINISHED_BRIEF } from "../world/demo";

// The completed walkthrough plus the choice fixture shared with Storybook.
const MOCK_THREAD = {
  title: FINISHED_BRIEF.thread,
  messages: FINISHED_BRIEF.opening.turns,
  awaiting: threads.awaiting.awaiting,
};

/** The whole mocked conversation, full-width in Live mode or framed in Component mode. */
export function MockThread({ component = false }: { component?: boolean }) {
  return (
    <div
      aria-label={component ? "Component preview" : "Live preview"}
      className={
        component
          ? "grid h-full min-h-0 grid-cols-1 grid-rows-1 place-items-center overflow-auto bg-background p-3 md:p-6 [--thread-height:100%]"
          : "h-full"
      }
    >
      <ChatThreadPanel thread={MOCK_THREAD} bare={!component} cardsCarry={false} />
    </div>
  );
}
