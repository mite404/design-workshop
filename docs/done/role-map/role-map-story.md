# Story: themes reskin another app through its role map

Status: planned Nov 12 2026 from PRD R16 and Ethan's decision in section 13 ("only work with
apps who either exactly match our role map beta version, or can easily be modified w/ the help
of an agent"; roles found by a name table and by asking, with an agent as the fallback).

**As** a designer starting a new app from a saved theme,
**I want** the Workbench to find which of the app's CSS variables play each theme role,
**so that** loading a palette or type pairing reskins that app as it does the Template.

## Name table

Template names come first, from `COLOUR_ROLES` and `TYPE_ROLES` in `theme.ts`. Then come the
shadcn names this repo maps onto its own tokens in `packages/ui/src/styles/globals.css`, read in
reverse:

| Role | shadcn name |
| --- | --- |
| page | `--background` |
| surface | `--card` |
| compose | `--popover` |
| hover | `--accent` |
| ink | `--foreground` |
| ink-soft | `--muted-foreground` |
| focus | `--ring` |
| text-font | `--font-sans` |
| display-font | `--font-serif` |

Every other role has no shadcn name and is listed as unmatched, never guessed.

## Plan

Each ticket is one commit, verified and pushed before the next starts.

1. **Report the matches** (ETH-156). `pnpm workbench roles` reads the app's tokens file and
   prints each role as matched, with the name and table, or missing. It exits 1 on any missing
   role.
2. **Apply themes through the map** (ETH-157). `.workbench/config.json` holds the role map and
   the dark-mode selector. Loading, saving and unloading themes, and the server's write checks,
   use them. Config fields: `roles` (role to variable, only the roles the app has) and
   `colourSelectors` (`{ light, dark }`); without them an app is taken to match the Template.
3. **`init` writes the map** (ETH-158). It detects roles with the name table and asks about
   each unmatched one. With `--yes` it lists them, so an agent can adapt the app.

## Completion checklist

- [x] In this repo, `pnpm workbench roles` matches every role by its Template name (ETH-156).
- [x] A shadcn-style scratch app loads a palette, and its own variables change (ETH-157).
- [x] `init` in that app writes the detected map and asks only about the unmatched roles
      (ETH-158).
- [x] Gates pass at each commit; each ticket is Done in Linear with its commit linked.
