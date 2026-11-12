# Values and colours

The CLI edits allowed values offline. Colour controls edit light and dark tokens in the browser.

## Sub-features

- CLI listing, setting, removing, validation and refusal without mutation.
- Colour editing, light/dark separation, reset and persistence.
- CLI writes hot reload while an open inspector refuses unseen conflicting edits.
- Themes: save the colours as a theme file, refuse a taken name, apply a theme as one undo step.

## How to get to it (user POV)

Run `pnpm workbench` from the repository root. For colours, open the Colours panel at
`/__workbench/` and use the Canvas mode selector for the relevant preview.

## Driving it with the browser scripts and CLI

Preconditions: isolated snapshot; browser server needed only for the colour and hot-reload checks.

```sh
pnpm --filter @yaklabs/workbench test
pnpm --silent workbench list --json
pnpm workbench check
pnpm --silent workbench manifest
node apps/web/scripts/colour-check.mjs --base http://localhost:5173 --out "$OUT/colour"
node apps/web/scripts/theme-check.mjs --base http://localhost:5173 --out "$OUT/theme"
```

`manifest` prints this repo's project manifest and its contract failures, exiting 1 on any
(ADR-029). It runs `storybook index`, so it takes several seconds. To see a refusal, delete a
required story in the snapshot and expect its `missing-story` code.

The theme check names each step after its criterion in `docs/feature/themes/themes-story.md`. It
creates `.workbench/themes/theme-check.theme.json` in the snapshot and removes it afterwards.

The Workbench tests include real CLI subprocesses in temporary copies. For a CLI change, also
exercise the integration in the isolated browser: leave the radius inspector open, run
`pnpm workbench set :root --window-radius 28px`, observe computed radius 28px, then attempt 36 in
the old inspector. Require a stale refusal and 28px retained on disk. Reset in the disposable copy.
This integration is a manual recipe, not an additional automated step in `test:browser`.

## Gotchas

`check` does not run tests. Offline element baselines are null and listing cannot enumerate the DOM.
The default colour run omits Storybook; its script accepts `--storybook` for a running Storybook
URL.
Cross-story claims require that extra run and the specific affected stories. No command here judges
appearance or proves that saved selectors match elements.
