# Story: `design-workshop init` sets the Workbench up at an app's root

Status: planned Nov 12 2026 at commit `2532641`. Authorized by Ethan through Puck for planning and
implementation. Roadmap: PRD section 10, block 10, and the portability plan's Phase 5.

**Boundary.** `init` asks a person only for choices the code cannot know. Everything the project
contract already derives (shell kind, slots, components, stories, surfaces, Storybook version) is
detected and validated by code and shown, never asked. The checklist stays the contract's pure
validator (ADR-029); no agent or model reads a host's answers. `init` never edits the host's
components, config or styles (PRD section 16).

## 1. Install questions, grounded in the contract

Legend. **Modeled**: the contract or a design value already holds it. **Proposed**: a new field
in `.workbench/config.json` (ADR-042). **Detected**: code finds it; a person is not asked.

### Asked of a person

1. **Which side does the rail and its drawer sit on? `left` or `right`.**
   Modeled: `--shell-side` (ADR-041), an override value, not config. Optional. Asked only when
   the shell is `app-shell` and the host's CSS reads `--shell-side` or `data-shell-side`;
   otherwise the side is fixed by the host's own code and the question is skipped with a notice.
   Default: `right` when the source passes `side="right"` to its Sidebar, else `left`. One value
   moves both, as ADR-041 decided; a separate drawer side is not proposed.
2. **Write these files? (y/N)** Required. Shows the exact files and the detected answers below.
   `--yes` answers it for scripted runs.

### Detected and validated, not asked

1. **Shell kind: `app-shell` or `full-screen`.** Modeled: `manifestOf` in `contract.ts` derives
   it from `data-slot` declarations. `app-shell` needs `window`, `title-bar` and `sidebar`
   (`contract.json`). Some but not all of them: the shell is `full-screen` and `init` lists the
   missing slots as a notice, not a question, so the contract stays the single source.
2. **Components and their stories.** Modeled: `data-wb` names and the Storybook index. A host
   with no names gets slots and roles only (PRD section 16).
3. **Surfaces.** Modeled: `contract.json` surfaces, present when their component is.
4. **Storybook version and index format.** Modeled: exactly `10.6.0`, index `5`. Read from the
   host's installed `storybook` package. Absent or another version fails `storybook-version`;
   `init` does not install or upgrade Storybook.
5. **Source folders to scan.** Proposed: `sources`. Today `SOURCE_DIRS` is hardcoded in
   `project.ts`. Default: `src` when it exists, else the folders holding `.tsx` files under the
   root, excluding `node_modules` and dot folders.
6. **Storybook config folder.** Proposed: `storybook.configDir`. Default: `.storybook` when it
   holds a `main.*` file, else `null`.
7. **Override file and theme folder.** Fixed by PRD section 16: `.workbench/overrides.css` and
   `.workbench/themes/`. Not configurable.
8. **The `workbench` script.** Fixed name. An existing script by that name that differs is a
   refusal, not a question.
9. **Package manager.** Detected from the lockfile, for printed next-step commands only.

### Proposed for later features, not part of `init`

- **Dev server address** (`app.url`, `app.command`): the proxy's target (Phase 5, item 1).
  Detected then from the `dev` script and framework (Vite 5173, Next 3000); asked only when
  neither is found.
- **Dark-mode selector** and **role map** (`darkSelector`, `roles`): theme files in a host need
  them (ADR-028). Detected by a fixed name table (Template names, then shadcn names such as
  `--background` for `page`); unmatched roles are listed, never guessed.

## 2. Implementation plan

Each ticket is one commit, verified and pushed before the next starts.

1. **Config format and check** (ETH-143). `config.ts`: `design-workshop/config` version 1 with
   `sources` and `storybook`, and a pure `checkConfig` returning sorted failures with stable
   codes. `pnpm workbench check-config [file]`. This repo gets its own `.workbench/config.json`.
2. **The manifest reads the config** (ETH-144). `project.ts` takes a root folder and reads its
   config for source folders and the Storybook folder, instead of hardcoded paths. This repo's
   manifest is byte-identical before and after.
3. **Detection, as a dry run** (ETH-145). A pure `detect` over a root's files gives the answers
   in section 1 and the config it would write. `pnpm workbench init <root> --dry-run` prints
   them and writes nothing. In this repo it proposes the config already committed.
4. **`init` writes, and the scratch app proves it** (ETH-146). Asks section 1's questions (or
   takes `--side` and `--yes`), writes `.workbench/config.json`, `.workbench/overrides.css`
   seeded with any non-default side, and the `workbench` script, and adds a `design-workshop`
   bin. A browser-free check builds a scratch Vite app, runs `init --yes`, and asserts the
   files, a no-op rerun, untouched host source and a deterministic checklist.

Status: items 1 to 4 built (ETH-143 to ETH-146). The unit tests in `init.test.ts` drive the
real command line in scratch Vite apps for the checklist below. `init` prints the link command
for the unpublished package. `list`, `set` and `check` still read this repo's override file; a
host's `.workbench/overrides.css` is served once the proxy and `design-workshop dev` exist.

Not in `init`, by ADR-042: the proxy and `design-workshop dev` (Phase 5, item 1), the devDependency
entry (nothing is published; the bin is run from the workspace path), and theme role maps.

## 3. Completion checklist

INIT is complete when every item holds, each with its command output recorded in the decision log.

- [x] `pnpm workbench check-config` accepts this repo's config and fails each bad fixture with
      its own code, identically twice.
- [x] `pnpm workbench manifest` prints the same manifest as at `2532641`.
- [x] `init <repo> --dry-run` prints this repo's committed config and leaves `git status` clean.
- [x] In a scratch Vite app, `init --yes` writes exactly `.workbench/config.json`,
      `.workbench/overrides.css` and the `workbench` script, and nothing under `src/`.
- [x] A second `init --yes` changes nothing; a conflicting `workbench` script is refused.
- [x] `--side right` in an app-shell host seeds `--shell-side: right`; in a full-screen host the
      side question is skipped.
- [x] The scratch app's `check-project` output is the same list on two runs.
- [x] `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm fallow`, unit tests and the browser
      suites pass (Safari deferred by Ethan).
- [x] Each ticket is Done in Linear with a resolution comment linking its commit.
