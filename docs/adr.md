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

Amended 2026-11-11: a feature folder moves to `docs/done/<name>/` once every ticket in it is
Done in Linear, so `docs/feature/` holds only open work. (Ethan: "lets move any feature dirs
that are done into a docs/done/ dir")

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

Amended 2026-11-11 (ADR-023): `data-wb` on a component's root is the component's name as it
is in code. In Component mode a name that several elements share is still the identity, so one
edit reaches every instance.

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

## ADR-021 - Chosen Google fonts live in the repo

2026-11-11 - Accepted, with the type inspector story. Amends ADR-002.
A Google font picked in the Workbench is copied into the repo: its files and licence under
`packages/catalog/src/fonts/`, and its `@font-face` rules in `packages/catalog/src/fonts.css`, a
second file the Workbench writes. Every value still lives in the override file; `fonts.css` only
declares fonts, which do not fit that file's one value per line. The mockup is the running app,
so it carries its own fonts (ADR-014). A font installed on the computer is saved by name only and
shows only where it is installed (Ethan: "this tradeoff is acceptable for now"). Rejected:
loading fonts from a font server at run time, which breaks offline and depends on someone else's
server, and uploading font files.

## ADR-022 - CI runs every check on each push to main

2026-11-11 - Accepted.
With no pull requests (ADR-017), GitHub Actions is the review that does not depend on an agent's
word. `.github/workflows/ci.yml` runs on every push to `main`: a frozen install, Playwright's
Chromium, then typecheck, lint, format check, Fallow, tests, the app build and the Storybook
build. `pnpm test` runs one turbo task per two CPUs: on a 2 CPU, 3.9 GB orb, turbo's default
of ten at once ran out of memory and stalled tests past their timeouts, and the Storybook suite
alone needs up to 2.1 GB. Rejected: longer test timeouts, which hide the stall instead of
removing it.

## ADR-023 - A component has one name, and the mode decides how far an edit reaches

2026-11-11 - Accepted. Amends ADR-012.
Each component's root element carries `data-wb` with the component's name, spelled as it is in
code. (Ethan: "i was hoping the name of the component (in code) would be identical".) An edit
made in Component mode is saved under that name plus the path inside the component, so it
reaches every instance, in the shell and in stories. An edit made in Live mode is saved as
before, for the one element selected. This is Figma's main component and instance (ADR-009).
Component mode edits the inside of a component, its own padding included. Where it sits and
the space around it belong to Live mode. (Ethan: "i was referring to only editing the things
within a component that affect the component itself".) The name is in source because the
override file ships, and its selectors have to match the built page. Rejected: reading names
from React while editing, which leaves nothing in the page for a saved rule to match.
Rejected: a "Push to live" button; once both modes share the name there is nothing to push.
The cost: a component whose inner structure differs between states can leave a saved value
unmatched. As in ADR-012 it is listed, not dropped.

## ADR-024 - Component mode is a view into the running app

2026-11-11 - Accepted. Changes PRD section 4, which made a Storybook story the only target.
Opening a component that is on screen keeps the running app in the frame. The component is
brought to the centre, only it and what is inside it can be selected, and what surrounds it
fades out. (Ethan: "show some of the surrounding components to the one currently being
editing and have a gradient fade to invisible so its like a 'view' into where the currently
edited component is in the app".) A Storybook story is the target only for a component or a
state the app is not showing, and it has no surroundings to fade. The build order is names,
the tree, focus, then stories. Focus needs one document, one cascade and one dev server, so
the forward to Storybook, the HIGH risk in ETH-115, no longer blocks Component mode.
Rejected: drawing stand-in surroundings around a story, which would be a picture, not the
running code (ADR-014).

## ADR-025 - One component tree, in the Template's side drawer

2026-11-11 - Accepted. Replaces the left Layers panel of PRD section 4.
What is on the canvas is listed once, as a tree the Template draws in its own side drawer in
place of the thread list while it runs inside the Workbench. (Ethan: "a 'component tree' in
the current side drawer (what replaces the list of threads currently)".) The tree is read from
the page, so it lists only what is rendered. (Ethan: "only the comopnents that are actively
rendered in live view".) Rejected: a Layers panel beside the canvas as well as a list in the
drawer, which is two lists of the same thing. The costs: the Template carries a tree that
exists in development only, the first Workbench interface inside the app; the thread list is
not shown while the app is in the Workbench; the fade of ADR-024 must leave the drawer
visible; and a story is shown in a frame inside the app, so that the drawer stays, which puts
the document being edited two frames down from the Workbench.
Amended 2026-11-11: a row is a component and nothing else. The elements inside a component,
its named parts included, are selected by clicking the canvas. (Ethan: "no layers, no child
elements. if i want to edit just a `<p>` inside a component then i can click on it directly".)

## ADR-026 - Check and commit is one press, and its review is what else changed

2026-11-11 - Accepted. Changes PRD section 8 and criteria 2 and 7 of the check and commit
story. The first half reverses what ETH-112 shipped.
Pressing **Check and commit** is the decision. The Workbench does not show the value diff or
the commit message first, and does not ask for a second press. (Ethan: "for a visual designer,
we don't need to see the commit message or the value change. just pressing check & commit is
enough to know that we're concretizing a decision".) The message is still written from the
change list. It is read in git.
The review worth a designer's time is what the change did to the things they did not edit.
(Ethan: "the more important thing is checking that the visual change doesn't break the app or
shift other elements or components in unexpected ways. but that should probably be a new
feature plan & ticket".) It is planned as its own ticket, and its criteria stay a draft until
Ethan confirms them.
This is not the drift check ADR-020 removed. That check held the look to a stored baseline, so
every intended change failed it. This one stores nothing and fails nothing. It lays the screen
out with the last commit's values and with the values now, and lists what moved or changed
size besides the elements that were edited. The intended change is the point, and the list is
everything else.
Rejected: comparing screenshots pixel by pixel, which is slow, needs stored images, and cannot
name the component that moved.
The costs: the note that repository hooks still run, which Ethan asked to keep visible, loses
the review it sat in and has to stay beside the progress; and with no second press, cancelling
during the checks is the only way back from a press made by mistake.
Amended 2026-11-11: there is no list at the press. The press accepts everything on the canvas,
including what an edit moved. (Ethan: "any change that exists on something when i click 'check
& commit' would be implicit. i don't need to see a list of all the things im about to change,
b/c i've already thought about it and modified values directly in the editor view".) The draft
list is withdrawn. It compared only the screen in the canvas, which the designer had already
looked at, and it waited for a second press. A check is worth having only for screens, states
and stories that are not on the canvas. That is an open question in PRD section 14, with no
story and no ticket. The cost: something an edit moved below the fold of the current screen is
not reported.

## ADR-027 - A Live-mode tree pick selects in place

2026-11-12 - Accepted. Commits `81be6da`, `583cc1b`. Amends ETH-115 criterion 1.
(Ethan: the drawer should list components as groups, and a Live-mode click should scroll a
component into view only if it is not visible and highlight it.) The tree opens with nested
components folded. In Live mode a row selects its component without switching modes, scrolling
only when it is not fully on screen; the pick is still recorded, so Component mode focuses it.
Rejected: switching to Component mode on every row click, which made Live mode unreachable from
the drawer.

## ADR-028 - Theme files are role-keyed JSON, applied through the override file

2026-11-12 - Accepted. Amends ADR-002 and R10.
(Ethan: "a proprietary JSON or YAML for the app as a translation layer between common
primitive components and reskinning the colors and fonts and hover colors. this wouldn't be
overwriting the code of the app".) A theme names roles (surfaces, inks, accent, hover, focus,
fonts, type scale), not CSS variables. A role map turns roles into a host's design values.
Applying a theme writes those values into the override file through the normal save path, so
undo, Discard and Check and commit are unchanged and the override file stays the only live
look. The Workbench may also create new files in `.workbench/themes/`. JSON over YAML: both
the browser and Node parse it with no dependency. Rejected: CSS theme files, which tie a theme
to one app's variable names. A colour role may set one mode only, so a dark theme (Vesper)
or a light one (Catppuccin Latte, Ethan's two picks) leaves the other mode alone. Unknown roles
and malformed values refuse the whole file.

## ADR-029 - A project is accepted by a JSON contract and a pure validator, never an agent

2026-11-12 - Accepted.
(Ethan: checking a project file "must be entirely programmatic and deterministic. No agent or
LLM participates".) `contract.json` lists required slots, components, stories and surfaces per
shell kind. `validate` returns every failure as a stable code and path, sorted; an empty list
is acceptance. Agents may help write the contract during development, never interpret a file
being loaded.

## ADR-030 - Storybook is pinned to exactly 10.6.0

2026-11-12 - Accepted. (Ethan: "stay at the version of storybook that's installed".)
Project files record the Storybook version and are refused unless it equals 10.6.0. No ranges
and no support for older versions. Upgrading is one deliberate change to the pin, the lockfile
and the contract together.

## ADR-031 - Install into a host repo through a same-origin proxy

2026-11-12 - Accepted, not built. PRD section 16.
(Ethan: install "like how storybook works".) One unpublished package, `design-workshop`, with
`init` and `dev`. Its server sits in front of the host's dev server on one origin, serves the
Workbench, forwards Storybook and adds the override stylesheet to HTML, so the host's code is
never edited. It writes only under `.workbench/`. Rejected: one plugin per framework. Nothing
is published to npm.

## ADR-032 - Theme state is read from the override file, never the canvas

2026-11-12 - Accepted. Commits `27880ec`, `8b3d883`. Amends ADR-028.
Which theme is on, and which of its values to write, comes from the override file the page holds
and the tokens.css baselines (with `var()` resolved), not from the canvas's computed styles. The
canvas lags each write until its stylesheet reloads, so a canvas read right after an undo showed
the old theme and skipped the next apply (five red theme-check runs). Fonts are compared and saved
as `"Family", generic`, the only form the plugin writes, so a pairing saved at the baseline reads
as in effect there. Rejected: waiting for the canvas to settle, which still races a fast user.
