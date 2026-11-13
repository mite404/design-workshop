# Story: put the Workbench into another monorepo

Status: planned Nov 13 2026 at commit `b0d171e`. Authorized by Ethan: "start working on the
implementation plans to package this app up, install it into a repo, init & setup". Roadmap: PRD
section 16 and the portability plan's Phase 5.

**Boundary.** PRD section 16 already decided the shape: nothing is published to npm, the package
is named `design-workshop`, and it is used from a local path or a workspace. `init` never edits
the host's components, config or styles; the Workbench writes only under `.workbench/`, plus the
`workbench` script and the devDependency in `package.json`.

## 1. Where it stands (scratch monorepo, Nov 13 2026)

- ETH-161 to ETH-163 removed the ties to this repo's other packages: the palette comes from the
  host's tokens file, fonts go into the host, and the canvas opens on the host's own page.
- Copied into a scratch pnpm monorepo as `packages/workbench/`, with `packages/config/` beside
  it and Vite linked by hand, `init`, `list`, `dev`, the editor page and a real font install
  all work against a plain static app.
- What still ties it to this repo:
  - `tsconfig.json` extends `@yaklabs/config`. Without it Vite cannot transform `page.ts`, and
    the editor page is blank.
  - Vite, which `dev` runs, is a devDependency, so a host's install does not bring it.
  - The package has no version, so `pnpm pack` refuses it, and nothing says which files ship.
  - `init` prints an install command instead of adding the devDependency.
- Node refuses to strip TypeScript types under `node_modules`
  (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). So the CLI runs from a workspace package or a
  `link:` install, whose real path is outside `node_modules`, but not from a tarball or `file:`
  install.

## 2. Approach

The shipped form is a workspace package folder in the host monorepo,
`packages/design-workshop/`, made from `pnpm pack` of this repo's package. `pnpm pack` decides
exactly which files ship, and a workspace package keeps its real path outside `node_modules`, so
the TypeScript sources run as they do here.

Rejected: building a JavaScript `dist/` so the package also runs from `node_modules`. It is only
needed for publishing, which PRD section 16 rules out, and it adds a build step to every change.

## 3. Implementation plan

Each ticket is one commit, verified and pushed before the next starts.

1. **The package is self-contained** (ETH-164). Name `design-workshop`, a version, `files`
   listing the sources without tests, the bundled themes and `tsconfig.json`. Vite moves to
   `dependencies`. `tsconfig.json` stands alone, with the base options inlined. This repo's
   imports of `@yaklabs/workbench/tree` follow the new name. No `engines` field: the host's own
   Node runs it (Ethan, Nov 13).
2. **A scripted install check** (ETH-165). `apps/web/scripts/install-check.mjs` packs the package,
   extracts it into a scratch pnpm monorepo as `packages/design-workshop/`, installs offline
   from the store, runs `init --yes` in its app and `dev` in front of a static server. It
   asserts that the editor page, `page.ts` and both injected stylesheets answer 200, that the
   canvas opens on `/`, and that `init` wrote nothing outside `.workbench/` and `package.json`.
3. **`init` adds the devDependency** (ETH-166). `workspace:*` when the package is a workspace
   package of the host, else `link:` with its path. `init` then prints the install command to
   run. Amends ADR-042, which left the entry out while nothing could be installed.
4. **The install guide** (ETH-167). A README section with the steps from this repo to a running
   Workbench in another monorepo, and the config fields a host may set: `tokens`, `fonts`,
   `canvas`, `roles` and `colourSelectors`.

## 4. Completion checklist

- [x] `pnpm pack` in the package lists its sources, themes and `tsconfig.json`, and no tests.
- [x] `pnpm test:install` passes twice in a row and leaves no scratch files behind.
- [x] In the scratch monorepo, `init --yes` adds the devDependency and a second run changes
      nothing.
- [ ] The README's steps, followed by hand in a fresh scratch monorepo, end with the editor open
      on that app.
- [ ] `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm fallow`, unit tests and the browser
      suites pass.
- [ ] Each ticket is Done in Linear with a resolution comment linking its commit.
