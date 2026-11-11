import { useAuth } from "@workos-inc/authkit-react";
import type { ThreadSummary } from "@yaklabs/runtime";
import { env } from "../env";
import { BonsaiMark } from "../shell/rail-places";
import { SplashDrawing } from "./splash";
import { Actions, Projects } from "./welcome-sections";

const DATE = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });

// The part of the day the greeting names: the morning in the light theme, the evening in the
// dark one (Ethan), rather than the clock. Both are in the DOM; index.css shows the theme's.
type Part = "morning" | "evening";
const PARTS: readonly Part[] = ["morning", "evening"];

// "Good morning, Ethan", or "Good morning" for a build with no sign-in.
const greetingFor = (part: Part, name: string | null): string =>
  `Good ${part}${name === null ? "" : `, ${name}`}`;

const lineFor = (part: Part): string => `Spend your ${part} on the thing that matters.`;

function Greeting({ name }: { name: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[0.08em] text-soft-ink uppercase">
        {DATE.format(new Date())}
      </p>
      {PARTS.map((part) => (
        <div key={part} data-part={part}>
          <h1 className="mt-1 font-sans text-xl leading-8 font-semibold tracking-tight text-ink">
            {greetingFor(part, name)}
          </h1>
          <p className="mt-1 text-soft-ink">{lineFor(part)}</p>
        </div>
      ))}
    </div>
  );
}

// Signed in with WorkOS (ADR-084): the greeting carries the first name.
function WorkOsGreeting() {
  const { user } = useAuth();
  return <Greeting name={user?.firstName ?? null} />;
}

function LocalGreeting() {
  return <Greeting name={null} />;
}

const GreetingLine = env.auth.kind === "workos" ? WorkOsGreeting : LocalGreeting;

/** The Vitruvian welcome, with projects and mode choices but no chat composer. */
export function Welcome({ thread }: { thread: ThreadSummary }) {
  return (
    <div className="welcome" data-slot="welcome">
      <SplashDrawing where="welcome" />
      <div className="welcome-words flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col gap-4">
          <span className="grid size-10 place-items-center rounded-full bg-paper-deep text-ink">
            <BonsaiMark className="size-5" />
          </span>
          <GreetingLine />
        </div>
        <Projects />
        <Actions thread={thread} />
      </div>
    </div>
  );
}
