# Design Workbench - PRD

Status: draft 5, Nov 11 2026. Decisions confirmed by Ethan. This file is the source of truth; the
Amp artifact it came from is a copy. Background research: [code-native workbench
research](research/code-native-workbench.md).

## 1. Problem

Ethan has built the same app shell three times (yaklabs, garage, sierra-demo). Each time, giving it
a distinct look meant describing changes to an agent in words. Reworking the yaklabs shell took a
full day. Words are a poor instrument for spacing, proportion, colour and motion.

## 2. Product

Two things that ship together in this repo:

1. **The Template.** The yaklabs app shell and component library, copied over and scoped to one kind
   of app: agent-loop chat interfaces. It runs on a mocked agent loop, so design iteration costs no
   tokens. Its components are developed in Storybook with basic interactive data.
2. **The Workbench.** A no-code React web app for remixing the Template visually. You click, drag
   and scrub the real running code.

A new project starts as a copy of the Template, then gets its look in the Workbench. Ethan picks the
starting look each time: the plain baseline, a saved theme he likes, or the look of a previous
project carried over and saved as a new one.

## 3. Who it is for

Ethan, working alone, designing the look and layout of web apps. He designs like a motion and
graphic designer: by eye, by direct manipulation, with numbers available when he wants them.

## 4. The Workbench interface

Laid out like Figma:

| Side drawer | Centre | Right panel |
| --- | --- | --- |
| Component tree: the named components on the canvas, drawn by the Template in its own drawer (ADR-025). Assets come later: components, colours, type styles, looks | Canvas: the live preview, with selection outlines, handles and measurements | Inspector: the editable properties of the selection, as sliders, number fields, pickers and curve editors |

Two modes, offered under **More actions** on the welcome:

- **Live mode**, with the chat icon and tab. The preview is the Template app itself, running the
  mocked agent loop. This mode is for layout, chrome, and how components sit together. "Live" means
  the running UI, not a connection to a live model.
- **Component mode**, with the browser icon and tab. This is what earlier drafts called Component
  Canvas. The target is one component. If it is on screen, the preview stays the running app:
  the component is centred, only it and what is inside it can be selected, and its surroundings
  fade out (ADR-024). If the app is not showing it, the target is its Storybook story, framed at
  its own URL instead of a second renderer. The story half comes after the first usable version
  (R18).

Both modes edit the same design values, so a change made on a component shows up in the shell.
An edit to an element reaches as far as its mode says (ADR-023). In Component mode it is saved
under the component's name, so every instance changes, in the shell and in stories. In Live
mode it changes the one element selected. Component mode edits the inside of a component, its
own padding included; where the component sits and the space around it belong to Live mode.

Which mode to use:

- Component mode is for a new component, for a state the app is not showing, and for a change
  meant for every instance of a component that already exists.
- Live mode is for an edit to one instance and for where components sit.
- A component that appears once looks the same after an edit in either mode, so Live mode is
  expected to carry most edits to components already in the app.
- A new component, or a state with no story, needs an agent to write the component or the
  story first (ADR-001). The Workbench does not create either.
- A story is one state of one component. A flow across screens, a happy path and then an
  error path, is walked in Live mode by driving the app.

### Welcome and mock chat

Keep the current Vitruvian welcome and Atlas empty canvas. Remove the other splash artworks and
their picker. The welcome has no chat composer. The mock conversation shows the complete chat
thread, including user bubbles, agent bubbles, a card, and the user-choice modal.
Both welcome buttons open the completed Weekly brief with varied cards and the catalog's
user-choice fixture. Live mode fills the preview; Component mode frames the same chat panel.
In development, either button opens the Workbench with that conversation selected, so the
selection, spacing, and radius tools are reachable without typing an editor URL. Mode switches
inside the editor stay in its existing frame. Production builds show the mock without editor
endpoints. The component tree below is built (ETH-114). The focused view (ETH-115) and story
navigation (ETH-118) remain planned.

The scripted-demo transport bar is removed. Demo conversations open complete without Play,
typing animation, or a playback wait. Gateway, authentication, and live-model implementations
remain available for later work but are not needed for this preview flow.

The existing lane-and-card canvas remains a layout within the running Template. It is not the
Storybook-backed Component mode. Mode changes must not discard its saved lanes, cards, or threads.

### Component tree in the side drawer

While the app runs inside the Workbench, the drawer that rolls out for chat history lists the
components on the canvas instead of threads, in both modes (ADR-025). Each component is named
as it is in code. The tree is read from the page, so it lists only what is rendered. It opens
on the top-level groups, the panel and its turns, with nested components folded. In Live mode,
clicking a row selects its component in place: it scrolls only if the component is not fully on
screen, and its bounds show an outline with a light fill. Switching to Component mode then
focuses that component in place. In Component mode, clicking a row opens its component. In
Component mode the drawer also lists the stories of components the app is not showing, with
Storybook's labels, using its index as the source of truth. Outside the Workbench the drawer
keeps thread history. Built so far (ETH-114): the tree, and selecting an element from a row.
Opening Component mode from a row is ETH-115. The story list is ETH-118, after the first usable
version (R18).

## 5. Principles

**Core tenet: no translation step.** The thing being designed is the running code, and a change
made by hand lands in the repo as the same change. Nothing is ever redrawn from a picture, and no
feature may add a step where a person or an agent has to interpret a design to produce code. The
principles below follow from this.

1. **The preview is the document.** There is no separate canvas file. The saved state is source
   files in git.
2. **The Workbench edits values, never code.** Components say which value they use (`border-radius:
   var(--window-radius)`). A separate file says what each value is. The Workbench only writes that
   file, which it can read back without loss.
3. **Constrained beats general.** If something is not exposed as a design value, the Workbench
   cannot change it. It hands an exact request to an agent, who exposes it.
4. **Numbers stay honest.** Every handle shows the value it sets, snaps to the scale, and reads back
   what the browser computed.
5. **Imported components inherit the look.** As in yaklabs, the standard shadcn variable names
   (`--background`, `--primary`, `--radius` and the rest) are mapped onto the Template's baseline
   tokens. A shadcn primitive, block, or shadcn-based library component reads those names, so it
   arrives already wearing the current theme. Design values are the same vocabulary, so tuning one
   in the Workbench restyles imported components too.

## 6. The rules: what the Workbench may change

| The Workbench | Files |
| --- | --- |
| May write | The override file only (see below) |
| May read | Everything: the cascade, the DOM, source locations, Storybook's index |
| Never writes | Components, stories, tests, config, the baseline tokens |
| May commit | The override file only. It refuses if anything else is staged |

A **design value** is one CSS custom property the app reads: a colour, length, radius, font setting,
or a layout value such as a track size, an order or a grid area map. Durations and easing curves are
the same kind of thing and come later.

**The override file.** The Template's baseline tokens stay untouched. The Workbench writes one
stylesheet that loads after them and holds only the values Ethan has changed. It is a real file in
the checkout, loaded by both the app and Storybook, so the dev server hot reloads it. Discard is
emptying it. The diff of that file is the look.

## 7. Two lanes

| Lane | Who | Changes |
| --- | --- | --- |
| Values | Ethan, in the Workbench | The override file |
| Structure | An agent, from a request the Workbench writes | Components, stories, new regions, new design values |

The Workbench's operations (list values, set a value, check) are also a small command line tool, and
the Template carries one skill file telling any agent the rules. No custom agent harness.

## 8. The loop

| State | Where it lives | How you get there |
| --- | --- | --- |
| Committed | git | Press **Check and commit** |
| Saved | The override file on disk, running in the dev server | Automatic, when you release a handle |
| In hand | The browser only, while a handle is held | Dragging or scrubbing |

```text
git HEAD ──read baseline + override──> inspector and canvas
   ^                              │ drag: instant preview in the browser
   │                              v release
   │                       write one value to the override file
   │                              │ hot reload: app and stories now run the saved value
   │                              v
   └── commit override file <── Check and commit: one press, then type check and tests
```

**Saving is automatic. Committing is a button.**

- Auto-save keeps the promise that what you see is running code. There is never a hidden draft that
  differs from the files.
- Before each write, the Workbench confirms the file on disk is what it last read, and reports a
  conflict if not.
- Undo and redo step through edits since the last commit. Discard restores the override file from
  git.
- Check and commit is one press (ADR-026). It runs type check and tests and commits, with the
  message written from the change list. It shows no value diff, no message and no list of
  changes: the press accepts everything on the canvas. No screenshots: the canvas already shows
  the state.
  See [the story](done/check-and-commit/check-and-commit-story.md).

## 9. Requirements

Each requirement ends with its status on Nov 12 2026, read from Linear and the source.

### Must have for a first usable version

- R1. The Template: shell, component library, Storybook, and completed mock conversations with
  user and agent messages, varied cards, and a user-choice panel, without playback controls.
  *Built (ETH-99).*
- R2. The Workbench opens beside the Template's normal dev servers and frames them. It is absent
  from production builds. *Built.*
- R3. Two modes: Live mode and Component mode, offered under More actions with chat and browser
  icons. For this version Component mode opens a component the app is showing, in place.
  *Built (ETH-115).*
- R4. The component tree in the side drawer lists the named components on the canvas; click a
  row or the canvas to select. *Built (ETH-114).*
- R5. Inspector shows the design values of the selection, with a control per kind: scrub field with
  grid snap, colour picker with contrast readout, font controls. *Built (ETH-101, ETH-105 to
  ETH-107, ETH-109, ETH-113).*
- R6. Live preview while dragging; save on release; app and stories hot reload. *Built (ETH-101).*
- R7. Light and dark values are edited separately and clearly labelled. *Built (ETH-113).*
- R8. Undo, redo, discard. *Built (ETH-111).*
- R9. Check and commit in one press. *Built (ETH-112, ETH-117).*
- R10. The Workbench refuses to write any file but the override file, and says why. Its write
  endpoint exists in development only. *Built (ETH-100).*
- R11. Keyboard parity for every handle, as in today's Live mode. *Built, in each handle's ticket.*

**Exit gate.** The first usable version is done when R1 to R11 are all built and the first
success measure in section 11 has been timed once: the shell re-skinned to a clearly different
look in under an hour without writing a prompt.

### Next

- R12. **Request a design value.** Point at something that is not adjustable; the Workbench writes
  an exact request (element, file and line, current value) for an agent. *Built. ETH-110
  points at an element and discusses it; ETH-135 adds the file and line of the named component
  around it; ETH-136 adds its current values as rendered. The agent skill file that
  section 7 and block 6 name is `.agents/skills/design-values/SKILL.md` (ETH-134).*
- R13. Handles on the canvas for sizes, gaps, padding and radius, with measurement readouts.
  *Partly built: radius (ETH-101), gap and padding (ETH-102) have handles and readouts. Width
  and height are Live-mode fields in the inspector (ETH-137); their canvas handles are not
  started.*
- R14. Rearrange shell regions by drag, saved as layout values. *Not started.*
- R15. Assets panel: drag a component from the library into an allowed slot. *Not started.*
- R16. Themes: a theme is one override file. Save the current values as a theme, switch between
  themes, start a project from one. A preset is a partial theme covering one group of values, such
  as a colour palette or a font pairing (families, sizes and styles), so Ethan can swap to "font
  pairing 2" from the current state without losing his other changes. An agent can draft a theme
  from a component Ethan likes elsewhere by translating its styles into the Template's value names.
  *Partly built, as role-keyed theme files (ADR-028): save the colours as a palette, load and
  unload a palette or a type pairing (ETH-119 to 121). A project file carries a whole look into
  another checkout (ETH-125 to 127). Starting a project from a theme and agent-drafted themes are
  not built.*
- R17. Motion: scrub a running transition, edit duration and easing curves. *Not started.*
- R18. Open a story in Component mode: a component or a state the app is not showing opens as
  its Storybook story, and the drawer lists those stories. *Built (ETH-118).*

### Not doing

- Editing component code, class names or structure from the Workbench.
- A free canvas with absolute positioning.
- App types other than agent-loop chat interfaces.
- Native (Rust, Swift) targets. An Electron or Tauri app with a web UI already qualifies.
- Figma import or export. Multi-user anything.

## 10. Building blocks, in order

Each block is usable and testable before the next starts.

| # | Block | Proves |
| --- | --- | --- |
| 1 | **Template.** Copy the yaklabs monorepo whole (`apps/web`, `apps/storybook`, `packages/ui`, `packages/catalog` and the rest), replacing the workbook on this branch. Its scripted agent is the mocked loop. Prune what the Template does not need afterwards, one removal per ticket | There is a real, good-looking target to design against |
| 2 | **Override file format.** Parser and writer as pure functions | Read then write returns the same file, byte for byte |
| 3 | **Dev server plugin and command line.** List values, write a value, ownership and stale checks | A change reaches disk, the app and the stories, and nothing else can be written |
| 4 | **Workbench frame.** Component tree, canvas and inspector, two modes, selection, inspector controls, undo and discard | A look can be changed without typing a description |
| 5 | **Check and commit.** | A design session ends in a clean, reviewable commit |
| 6 | **Request a design value**, plus the agent skill file (R12) | Hitting the edge of what is adjustable does not mean going back to prose |
| 7 | **Canvas handles and readouts** (R13) | Dragging replaces the inspector for layout work |
| 8 | **Layout and assets** (R14, R15) | The shell can be rearranged by hand, without asking an agent |
| 9 | **Themes, motion** (R16, R17) | A look carries into the next project in minutes, and motion is tuned by eye |

Why this order: the Template comes first because the Workbench needs a real target, and it replaces
both the old workbook and the yaklabs calibration step. Blocks 2 and 3 are the translation layer.
Everything after is interface on top of them.

The first feature, the window's corner radius, cuts a thin slice through blocks 3, 4 and 7 for one
value. See [the story](done/corner-radius/corner-radius-story.md).

The current workbook is retired once the Template looks and feels good. The
`design-tutorial-workshop` branch keeps it as it is today.

## 11. Success measures

- Re-skin the shell to a clearly different look in under an hour without writing a prompt.
- Every commit the Workbench makes touches the override file only.
- Starting the next project takes minutes from any of three starting points: the plain Template, a
  saved theme, or a previous project's look saved as a new one. Ethan chooses how close to the last
  project it looks.

## 12. Look and interaction references

These are Ethan's stated preferences for how the Workbench itself should look and feel.

- **Charts and data visualisation use bklit.** Any chart in the Workbench comes from
  [bklit](https://bklit.com/docs/components/area-chart), installed through its shadcn registry
  (`https://ui.bklit.com/r/{name}.json`), not npm. Curve and bezier interfaces, such as a later
  easing editor, should match its look: dark, smooth curves, a crosshair, a blurred tooltip. bklit
  provides charts, not a bezier editor, so that editor is its own ticket. Example: [bklit replica
  thread](https://ampcode.com/threads/T-01a1be6a-57b0-7782-b617-247441f518b4).
- **Sliders and drag handles look sleek and minimal.** The reference is the [Moving mountains
  thread](https://ampcode.com/threads/T-01a1be69-69d6-77ac-97bc-2c6be01e9bd3), for its look only:
  small quiet handles, a readout pill beside the handle that shows the value and highlights on hover
  and drag, cursors that say which way a handle moves, and nothing decorative. How that example was
  built does not bind us. Each ticket picks the simplest technique that gives this look. Handles
  follow the pointer exactly, with no lag or bounce, and every handle also works from the keyboard
  (R11).

## 13. Decided

- Repo shape: a monorepo shaped like yaklabs.
- The Template starts as a whole copy of yaklabs, pruned later. The shell imports the runtime,
  world, demo and session code, so picking out components first would mean untangling most of the
  repo before anything runs.
- Sign-in, the gateway, and the live-model client remain intact but outside the main app flow.
  The default design session uses mocked data without sign-in or a gateway request. Revisit that
  boundary before sharing the app with other users.
- Browser targets are Helium, Chrome and Safari. Type changes need a Safari font-rendering check;
  Chromium alone does not establish Safari behavior.
- Themes come from both sources: Ethan's own tuned components, and components he likes elsewhere,
  translated by an agent.
- Themes and presets are not in the first usable version. One look at a time is enough to start.
- Opening a story in Component mode (R18, ETH-118) is not in the first usable version. That
  version closes on ETH-115 and ETH-117. (Ethan: "Move ETH-118 to Next in the PRD")
- A new project can start from the plain Template, from a saved theme, or from a previous project's
  look. No one of these is the default. Until themes ship (R16), starting from a previous look means
  copying that project's override file.
- The override file stays as the project's look.
- Stories live at `docs/feature/<name>/<name>-story.md` and tickets at
  `docs/feature/<name>/<name>-impl-<Linear ID>.md`. Each ticket ends in a drift log. A folder
  moves to `docs/done/<name>/` once every ticket in it is Done in Linear.
- Nov 12 2026, Ethan:
  - R12: a request's current value is the property currently rendered in Live mode ("the
    property currently being rendered in live mode").
  - R13: size handles are a Live-mode edit ("live mode").
  - R14: every shell region can be rearranged ("all shell regions").
  - R17: motion values are shared tokens, not per-element transitions ("shared").

## 14. Open questions

- How does a designer learn that a change broke or moved something on a screen, a state or a
  story that is not on the canvas? Not at the press (ADR-026). It needs the Workbench to load
  other screens and stories first (ETH-118), so it has no story and no ticket yet.
- Is a finished look folded into the baseline tokens, or does it stay in the override file for
  good? Revisited after the first finished app.
- How does R15 fit principle 2? Dragging a component into a slot changes what a component
  renders, which is structure, and the Workbench edits values, never code (ADR-001). Either
  what fills a slot becomes a design value the override file can hold, or the drop writes a
  request for an agent in the structure lane (section 7), or R15 is dropped. Undecided, so R15
  gets no story until it is.

## 15. OPEN ISSUES

### Four Storybook/browser flakes: deferred, revisit later (2026-11-12)

- **Both thinking timeouts reproduce under artificial CPU slowdown.** Profiling shows repeated
  input rendering spending time in React and Recharts. That explains these synthetic timeouts,
  but does not establish what slowed the original run.
- **Timed-out story plays continue into subsequent tests.** I captured an old play clicking its
  disclosure 2.5 seconds after Highlight Grab started. However, further runs with this overlap,
  including the complete thread story file, still passed Highlight Grab and produced none of its
  original 172 act warnings.

The original missing `data-grab` attribute and component-tree timeout remain unreproduced. I have
not retained a speculative fix, increased timeouts, added retries, or suppressed warnings.

After removing all probes, `pnpm --filter storybook test` passed **144 tests across 28 files in
42.76s**. `git diff --check` also passed. The earlier dependency-prebundle change remains local and
uncommitted; it is not a proven four-flake fix.

## 16. Installing into a repo, and theme files (proposed, Nov 12 2026)

Ethan, Nov 12 2026: the Workbench should install into an existing repo, the way Storybook does,
rather than every project cloning and reshaping itself to fit this one. A theme is the
Workbench's own JSON file, a translation layer between standard primitives and their colours,
fonts and hover colours. Neither writes the host app's code. This section is the plan; nothing
in it is built yet. Plan detail: [portability plan](research/project-portability-plan.md).

### How Storybook installs (checked Nov 12 2026)

- `npm create storybook@latest` (the older `storybook init` remains) runs in the project root,
  detects the framework and builder from its dependencies, installs devDependencies, writes a
  `.storybook/` config and adds `storybook` scripts.
- Storybook then runs its own dev server, which compiles the host's components with a builder
  (Vite, Webpack, Rspack). The host's app code is not changed.

### How the Workbench is tied to this repo today

- It is a Vite plugin in `apps/web/vite.config.ts`, serving `/__workbench/` from the app's own
  dev server. A host on Next or Webpack has no way to load it.
- The override file is imported by the app (`apps/web/src/root.tsx`) and by Storybook's
  preview. A host would have to edit its code to load it.
- It reads the canvas through `frame.contentDocument`, so the app must be on its origin.
- Components are found by `data-wb` names, which only this Template carries.

### Plan

- **One package, two commands.** `design-workshop init` adds the devDependency, a
  `.workbench/` folder and a `workbench` script. `design-workshop dev` starts the Workbench.
- **A proxy, not a plugin per framework.** The Workbench's server sits in front of the host's
  own dev server, whatever framework it uses, at one origin. It serves the Workbench page at
  `/__workbench/`, forwards everything else, and adds a `<link>` to the override stylesheet in
  HTML responses, so the host's code needs no import. Storybook is forwarded at `/__stories/`,
  as it is today. Rejected: one plugin per framework, several adapters to keep in step. The
  current Vite plugin stays as this repo's path until the proxy replaces it.
- **Files it writes, all under `.workbench/` in the host:** `overrides.css` (the live look, as
  today) and `themes/*.theme.json`. Never the host's components, config or styles.
- **Theme files.** A theme names roles, not the host's variables: surfaces (page, panel,
  compose), ink, accent, hover and focus colours, light and dark, and the text and display
  fonts. The project contract maps each role to the host's CSS
  variables and components. Applying a theme turns roles into override values by that map,
  deterministically. A palette or a type pairing is a theme with only those roles.
- **Finding components.** A host without `data-wb` names starts with only its slots and the
  roles the contract can find. Recognising primitives under other names stays a later
  capability.

### Decided (Ethan, Nov 12 2026)

- Storybook stays at the version installed in the orb, 10.6.0. Project files pin exactly that.
- Nothing is published to npm. The package is named `design-workshop`, with commands
  `design-workshop init` and `design-workshop dev`, used from a local path or workspace.
- `init` never edits the host's components. A host without `data-wb` names gets slots and roles
  only; adding names is the host's own change, made by an agent in the structure lane.
- The proxy replaces the Vite plugin in this repo too once it passes the same browser checks,
  so there is one path, not two.
