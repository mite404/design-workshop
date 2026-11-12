---
name: design-values
description: >-
  The rules for changing this Template's look alongside the Workbench. Use when restyling a
  component, adding a design value, building a mockup the designer will tune, or exposing a
  value the designer asked for.
---

# Design values: the two lanes

The designer changes values in the Workbench. You change structure. Neither does the other's job
(PRD sections 6 and 7).

| Lane | Who | Changes |
| --- | --- | --- |
| Values | The designer, in the Workbench | `packages/catalog/src/overrides.css` only |
| Structure | You | Components, stories, new regions, new design values |

## Never touch the override file

`packages/catalog/src/overrides.css` is the Workbench's alone (ADR-002). It holds the designer's
look, one value per line. Do not edit, reformat or "clean up" it, and do not stage it in your
commits. To change a value the designer already set, ask them, or use the command line below
when they ask you to.

## Build so the Workbench can tune it

- Put each component's name, spelled as in code, on its root element: `data-wb="ComposeBox"`
  (ADR-012, ADR-023). The Workbench uses it as the component's identity in both modes.
- Style with design values, not literals: `border-radius: var(--window-radius)`. Baseline values
  live in `packages/catalog/src/tokens.css`: `:root` for both modes, `:root[data-theme="dark"]`
  for dark.
- Spacing, offset and type are editable on any element already. Do not add tokens for them.
- Mock up the structure; leave the tuning to the designer (ADR-008).

## Expose a new design value

When the designer cannot reach something, they ask for it to be exposed:

1. Add the baseline to `packages/catalog/src/tokens.css` with a comment saying what it styles.
2. Read it in the component with `var(--name)`, replacing the literal.
3. Make it editable:
   - A colour is editable when its baseline is a hex literal (`--compose-bg: #323031`) in light
     or dark. Nothing more to do.
   - Any other `:root` value joins `EDITABLE` in `packages/workbench/src/plugin.ts`, which is
     what the Workbench may write (R10). Add its check to `isValue` there unless it is a
     whole-pixel length.
4. Check it is listed: `pnpm workbench list | grep -- --name`.
5. Verify with the `verifying-workbench` skill, then commit your files, never the override file.

## Command line

Run from the repository root.

```sh
pnpm workbench list [--json]                    # every value: selector, name, baseline, saved
pnpm workbench set <selector> <name> <value>    # write one value, as the designer would
pnpm workbench unset <selector> <name>
pnpm workbench check                            # is the override file valid
pnpm workbench manifest                         # this repo as a project manifest
```

Element baselines read `null` without a browser. Quote selectors and values containing spaces.
