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

## Tickets

Product: `docs/prd.md`. Research: `docs/research/`. Each ticket is a plan in `docs/feature/<name>/`,
named after its Linear ID, with a drift log for anything built differently from the plan. A folder
moves to `docs/done/<name>/` once every ticket in it is Done.
