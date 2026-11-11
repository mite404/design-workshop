# Interface Atlas: a code-native visual design workbench

Research date: November 10, 2026. Research only; no application code changed.

This is the research that came before the PRD. Where the two disagree, [the PRD](../prd.md) wins: it
records later decisions, such as copying yaklabs whole and skipping the Onlook trial.

## Recommendation

**Build a constrained visual workbench over running React code, not a general-purpose graphics
editor and not a new renderer for copies of your apps.** Use Atlas for the editor interface and
teaching affordances. Let each target repo render its own components, fonts, CSS, providers, and
states. Start with yaklabs as the concrete target.

Both desired outputs are feasible:

- Direct source edits are tractable for explicitly registered CSS tokens, layout parameters, and
  component props with known owners.
- A detailed agent handoff is feasible for those edits and for changes the tool cannot safely write.
  Generate it from the same structured change record, not a screenshot interpretation.

The difficult part is deciding what an edit means in source. Moving a mock rectangle is easy.
Turning a drag on a real, responsive, stateful component into the right shared token, variant,
layout rule, or instance override is the product's central problem.

**Smallest useful slice:** select named regions of the real yaklabs shell, adjust a small set of
appearance and spacing decisions visually, drag a layout gap handle, save alternative looks, and
export both a reviewable CSS patch and an exact agent spec. No arbitrary JSX rewriting, component
reparenting, timeline editor, multiplayer, or infinite canvas in that slice.

Before committing to a custom editor, run a bounded Onlook trial on a disposable yaklabs checkout.
It is the closest existing candidate, but current documentation does not establish that its manual
property-editing workflow covers your need to avoid verbal iteration.

## Evidence and limits

Atlas was inspected at commit
[`94a319b`](https://github.com/mite404/design-workshop/tree/94a319bc33500bdb2ea3875218db2a818dc35264).
Yaklabs was read from a separate temporary checkout of remote `main` at
[`104a052`](https://github.com/mite404/yaklabs/tree/104a052309402b25b64c64b8114b69f5e4276523). This
is not a claim about any unpushed yaklabs work on your machine.

I read the Live mode implementation, styling, tests, token examples, layout controls, and
architecture notes. In yaklabs I read the shell composition and title bar, sidebar sizing and
persistence, theme and chrome choices, Storybook configuration and representative stories, CSS token
sources and aliases, and visual-drift tooling.

External findings use official docs and first-party repositories. No editor was installed or
benchmarked, and neither app was launched for this research. Compatibility and interaction quality
remain trial questions. The feasibility judgments and proposed architecture below are engineering
recommendations, not demonstrated integrations.

## 1. What Atlas actually provides

### Live mode is a deliberately small composition exercise

In
[`src/LiveMode.tsx`](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/src/LiveMode.tsx),
three title-bar groups have local React positions and a fixed 800px artboard. Pointer capture,
horizontal deltas, bounds, and 8px snapping change `left`. Four controls change window radius, bar
height, control size, and control gap. Selection and keyboard movement already exist.

[`src/LivePanels.tsx`](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/src/LivePanels.tsx)
adds two hard-coded panels, 192 × 400 and 512 × 440, in an 800 × 560 stage. Each panel's header
moves its whole group on both axes. Panel width, height, content, and typography are fixed.
Selection affects stacking; rectangle intersection produces overlap feedback.

[`src/index.css`](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/src/index.css)
positions these groups and panels absolutely. This is not a flex/grid authoring model.

The useful existing pieces are the measurement-first interaction, grouped selection, keyboard
alternatives, snapping, numeric controls, and collision feedback. They are good references for an
editor, not an editor engine that merely needs more inspector fields.

### State and output are not yet design documents

Live positions and measurements live inside `useState`. Reset restores defaults and remounts
`LivePanels`; leaving the Live page unmounts it. There is no durable design document, undo/redo,
source identity, target-repo connection, or source-write service in this path. The status says
"Session only · not saved", accurately.

The browser tests in
[`tests/live.spec.ts`](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/tests/live.spec.ts)
and
[`tests/panels.spec.ts`](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/tests/panels.spec.ts)
check real CSS geometry after uneven drags, keyboard movements, bounds, and reset. Preserve that
testing style in future work. Reading tests is not the same as running them here.

### `content.ts` does not currently own the design system

[`src/content.ts`](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/src/content.ts)
exports four pattern names and rationale, project fixtures, a 4/8/12/16/24/32/48 spacing list,
anatomy descriptions, and lessons. Its spacing entries drive the spacing lesson and reference
labels. They do not generate the Live mode constants or most CSS measurements.

The actual workbook colors and Tailwind theme declarations are in `src/index.css`; numerous
measurements are CSS literals or local component values. Calling the teaching list "tokens" does not
make it a round-trippable token pipeline.

[`App.tsx`](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/src/App.tsx)
already has a modest export precedent: LayoutLab passes columns, gutter, padding, and density to
`MockWindow` and generates a CSS recipe from the same values. That is useful because preview and
output share inputs. It is not a patch to a target application's source.

### Do not retrofit the whole workbook into a generic node tree

The existing [architecture
notes](https://github.com/mite404/design-workshop/blob/94a319bc33500bdb2ea3875218db2a818dc35264/docs/FOR_ETHAN.md)
explicitly say generalized layout-tree editors were removed because four teaching examples did not
need them. That remains correct for the workbook. A connected design workbench is a new capability
with different requirements. Keep lessons and mock patterns intact; introduce a separate
connected-target mode rather than replacing every example with an abstract renderer.

## 2. What yaklabs changes about the answer

### The app shell is real composition, not freely positioned panels

[`apps/web/src/shell/window.tsx`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/apps/web/src/shell/window.tsx)
composes a desk, desktop window, title bar, rail, sidebar stage, and workspace. Existing `data-slot`
attributes identify several useful regions. The desktop frame currently uses `md:inset-4` and
`md:rounded-[12px]`; mobile becomes full-bleed.

[`title-bar.tsx`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/apps/web/src/shell/title-bar.tsx)
uses actual sidebar, shell, and runtime state. Desktop height is `h-11`; mobile has its own two-row
grid. The tabs follow the docked sidebar through a `min-width` calculation using `--rail-width` and
`--sidebar-width`. Arbitrarily moving tabs would break that relationship.

[`sidebar-width.ts`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/apps/web/src/shell/sidebar-width.ts)
defines a 256px default, a 208px minimum, a 480px maximum, and a 40% viewport cap.
[`sidebar-choice.ts`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/apps/web/src/shell/sidebar-choice.ts)
persists the visitor's selected width and sets inline CSS variables, including a 3.5rem rail.

**Implication:** dragging a sidebar in a design session must distinguish changing a design default
from changing this visitor's saved preference. A root CSS override will not reliably win against the
provider's inline `--sidebar-width` either. Do not make sidebar-default editing the first
source-write feature.

### There is already a substantial token system

[`packages/catalog/src/tokens.css`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/packages/catalog/src/tokens.css)
owns semantic colors, local Inter and Newsreader fonts, spacing, and radius decisions. It also
contains theme-specific declarations and derived values such as `color-mix()` expressions.

[`packages/ui/src/styles/globals.css`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/packages/ui/src/styles/globals.css)
imports Tailwind and maps catalog tokens into shadcn and Tailwind names. Its `--radius: 4px` and
catalog `--btn-radius: 4px` are separately authored values. They should not be silently merged just
because they match.

[`apps/web/src/index.css`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/apps/web/src/index.css)
orders CSS layers as theme, base, catalog, components, utilities. Catalog CSS is imported into its
own layer; some app rules intentionally sit outside layers. A new preview stylesheet must respect
that cascade rather than scattering `!important` overrides.

This file also exposes `--workspace-radius`, `--panel-ease`, `--panel-peek`, `--panel-pin`, and
`--rows-leave`. The sidebar already has a shared cubic-bezier curve and separate peek/pin times.
That is an excellent eventual motion-editing target without adopting a timeline runtime.

### Storybook already edits real component props, but not the app shell

[`apps/storybook/.storybook/main.ts`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/apps/storybook/.storybook/main.ts)
loads stories from `packages/catalog` and `packages/ui`, not `apps/web`.

[`preview.ts`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/apps/storybook/.storybook/preview.ts)
sets the root's `data-theme` and chooses either catalog CSS or an app-cascade stylesheet. Those two
rendering environments are intentionally different. The app-cascade file repeats the shared import
order; it does not import all of `apps/web/src/index.css`.

[`ChatThreadPanel.stories.tsx`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/packages/catalog/src/ChatThreadPanel.stories.tsx)
already exposes panel width as a range and frame/carry choices as args, while keeping fixture data,
callbacks, and slots out of ordinary controls. Reuse these registrations where useful.

The current Storybook config does not register the full `Window` composition. That component reads
router, session, runtime, and shell contexts through its descendants. Importing it into Atlas, or
writing `<Window />` in a story, is not sufficient.

**Recommendation:** use a running, isolated yaklabs demo as the first shell preview. Do not make a
shell extraction or a complete provider-mocking project a prerequisite. Add shell stories later if
they become useful in yaklabs itself.

### Reuse the existing design-verification tool

[`tools/verify-ui-drift/README.md`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/tools/verify-ui-drift/README.md)
describes Storybook capture, light/dark themes, three browser engines, CSS token and contrast
checks, screenshot comparisons, and human baseline approval. `--app` includes the SPA shell.

[`app-capture.ts`](https://github.com/mite404/yaklabs/blob/104a052309402b25b64c64b8114b69f5e4276523/tools/verify-ui-drift/src/app-capture.ts)
already builds with auth disabled and a local lab agent, and opens a deterministic `?scenario=demo`
shell. It waits for content and fonts and blocks external requests during capture. This is a much
stronger starting point than duplicating the shell with mock rectangles.

Reuse its fixture and verification conventions, but not its still-capture settings for motion
judgment: that capture path requests reduced motion. A motion preview needs a separate normal-motion
interaction check and a reduced-motion check.

The README says Figma receives token exports as policy. The inspected CLI exposes run, selftest,
approve, and review, not a token-export command. Do not assume a complete bidirectional Figma
pipeline already exists from that sentence.

## 3. Existing tools: what to reuse and what not to assume

| Approach | Useful capability | Limitation for this goal | Recommendation |
| --- | --- | --- | --- |
| Onlook | Real app preview and source-edit workflow; older editor shows DOM instrumentation and AST writeback | Current desktop app and older open-source editor are different products; manual editing depth and yaklabs compatibility untested | Trial before building; learn from older source, do not assume current feature parity |
| Storybook | Existing real components, args, fixtures, theme globals, interaction tests | Controls edit exposed args, not arbitrary internals or app defaults | Reuse component previews and metadata; add selected-element editing where needed |
| Builder custom components | Registered real components and editable prop metadata | Visual composition/content ownership does not imply rewriting those components' internals | Borrow registration and allowed-child contracts |
| Plasmic | Code components, slots, variants; explicit generated presentation versus human-owned wrappers | Adopting generated presentation ownership is a substantial workflow choice | Learn the ownership split; avoid migrating yaklabs wholesale |
| Puck editor | MIT React editor with component fields and user-owned composition data | Its output is data for its renderer, not automatic patches to existing JSX | Consider when registered block composition becomes the problem |
| Figma + Code Connect/MCP | Visual exploration and precise production-component references for handoff | Mapping/snippets are not live editing of existing React source | Useful parallel design tool, not the round-trip authority |
| React Grab | Selection context, source paths, component stack, agent handoff | Source lookup is not a safe property writer; current style panel was removed | Optional context tool, not the editor foundation |
| Theatre.js | Visual property/keyframe animation authoring, exported project state | Requires explicit runtime bindings; not CSS/Motion code round-tripping | Defer unless timeline-based motion is actually needed |
| DTCG + Style Dictionary | Portable tokens and generated platform outputs | Tokens do not represent structure, interactions, or semantic scope automatically | Adopt for exchange when needed, not as a mandatory first migration |

### Onlook: distinguish current product from older architecture

The older [architecture page](https://docs.onlook.com/developers/architecture) describes injected
DOM attributes that point to source/component scope, transient DOM/CSS preview edits, AST
transforms, and serialized actions. The [public repository](https://github.com/onlook-dev/onlook)
describes the older Next.js/Tailwind editor and says broader framework support is theoretical. This
is an instructive implementation precedent, not proof that every React project works.

A fresh fetch of the current [documentation index](https://docs.onlook.com/llms.txt),
[architecture](https://docs.onlook.com/developers/architecture.md), and
[FAQ](https://docs.onlook.com/help/faq) describes a newer Apple-silicon Mac app: it creates a
separate git worktree, runs your dev command, displays app frames, and has Claude Code or ChatGPT
edit the copy. The current architecture page explicitly warns assistants not to confuse it with the
public browser editor. It says detailed source/developer docs are forthcoming.

The current [interface tour](https://docs.onlook.com/start/interface.md) describes Design mode
selection followed by a typed change request. It does not establish a Photoshop-like inspector for
every style property. Newer Vite support claims are encouraging, but pnpm workspaces, React Router,
workers, stylesheet aliases, and deterministic shell state still need an actual yaklabs trial. The
current app cannot be evaluated on this Linux orb without a different environment.

### Builder, Plasmic, and Puck solve a narrower ownership problem

[Builder registration](https://www.builder.io/c/docs/custom-components-setup) provides an actual
component and input definitions. The component remains in your repo. Inputs expose its props; they
do not make every descendant automatically editable. Builder's custom-component integration is
distinct from its other code-generation products.

[Plasmic registration](https://docs.plasmic.app/learn/registering-code-components/) adds real
components, prop controls, and slots. Its [codegen
scheme](https://docs.plasmic.app/learn/codegen-components/) separates regenerated presentational
files from developer-owned wrappers, which it creates once and then leaves alone. This works because
both parties have explicit ownership, not because arbitrary source edits can always be reconciled.
Its [loader/codegen comparison](https://docs.plasmic.app/learn/loader-vs-codegen/) also
distinguishes runtime-loaded design content from checked-in generated source.

[Puck](https://puckeditor.com/docs) is a useful open-source alternative for registered block
composition. Its [component
configuration](https://puckeditor.com/docs/integrating-puck/component-configuration) provides fields
and a render function; the editor emits a data payload consumed by `<Render>`. It could supply a
later composition UI. It does not remove the need to define how that payload becomes your repo's
preferred CSS, props, or JSX.

### Storybook provides an inexpensive first experiment

[Controls](https://storybook.js.org/docs/react/essentials/controls) re-render stories from args, and
support creating/editing stories from controls in supported authoring environments. Saving a story
changes a story, not the component's production defaults.
[Args](https://storybook.js.org/docs/writing-stories/args) also have serialization limits: callbacks
and arbitrary JSX cannot simply travel as JSON between editor and preview. Use named fixture/slot
choices instead.

### Source lookup and source writing are separate capabilities

[React Grab's
architecture](https://github.com/aidenybai/react-grab/blob/main/packages/react-grab/docs/architecture.md)
uses React fiber/owner stacks and source-map symbolication to identify source. This can improve the
handoff immediately, especially when multiple wrappers obscure the feature component.

It does not tell you whether the intended edit belongs in a shared primitive, the calling JSX, a
variant, or a token. Repeated list instances can share the same JSX source location. Source maps
locate authored code; they do not invert React rendering or CSS computation.

Its current [changelog](https://www.react-grab.com/changelog) says version 0.2.0 removed the Style
action/panel, inline previews, CSS controls, and token handling. Do not base the roadmap on old
videos showing that panel. Pin and inspect any dependency version before adopting it.

### Figma and motion tools are optional specialists

[Figma Code Connect](https://developers.figma.com/docs/code-connect/) and its [MCP
integration](https://developers.figma.com/docs/figma-mcp-server/code-connect-integration/) associate
design components with production paths, property mappings, and code examples. They make agent
context more precise. They do not prove automatic bidirectional synchronization with existing app
source. Figma remains useful for illustration, vector work, and broad visual exploration; rendering
existing code avoids a second approximation for routine app layout.

[Theatre projects](https://www.theatrejs.com/docs/latest/manual/projects) store authored properties
and sequences as JSON, editable in Studio and importable into Core. It can animate bound DOM
properties, not only 3D scenes, but you must write the bindings. Exported Theatre JSON is an input
to Theatre's runtime, not an equivalent CSS or application animation patch. The
[repository](https://github.com/theatre-js/theatre) distinguishes Apache-licensed Core from
AGPL-licensed Studio and notes private development of a forthcoming version. Review the exact
release, license, and integration before embedding it.

The [DTCG FAQ](https://www.designtokens.org/faq) identifies stable format version 2025.10 and
explicitly says it is not a W3C Standards Track specification. [Style
Dictionary](https://styledictionary.com/info/tokens/) accepts DTCG-style `$value`/`$type` tokens and
supports transforms/output generation. Use these for interchange when there is a second consumer.
For one web repo, editing its existing CSS source is smaller and avoids two competing authorities.

## 4. Recommended architecture

### Render the target repo, not a transplanted app

Atlas should contain the selection UI, inspector, visual measurements, saved looks, and export
review. A frame displays a preview served by the target repo. A small development-only script inside
that preview reports registered elements and applies supported edits.

Do not import yaklabs source directly into Atlas. That would require reproducing its router,
providers, Tailwind compilation, aliases, fonts, and runtime. Keeping the target's own dev server
preserves those conditions and makes the same approach usable in another repo.

For shell work, begin with the isolated demo configuration already exercised by yaklabs'
verification code. For component work, a Storybook preview frame is appropriate. Do not require both
preview mechanisms in the first slice.

### Register editable decisions, not every DOM node

A small target registration should identify:

- A stable region/component ID, with an existing `data-slot` locator where suitable.
- Editable properties, units, ranges, and reset behavior.
- Whether each change affects a theme, a shared component, a named variant, or one instance.
- The exact authored owner and supported write operation.
- The preview state or fixture needed to see the edit.

Initially this can be one yaklabs registration module. No plugin marketplace, universal schema
language, or automatic component discovery is needed. Reuse Storybook arg metadata where it already
describes the same decision; do not duplicate every story into a second registry.

For existing components, attach refs/attributes to their real roots where possible. Empty wrappers
should expose meaningful layout boundaries and child slots, not duplicate business logic. Extra DOM
can change flex/grid layout, selectors, sticky positioning, and accessibility. A wrapper around a
component cannot edit its internals unless those internals expose a prop, CSS variable, or explicit
registered region.

### Keep source authority distinct from the pending design session

The target repo remains authoritative for the applied design. The editor keeps a durable pending
change set over a particular source revision. Each entry identifies target, property, scope,
authored old value, proposed value, and units. Store current pending values plus an undo history;
there is no need for a distributed event system.

A drag updates preview state continuously but becomes one undo transaction on release. Numeric
fields and keyboard actions use the same operation. Presets are alternative change sets against a
baseline, not copied components or opaque full-app snapshots.

When source changes externally, re-read it. If the edited owner changed, mark the operation
conflicted instead of silently overwriting it. A selected DOM node disappearing after HMR is a
selection issue, not permission to guess a new target.

### Preview and save are different actions

Preview changes must not depend on waiting for an agent or a source rebuild on every pointer move.
Apply registered variables/props locally in the target frame. On Save, show the source diff,
validate old values, write supported owners, let HMR update the target, clear transient overrides,
and re-measure the result.

A static hosted Atlas page cannot silently write to another repo's filesystem. Direct writes require
a local companion process or a process beside that checkout in an orb. Browser file access could be
an opt-in export path, but is not a generic cross-repo write mechanism.

Start with patch download/export if a writer service would delay the interaction experiment. Add
direct local apply next. Export must report "patch generated" separately from "applied and
verified". Neither action implies a commit, push, merge, or deployment.

### Use one change record for both outputs

The deterministic output is a patch to a registered owner. The agent-facing output is a
human-readable account of the same operations plus context. Unsupported structural changes should be
recorded as proposals, clearly separated from changes the preview can reproduce.

An agent handoff should include repo/revision, preview route or story, fixture, theme, viewport,
selected IDs and source hints, authored before/after values with units, semantic scope, layout
constraints, screenshots, and acceptance checks. Motion adds trigger, interruption behavior,
duration/curve or keyframes, and reduced-motion behavior.

That is substantially more exact than "move the tabs left". A screenshot alone cannot tell an agent
which responsive relationship or shared token you intended to change.

## 5. Source ownership and round-trip rules

| Decision | Source authority | Safe initial operation |
| --- | --- | --- |
| Shared palette/type/radius token | Specific CSS declaration in its theme/scope | Replace that declaration after checking its old value |
| Shell gap, padding, height | Named shell CSS variable introduced at the actual owner | Change variable; keep responsive layout rules intact |
| Component presentation prop | Registered prop/variant with explicit owner | Preview as args; export only to the declared config/call site |
| User's sidebar width | Existing persisted user preference and sizing policy | Preview in isolated state; do not confuse with a design default |
| Reorder/reparent | Human-owned composition source | Produce proposal/spec until a constrained structural writer exists |
| Timeline motion | Chosen runtime's authored state | Save native state, or export a spec; do not promise lossless translation |

Do not keep CSS, Tailwind classes, editor JSON, and a token JSON file independently authoritative
for the same decision. A session record describes pending edits; it is not a second applied
production stylesheet. If a future token migration makes JSON authoritative, CSS becomes explicitly
generated and must no longer be hand-edited.

For the first CSS writer, use a CSS parser and a registered file/selector/property identity, not a
global string replacement. Selector alone may be insufficient when layers, media rules, or duplicate
declarations exist. Reject ambiguous owners. Write atomically and retain a recoverable before-state.
For several files, stage the full changes first and support rollback.

Arbitrary Tailwind rewriting is a later feature. `gap-2`, `md:gap-4`, conditional classes, CVA
variants, `tailwind-merge`, and inline variables can all contribute to one observed style. Appending
an arbitrary class is not a reliable round trip, and runtime-generated class names may not be
discovered by Tailwind's build scanner. Prefer existing variables; otherwise make an explicit,
one-time source change to expose the desired design decision.

## 6. Smallest useful first slice

### A shell appearance and spacing workbench

Connect Atlas to one isolated yaklabs demo frame. Register only the window and title-bar regions
initially. Let the designer click those regions, change controls, drag a gap handle, and compare
saved looks.

A suitable initial set is:

- Desktop frame radius: currently a 12px Tailwind literal. Expose a desktop shell variable once,
  preserving the mobile full-bleed rule.
- Desktop title-bar height: currently `h-11`. Expose a desktop-only variable without replacing the
  mobile two-row layout.
- Desktop title-bar group gap: currently `gap-2`. Expose a variable and let a visual handle adjust
  the gap instead of creating absolute X coordinates.
- Solid chrome color: edit the existing `--chrome` owner in an explicitly selected light or dark
  theme. Select the solid chrome variant so a painting does not obscure the result.

Those are proposed controls, not already implemented interfaces. Parameterizing the three literals
is a small, deliberate yaklabs integration change, not generic JSX mutation.

Leave shared body fonts and global radii for the next slice: they affect many consumers and need a
larger state matrix. Their eventual impact is important to a distinctive aesthetic, but they need
not block proving selection, dragging, persistence, and export.

### First-slice acceptance test

1. Open the same deterministic demo shell and select the title bar by its registered identity.
2. Drag a gap handle by a non-grid-aligned amount. Confirm the declared spacing value changes,
   siblings reflow, and keyboard/numeric alternatives produce the same result.
3. Change desktop radius, bar height, and the light-theme solid chrome color. Compare two named
   saved looks. Undo one drag as one action; reload the session without losing pending edits.
4. Export a patch and spec that agree on target, scope, value, and unit. Apply the patch through the
   normal review workflow, remove preview overrides, and reload the app.
5. Confirm the applied geometry and colors equal the preview. Check mobile still uses the existing
   composition and that dark theme changed only if explicitly edited.
6. Change an owned source value externally. A stale export/apply must report a conflict rather than
   overwrite it.

Success is a real shell you can reshape without describing every measurement to an agent. It is not
success if only the mock Atlas panels change or if the look disappears on reload.

## 7. Phased path and stop conditions

These are capability gates, not calendar estimates. The research did not benchmark development time.
Bounded token editing and arbitrary JSX round-tripping are very different commitments.

### Phase 0: test whether an existing product is enough

On a disposable yaklabs copy, try current Onlook with its actual pnpm/dev command and demo
configuration. Attempt the same four first-slice edits using direct manipulation, then inspect the
diff and reload. Check mobile, both themes, and whether shared values stayed shared.

If it produces maintainable changes with the desired nonverbal interaction, use it and add only
missing verification/spec export around your existing tools. Do not rebuild a satisfactory editor
for the sake of growing Atlas. If it still requires chat for routine measurements, or misidentifies
owners, proceed with the constrained workbench.

### Phase 1: prove the edit/export loop on one shell

Implement the first slice above with a target-frame script, explicit registration, pending session
persistence, undo, gap manipulation, patch export, and spec export. Keep one viewport frame active;
offer mobile/theme checks rather than a multi-artboard system.

This is a bounded developer-tool project. It should not require a generic JSX parser or a full
design-system migration. Stop and simplify if those become prerequisites.

### Phase 2: make it useful for aesthetic exploration

Add direct local apply with conflict checks, additional semantic color roles, typography controls,
selected shared spacing/radius values, token-reference preservation, and component/story presets.
Use yaklabs' drift checks to review all affected consumers. Present scope before changing a global
token. Provide baseline/alternative comparison and reference imagery without prescribing one
corporate design system across projects.

Add a second, differently structured React repo before extracting a shared target adapter API. Keep
each repo's palette, tokens, layout vocabulary, and constraints local. Generic editor mechanics do
not require a generic visual aesthetic.

### Phase 3: constrained composition

Introduce named slots and registered components for new layouts or empty scaffolded wrappers. Allow
explicit flex/grid operations: reorder siblings, choose alignment, change track sizes, dock a panel,
or move a block to an allowed slot. Check whether Puck supplies enough of this UI before writing a
component palette, nested drag/drop, and configuration editor yourself.

Use deterministic code generation only for files the tool owns, or a restricted AST writer for
supported human-owned forms. Keep unknown code read-only. New generic composition is a separate
project from Phase 1 and should earn its place through repeated use.

### Phase 4: motion authoring

Start with editable durations and a cubic-bezier curve for yaklabs' existing peek/pin behavior.
Replay the real hover, focus, toggle, and interruption cases. Support keyboard-immediate and
reduced-motion behavior explicitly.

Only add Theatre-style keyframe timelines if repeated work needs choreographed multi-property
sequences that simple CSS/WAAPI controls cannot express. Choose a native export/runtime strategy
before adding a timeline. Do not promise identical motion across unrelated animation engines.

### Beyond the current goal

Arbitrary existing-repo JSX editing, raster painting, vector path tools, constraint inference, and
multi-user collaborative editing are independent products. "Realtime" here should mean immediate
local preview while dragging. No collaboration server or CRDT is needed for that.

## 8. Hard problems that cannot be hidden by a nice inspector

### Inferring intent from position

For flex/grid UI, a 24px horizontal movement could mean padding, gap, width, alignment, ordering, or
an optical transform. Require a declared editing tool: gap handle, padding handle, resize, reorder,
or free-position mode. Show which property will change before the drag begins. Use free coordinates
only inside a genuinely free-positioned canvas. Make snapping optional; optical alignment and
typography do not always belong on an 8px grid.

### Identity, reuse, and ownership

One JSX expression can create many rows; one shared button can appear in many routes. Maintain
separate definition and instance identities. An instance selection must not silently edit every
button, and a shared-token edit must show its wider scope. Source-map line numbers are hints, not
durable IDs across edits. Start with explicit registrations; consider build-time JSX IDs only when
manual coverage is demonstrably insufficient.

### CSS is not reversibly computed

Computed styles lose aliases, original units, fallback values, conditional rules, and authorship.
The same resolved color can represent unrelated semantic tokens. Preserve authored values and token
references alongside computed measurements. A computed color match is only a candidate, not proof of
semantic interchangeability.

Custom properties with `var()` aliases resolve in a scope. Overriding a base token on a child may
not recompute an inherited alias resolved at the root. Preview at the correct declaration scope and
re-check dependent computed styles. Theme selectors, portal-mounted menus, inline provider
variables, media/container queries, and unlayered rules all need explicit treatment.

### Runtime state must not become design source

Menus, hover peeks, tabs, loading states, localStorage choices, and route state affect what is
visible. A design session needs repeatable fixtures and a distinction between Select and Interact
modes. Do not trigger destructive product actions while selecting. Do not freeze the app globally
when judging how an interaction feels. Give story/demo state a reset mechanism independent of
undoing style changes.

### Writers must coexist with humans and agents

Validate owner identity and expected old value at apply time, preserve unrelated work, and reject
stale edits. Repeated application should converge or report "already applied" rather than append
duplicate rules. Formatting should touch the smallest owning region. Apply-time build failures must
leave the pending session and recoverable source state intact.

### Cross-repo transport is a security boundary

A preview script should exchange a small validated message protocol, not arbitrary code or
filesystem commands. Verify message origin, frame identity, and session capability. Allowlist
preview origins and writable paths; reject path traversal and symlink escapes. Protect a local
writer against cross-site requests and DNS rebinding. Do not expose an unauthenticated source-write
endpoint through an orb portal. Production builds must omit the editing script and writer.

### Portability has a ceiling

Target-served previews avoid copying build systems, but each repo still needs registrations,
fixtures, scope rules, and source writers. React/Vite/Tailwind is a reasonable initial family; "any
framework" is not a credible first contract. A second real repo is the test of genericity, not an
adapter interface written in advance.

## Decision

Proceed toward a code-native appearance workbench if an Onlook trial does not satisfy the
direct-manipulation requirement. Keep Atlas's workbook intact. Connect to the real yaklabs demo,
expose a few shell-owned decisions, and prove preview-to-patch-to-reload fidelity before expanding.

That path directly addresses the day spent describing the yaklabs shell. The user moves a
relationship or changes a visual decision; the tool records exactly what changed and where it
belongs. An agent remains useful for structural work, but no longer has to interpret every gap,
corner, and color from prose.
