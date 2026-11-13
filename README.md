# design-workshop

A no-code visual design tool, the Workbench, for remixing the Template. The Template is the
yaklabs app shell and component library (`github.com/mite404/yaklabs`, copied whole at commit
`104a052`), running on a scripted agent with no sign-in. `docs/prd.md` describes the product.

## Layout

A pnpm 10.33.0 workspace run by Turborepo. The packages other than the Workbench keep their
`@yaklabs/*` names.

- `apps/web`: the React Router single-page app.
- `apps/storybook`: hosts Storybook and the story tests. The stories live beside their components.
- `apps/gateway`: the yaklabs Cloudflare Worker. The Template does not need it to run.
- `packages/catalog`, `packages/ui`, `packages/runtime`, `packages/config`: the card catalog, the
  shadcn/ui primitives, the in-browser agent runtime and the shared TypeScript config.
- `packages/workbench`: the Workbench itself, the package `design-workshop`, which ships into
  other monorepos on its own.

## Run

With no env file the app uses the scripted agent (`VITE_AGENT=lab`), no sign-in (`VITE_AUTH=none`)
and demo mode (`VITE_DEMO=on`). Open `/?scenario=demo` for a deterministic shell.

```sh
pnpm install
pnpm dev:web          # the app at http://localhost:5174, the Workbench in front at :5173
pnpm storybook        # Storybook at http://localhost:6006
pnpm test             # unit tests in node, story tests in headless Chromium
pnpm typecheck
pnpm lint
pnpm build
```

In an Amp orb, `amp orb services ensure` starts both from `.amp/services.yaml` and prints their
portal URLs.

## Put the Workbench in another monorepo

The Workbench ships as a workspace package, `packages/design-workshop/`, in the other repo, which
must be a git repository (undo and commit read its history). It is not published to npm. Node
runs its TypeScript directly, but not from `node_modules`, which is why it is a workspace package
and not an installed tarball.

1. Pack it here:

   ```sh
   cd packages/workbench && pnpm pack   # writes design-workshop-0.1.0.tgz
   ```

2. Extract it into the other repo, whose `pnpm-workspace.yaml` must include `packages/*`:

   ```sh
   mkdir -p packages/design-workshop
   tar -xzf /path/to/design-workshop-0.1.0.tgz -C packages/design-workshop --strip-components 1
   ```

3. Set the app up, from the other repo's root (`apps/web` is the app's folder):

   ```sh
   node packages/design-workshop/src/cli.ts init apps/web
   pnpm install
   ```

   `init` shows what it found and asks before writing. It writes `.workbench/config.json` and
   `.workbench/overrides.css` in the app, and adds the `workbench` script and the
   `design-workshop` devDependency to its `package.json`. It never changes the app's code.

4. Start the app's own dev server, then the Workbench in front of it, in the app's folder:

   ```sh
   pnpm workbench dev --target http://localhost:5173   # the app's dev server address
   ```

   Open `http://localhost:5180/__workbench/`. Edits land in the app's `.workbench/` only.

To update, pack again and replace `packages/design-workshop/`. `init` fills
`.workbench/config.json` from what it detects; these optional fields change it by hand:

| Field             | What it sets                                                   | Default       |
| ----------------- | -------------------------------------------------------------- | ------------- |
| `tokens`          | The stylesheet whose `:root` values are the baselines          | none          |
| `roles`           | The app's variable for each theme role, when its names differ  | Template names |
| `colourSelectors` | The selectors that hold the light and dark colours             | `data-theme`  |
| `fonts`           | The folder that keeps installed fonts (`fonts.css`, `fonts/`)  | `.workbench`  |
| `canvas`          | The app page the canvas opens on, such as `/t/demo-brief`      | `/`           |

## Tickets

Product: `docs/prd.md`. Research: `docs/research/`. Each ticket is a plan in `docs/feature/<name>/`,
named after its Linear ID, with a drift log for anything built differently from the plan. A folder
moves to `docs/done/<name>/` once every ticket in it is Done.
