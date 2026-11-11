import { STARTER } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogPortal,
  DialogTitle,
} from "@yaklabs/ui/components/dialog";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { env } from "../env";
import { useVisitor } from "../session";
import { useShell, type Shell } from "../shell/model";
import { entryOf, viewOf } from "../shell/state";
import { ids } from "../world/ids";
import { useShow } from "../world/provider";

type Stage = "checking" | "waiting" | "projects" | "demo" | "closed";
type Target = "demo" | "live-playground" | "play" | "canvas";
type Outline = { target: Target; rect: DOMRect };
type Visit = { visitor: string; step: Stage };

const TARGETS: Record<"projects" | "demo", readonly Target[]> = {
  projects: ["demo", "live-playground"],
  demo: ["play", "canvas"],
};

const STEPS = {
  projects: {
    number: 1,
    title: "A quick look around",
    description: "Two ways to explore. The colors point to the matching places in the app.",
    button: "Next",
    note: null,
    points: [
      {
        target: "demo",
        title: "Choose a demo",
        text: "Scripted examples. No live model is called.",
      },
      {
        target: "live-playground",
        title: "Try the live model",
        text:
          env.agent.kind === "gateway"
            ? "Ask a real model your own question."
            : "Real model when signed in; stand-in in this preview.",
      },
    ],
  },
  demo: {
    number: 2,
    title: "Try the scripted demo",
    description: "You’re in a demo now. It waits for you to press Play.",
    button: "Got it",
    note: "In Live Playground, your canvas is saved in this browser. Demo changes reset on reload.",
    points: [
      {
        target: "play",
        title: "Press Play",
        text: "Start the scripted walkthrough. You can pause, restart or run it at 2× speed. No live model is called.",
      },
      {
        target: "canvas",
        title: "Open Canvas",
        text: "Canvas sits beside the thread. Drag selected text into it to start a side thread, or drag a card or its title bar there to keep it alongside the conversation.",
      },
    ],
  },
} as const;

// Full containment matters: a partially visible project cannot explain all of its demo rows.
function inViewport(rect: DOMRect): boolean {
  return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
}

// Sidebar sections precede the splash links and include every expanded demo row.
function targetElement(target: Target): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-guide-target="${target}"]`)).find(
    (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && inViewport(rect);
    },
  );
}

function Highlights({ stage }: { stage: "projects" | "demo" }) {
  const [outlines, setOutlines] = useState<Outline[]>([]);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setOutlines(
          TARGETS[stage].flatMap((target) => {
            const element = targetElement(target);
            return element === undefined ? [] : [{ target, rect: element.getBoundingClientRect() }];
          }),
        );
      });
    };
    const observer = new MutationObserver(measure);
    const window = document.querySelector('[data-slot="window"]');
    if (window !== null) observer.observe(window, { childList: true, subtree: true });
    globalThis.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    document.addEventListener("transitionend", measure, true);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      globalThis.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, true);
      document.removeEventListener("transitionend", measure, true);
    };
  }, [stage]);
  return (
    <DialogPortal>
      <div className="guide-highlights" aria-hidden="true">
        {outlines.map(({ target, rect }) => (
          <div
            key={target}
            data-onboarding-outline={target}
            className={`guide-outline guide-${target}`}
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          />
        ))}
      </div>
    </DialogPortal>
  );
}

function Point({
  target,
  title,
  children,
}: {
  target: Target;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className={`guide-point guide-${target}`}>
      <span className="guide-dot" aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </li>
  );
}

// A blank Playground thread is the welcome screen, not a demo or an existing conversation.
function onWelcome(shell: Shell): boolean {
  const active = shell.workspace.threads.find((thread) => thread.id === shell.active?.main);
  if (active?.place.kind !== "main") return false;
  return (
    active.place.projectId === STARTER.project.id &&
    active.turnCount === 0 &&
    viewOf(shell.doc, active.id).pane === "thread"
  );
}

// A destination carries its shell so advancing cannot open a missing or non-device demo.
function demoDestination(shell: Shell | null) {
  if (!env.demo || shell?.source.kind !== "device") return null;
  const thread = entryOf(shell.workspace, ids.project);
  return thread === undefined ? null : { shell, thread };
}

function guideStage(step: Stage, demo: ReturnType<typeof demoDestination>): Stage {
  if (step !== "waiting") return step;
  if (demo === null) return "waiting";
  return onWelcome(demo.shell) ? "projects" : "waiting";
}

/** Owns first-visit eligibility and the guide's steps, independently of sidebar preferences. */
export function useFirstVisitGuide() {
  const shell = useShell();
  const visitor = useVisitor();
  const [visit, setVisit] = useState<Visit>({
    visitor,
    step: "checking",
  });
  const demo = demoDestination(shell);
  const playback = useShow(demo?.thread ?? null);
  const key = `kay.onboarding.v1:${visitor}`;

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "dismissed";
    } catch {
      // Storage can be refused. The guide still works for this visit.
    }
    // oxlint-disable-next-line react/set-state-in-effect -- reconcile the account's browser preference after hydration
    setVisit({ visitor, step: dismissed ? "closed" : "waiting" });
  }, [visitor, key]);

  const step = visit.visitor === visitor ? visit.step : "checking";
  const stage = guideStage(step, demo);
  const close = () => {
    setVisit({ visitor, step: "closed" });
    try {
      localStorage.setItem(key, "dismissed");
    } catch {
      // In-memory dismissal still holds until the page reloads.
    }
  };
  return {
    stage,
    close,
    next: () => {
      if (stage === "projects" && demo !== null) {
        playback?.show.pause();
        demo.shell.open(demo.thread);
        setVisit({ visitor, step: "demo" });
      } else close();
    },
  };
}

/** A dismissible two-step guide over the actual project and playback controls. */
export function FirstVisitGuide({ guide }: { guide: ReturnType<typeof useFirstVisitGuide> }) {
  const { stage, close, next } = guide;
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (stage === "projects" || stage === "demo") title.current?.focus();
  }, [stage]);
  if (stage !== "projects" && stage !== "demo") return null;
  const step = STEPS[stage];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="first-visit-guide"
        data-guide-stage={stage}
        overlayClassName="guide-backdrop"
        initialFocus={title}
        finalFocus={() => {
          const target = targetElement(TARGETS[stage][0]);
          return target?.querySelector<HTMLElement>("a, button") ?? target ?? null;
        }}
      >
        <header className="guide-header">
          <p className="guide-progress">{step.number} of 2</p>
          <DialogTitle ref={title} tabIndex={-1} className="guide-title">
            {step.title}
          </DialogTitle>
          <DialogDescription className="guide-description">{step.description}</DialogDescription>
        </header>
        <ul className="guide-points">
          {step.points.map((point) => (
            <Point key={point.target} target={point.target} title={point.title}>
              {point.text}
            </Point>
          ))}
        </ul>
        {step.note && <p className="guide-note">{step.note}</p>}
        <footer className="guide-footer">
          <Button variant="ghost" onClick={close}>
            Skip tour
          </Button>
          <Button variant="outline" onClick={next}>
            {step.button}
          </Button>
        </footer>
      </DialogContent>
      <Highlights stage={stage} />
    </Dialog>
  );
}
