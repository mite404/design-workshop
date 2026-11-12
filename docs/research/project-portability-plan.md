# Themes, the project contract and project files: plan

Status: planning, Nov 12 2026. Written before any implementation. Decisions marked
**proposed** change an ADR or the PRD and wait for Ethan's confirmation; everything else follows
from the PRD (R16, sections 6 and 13) and the audit below.

## Storybook audit (Nov 12 2026)

Read from the repository and npm, not assumed.

| Fact | Value | Source |
| --- | --- | --- |
| Installed `storybook` | 10.6.0 | `apps/storybook/node_modules/storybook/package.json` |
| Locked | `storybook@10.6.0`, addons `@storybook/*@10.6.0` | `pnpm-lock.yaml` |
| Declared range | `^10.6.0` (catalog) | `pnpm-workspace.yaml` |
| 10.6.0 released | 2026-09-02 | `npm view storybook time` |
| npm `latest` | 10.6.7, 2026-11-10 | `npm view storybook dist-tags` |
| npm `next` | 11.0.0-beta.1 | same |
| Index format | `v: 5` | `storybook index` output |
| Stories | 93 stories, 0 docs pages, 13 story files | same |
| Tags seen | `dev`, `test`, `manifest`, `play-fn` | same |

Story files: AgentTree, AgentWorking, Button, Catalog, ChatThreadPanel, Disclosure, IconButton,
Menu, Modal, ReadingTools, Share, TextField, sidebar-section.

Each index entry names its source through `componentPath`. Seven story files set one:
AgentTree, AgentWorking, CatalogCard, ChatThreadPanel (twice, also ReadingTools), Menu,
ShareView and sidebar-section. Button, Disclosure, IconButton, Modal and TextField stories set
no `component`.

The page names 24 components with `data-wb`. Those with no story whose `componentPath` is their
file: AgentTurn, AnsweredTurns, UserTurn (`Turns.tsx`), App, AwaitingInputCard, CardHeader,
ComposeBox, DevicePicker, Disclosure, IconButton, InteractiveCard, Modal, Prose
(`QuietProse.tsx`), ReadingTools (its stories point at `ChatThreadPanel.tsx`), Recap,
ShareButton, Waveform, WorkDetails.

The app shell is real DOM: `data-slot="window"` (`apps/web/src/shell/window.tsx`),
`data-slot="title-bar"` (`title-bar.tsx`) and `data-slot="sidebar"` (the drawer).

## Decisions

1. **Order.** Themes first (phase 1), then the contract (phase 2), then project files
   (phase 3). The contract is settled and tested before any file is exported or loaded.
2. **Contract format: JSON.** Browsers and Node parse it natively, so the Workbench and the
   command line share one parser and the repo gains no dependency. Rejected: YAML, which needs
   a parser package, types values implicitly (`no` reads as false) and is read nowhere in the
   repo.
3. **The contract is data plus a pure validator.** `contract.json` lists what a project must
   have. `validate(project, contract)` returns every failure as `{ code, path, message }`
   with a stable code, sorted, and an empty list means valid. Same input, same output.
4. **No agent in the load path.** Loading a project runs only the validator. No LLM, agent or
   network call takes part in the checklist or the accept decision. Agents may help write the
   contract and validator during development; they never interpret a file being loaded.
5. **Storybook pin: exactly 10.6.0** (proposed). It is the version the repo locks and its
   browser suites pass on. A project file records `storybook.version` and the index format;
   loading rejects any other version string by exact equality. No ranges, no older-version
   support. Moving to 10.6.7 or 11 is one deliberate change: the catalog pin, the lockfile and
   the contract together. Ethan may prefer to adopt 10.6.7 before the first export.
6. **Shell kind.** `app-shell` when the window, title bar and drawer slots are present;
   `full-screen` otherwise. The contract's required items depend on the kind.
7. **Semantic surfaces by name.** A surface (page, thread, compose) maps to the standard
   component that draws it and the design values that colour it, such as compose to
   `ComposeBox` and `--compose-bg`. Recognising the same primitive under another name is a
   later capability and has no ticket yet.
8. **Theme files are the Workbench's own JSON** (Ethan, Nov 12 2026; amends ADR-002 and R10).
   A theme names roles (surfaces, ink, accent, hover, focus, fonts), not the host's
   variables. It lives in `.workbench/themes/<name>.theme.json`. The contract maps roles to the
   host's CSS variables; applying a theme writes override values through the existing save
   path, so the override file is still the only live look. The host's code is never written.
9. **Install into a repo like Storybook** (Ethan, Nov 12 2026). See PRD section 16: one
   package, `init` and `dev`, and a same-origin proxy in front of the host's dev server.

## Phases

### Phase 1. Themes: a look becomes a swappable unit (PRD R16)

Story: [themes-story.md](../feature/themes/themes-story.md).

1. Save the current colours as a palette.
2. Load and unload a palette.
3. Save, load and unload a type pairing.

### Phase 2. The project contract: one deterministic definition of a valid project

Story: [project-contract-story.md](../feature/project-contract/project-contract-story.md).

1. The contract and its validator.
2. Every required component has a story.
3. Describe this repo as a project manifest.

### Phase 3. Project files: carry a look between projects (PRD section 11, third measure)

Story: [project-files-story.md](../feature/project-files/project-files-story.md).

1. Export a project file.
2. Check a project file before loading it.
3. Load a checked project file.

### Phase 4. Charts on bklit: one chart library, measured (PRD section 12)

Story: [bklit-charts-story.md](../feature/bklit-charts/bklit-charts-story.md). Independent of
phases 1 to 3, so it can go in whatever order serves the work.

1. Measure the charts as they are.
2. The bar chart on bklit.
3. The line chart on bklit, and Recharts removed.

### Phase 5. Install into any repo, like Storybook (PRD section 16)

No story or tickets yet. They wait on PRD section 16's open decisions, the package name first.
Candidate features, in order:

1. A same-origin proxy in front of this repo's own dev server that serves the Workbench and
   injects the override stylesheet, replacing the Vite plugin path.
2. `.workbench/` as the home of the override file and themes.
3. `design-workshop init` in a scratch Vite app.
4. The same in a scratch Next app, proving the proxy is framework-neutral.

### Later, not planned

Recognising shared primitives under different names, and folding a finished look into the
baseline (PRD section 14), stay open questions without tickets.

## Work order: Puck's ten phases

Ethan, Nov 12 2026: work in this order, one phase at a time, each broken into atomic commits
that end in its completion check. The phases above are tickets inside these.

1. **Inspector panel.** Done: `0708102`, `1430224`, `bebdef8`.
   Check: every category folds, stays folded on reload; all browser groups pass.
2. **Component tree drawer.** Done: `81be6da`, `583cc1b`, `ba94a7e`, `e14d710`.
   Check: tree opens on top groups; a Live pick scrolls only when off screen and highlights.
3. **Colour and font themes** (ETH-119 to 121). Done: `a6ec247`, `a33a880`, `dcf2eac`, `9692eaa`,
   `27880ec`, `8b3d883`. Commits: theme format and role map; save a
   palette; load and unload a palette; save, load and unload a type pairing.
   Check: `theme-check.mjs` saves a palette, loads it (colours change, radius does not), undoes
   in one step, unloads to the baseline, and does the same for a type pairing.
4. **Storybook and primitives audit.** Done: `bb5102b` (ETH-123), `ab78148` (ETH-131).
   Commits: stories for ComposeBox and the turns (ETH-123);
   pin Storybook packages to exactly 10.6.0. Check: every required component has an index entry
   whose `componentPath` is its file; Storybook tests pass.
5. **Project contract** (ETH-122, 124). Commits: contract data and validator; manifest
   command. Check: this repo's manifest validates to no failures; each fixture fails with its
   own code, identically twice.
6. **Project save, export, load** (ETH-125 to 127). Commits: export; check; load.
   Check: export, check and load round-trip in the browser; invalid files cannot load.
7. **Semantic component mapping.** Commits: contract surfaces resolve to rendered components
   and their colour roles; inspector names a selection's surface. Check: selecting the compose
   box shows it as the compose surface and its role colours.
8. **Charts on bklit** (ETH-128 to 130). Check: no `recharts`; chart stories pass; measured.
9. **Performance and architecture.** Commits from measurement only. Check: before and after
   numbers for each change, with run counts and spread.
10. **Editor completion.** Reread the PRD after each commit; next smallest gap. Check per gap.
