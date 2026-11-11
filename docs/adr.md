# Architecture Decision Records

Design decisions and engineering trade-offs for the Workbench, in the order they were decided,
newest at the bottom. The log is append-only: a record is never rewritten. A later change is a
dated "Amended" line inside it, or a new record that supersedes it. Status is one of: Accepted;
Proposed; Superseded (by ADR-N). A quote marked "(Ethan: ...)" is the decision as it was given.
Where a decision first landed in a commit, the commit is named.

## ADR-001 - The Workbench edits values, never code

2026-11-11 - Accepted. Commit `9044003`.
A design change is a change to one CSS value, not a patch to a component. Rewriting source from a
visual tool is the hard problem every code-native editor stalls on, so we do not start there.

## ADR-002 - One override file is the only file the Workbench writes

2026-11-11 - Accepted. Commit `9044003`.
Every changed value lives in one plain CSS file loaded after the baseline tokens, so a design
session is one small, reviewable diff. Rejected: a JSON values file (needs a build step and loses
free hot reload) and a CSS parser dependency (the tool writes the format, so it can read it line
by line).

## ADR-003 - The Template is the whole yaklabs shell

2026-11-11 - Accepted. Commit `9044003`.
The yaklabs app shell and component library come into this repo whole, on a mocked agent loop.
Hand-picking components was rejected: the shell's parts depend on each other, and a partial copy
would be a different app from the one being designed.

## ADR-004 - Changes save on release

2026-11-11 - Accepted. Commit `9044003`.
A value is written when the drag ends, on Enter, or on blur, and the app hot reloads. There is no
save button; Escape during a drag restores the earlier value.

## ADR-005 - One value, three inputs

2026-11-11 - Accepted. Commit `9044003`.
A value can be typed in the inspector, scrubbed by dragging its label, or dragged on the canvas,
and all three stay in sync. Keyboard parity is required for each, so nothing is mouse-only.

## ADR-006 - Build on the browser, not on an editor framework

2026-11-11 - Accepted. Commit `9044003`.
Full editors (Onlook, Puck, Plasmic, tldraw, Excalidraw) and a drag library were rejected for the
first features. Each brings its own document model, and ours is already the DOM and CSS.

## ADR-007 - Stories and tickets are files; Linear is the board

2026-11-11 - Accepted.
Each feature has a story and a ticket file under `docs/feature/<name>/`, and each ticket ends in a
drift log so the plan and the build can be compared. Linear tracks progress at a glance. GitHub
issues were tried for the first three tickets and dropped as duplicate bookkeeping.

## ADR-008 - The agent mocks up, the designer tunes

2026-11-11 - Accepted.
The Workbench has no tools for drawing shapes or building layouts by hand. An agent produces the
structure, and the designer adjusts cards and surfaces by click and drag.

## ADR-009 - When undecided, do what Figma does

2026-11-11 - Accepted.
(Ethan: "if you're ever uncertain my answer will most likely be 'how did they do it in figma'".)
Figma's auto layout is itself a subset of flexbox, so its gap and padding map straight onto CSS
`gap` and `padding`. Differences from Figma are listed in each story.

## ADR-010 - Drags snap to 2px

2026-11-11 - Accepted.
A drag moves a value in steps of 2px, or 10px with Shift; odd values are typed. Figma's default
step is 1px. The coarser step keeps values on a rhythm without a separate grid setting.

## ADR-011 - The canvas is the running app

2026-11-11 - Accepted.
Figma draws its canvas itself, on a `<canvas>` element with its own renderer and layout engine.
Ours is the real DOM with handles overlaid, so what is tuned is what ships. The cost is no
infinite zoom or pan, and nothing CSS cannot express. (Ethan: "tuning the shipped result ... and
have it still be working representation of the code and then pushed back to the code is worth the
trade off".)

## ADR-012 - No tagging before editing

2026-11-11 - Accepted, with the spacing story.
(Ethan: "i would prefer to not tag something before editing. that sounds tedious".) Any element
is selectable, and the Workbench identifies it by a CSS selector generated from its position in
the page. The cost: if an agent restructures a mockup, saved values for moved elements stop
matching, so they are listed for the designer, not dropped. The override file therefore holds one
block per selector as well as the `:root` block.

Amended 2026-11-11: the objection was to the designer tagging, not to tags. (Ethan: "if the app
is taggging behind the scenes that's okaky with me".) Agents that build mockups add a
`data-wb="<name>"` attribute as a house rule, and the Workbench prefers it as the stable
identity. The generated selector is the fallback for untagged elements. The Workbench itself
still never writes to source (ADR-001).

## ADR-013 - A nudge is an offset, not a layout change

2026-11-11 - Accepted, with the spacing story.
Dragging an element moves it visually while it keeps its place in the layout, so siblings do not
shift, and it cannot leave its parent. Figma's "ignore auto layout" removes the element from the
layout, which a value-only tool cannot do without rewriting source (ADR-001).

## ADR-014 - Core tenet: no translation step

2026-11-11 - Accepted.
The design is the running code, and a change made by hand lands in the repo as the same change.
(Ethan: "i don't want imperfect translations or an extra step when the design can lead straight
back to the code".) Any feature that would need a person or an agent to interpret a design to
produce code is out. ADR-001 and ADR-011 are consequences of this.

## ADR-015 - Values stay even

2026-11-11 - Accepted. Gives the reason for ADR-010.
The 2px step is a rule about values, not only about drags. A design engineer Ethan follows
scales type in multiples of 2 or 4, so an odd size, gap or padding is almost never intended.
Dragging cannot produce one; typing one stays possible as the escape hatch.

## ADR-016 - The Template carries no yaklabs process

2026-11-11 - Accepted.
The copy keeps yaklabs' code and drops its process: the ADR log, `AGENTS.md` and the git hooks
(lefthook and its `prepare` script, which unset the orb's global hooks path). This project keeps
its own decisions here and its own `.agents/setup`. ADR numbers in copied code comments are
citations of the yaklabs log, not of this one.

## ADR-017 - Commits ship straight to main

2026-11-11 - Accepted.
(Ethan: "unless stated otherwise i'll always want you to ship commits directly to main in this
project for speed".) No pull request and no approval wait. The checks an agent ran stand in for
review, so each commit message or report names them.

## ADR-018 - TypeScript 7

2026-11-11 - Accepted.
The whole repo, Template included, moves to TypeScript 7 for the native compiler's speed.
One deviation: `tools/verify-ui-drift` parses scripts with `@typescript/typescript6`, because
TypeScript 7 no longer ships the in-process compiler API; it still typechecks on TypeScript 7.
Amended 2026-11-11: the deviation is gone with `tools/verify-ui-drift` (ADR-020); nothing in
the repo depends on `@typescript/typescript6` now.

## ADR-019 - Type steps use Tailwind's names

2026-11-11 - Accepted, with the type scale story.
The nine type sizes are named as Tailwind names them, `--text-2xs` to `--text-4xl`, and valued
once in the baseline tokens. Tailwind's size classes already read those variables, so plain CSS,
Tailwind classes and imported shadcn components all follow one scale with no mapping (ADR-014).
The cost: `text-lg` and larger no longer mean Tailwind's default sizes. Rejected: names of our
own, which would need a mapping for every step.

## ADR-020 - No UI drift check

2026-11-11 - Accepted.
(Ethan: "the drift tool was something i built to impress an employer i don't think it applies to
this since the app will be constantly changing a component or view's look. lets delete the
drift-ui cli script and skill for now".) `tools/verify-ui-drift`, its baselines, its page at
`/verify-ui-tooling` and the welcome's seal that led there are removed. The Workbench exists to
change the look, so a check that the look has not changed works against it.
