# Template and editor entry

The welcome opens projects and the Workbench's Live and Component modes around the running Template.

## Sub-features

- Welcome and project navigation.
- Canvas visibility and layout switching.
- Thread replies and reload persistence.
- Live and Component editor entry.

## How to get to it (user POV)

Open `/`, choose Demo or Live Playground, or choose Live or Component under More actions.
Use the layout switch inside a thread to show its canvas.

## Driving it with the browser scripts

Preconditions: the isolated dev server is healthy; use a fresh browser context.

```sh
node apps/web/scripts/shell-check.mjs --base http://localhost:5173 --out "$OUT/shell"
```

The script checks welcome content, navigation, canvas visibility, persisted turns, retired routes
and both editor entries. Require every reported step to pass and inspect its `results.json` and
screenshots. Use its roles and `data-slot` selectors for follow-up on changed screens.

## Gotchas

This script uses copied Template flows. If a product decision retires one, report the exact mismatch
and update the script against the approved story. Do not preserve a retired flow merely to pass.
Its reload check alone does not establish the correctness of every persisted turn's content.
