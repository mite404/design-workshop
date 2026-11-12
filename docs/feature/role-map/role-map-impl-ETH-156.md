---
linear: ETH-156
---
# Report which theme roles an app's tokens file matches

## Status

- **Goal**: Role map story item 1. See [the story](role-map-story.md).
- **Initial priority**: P3
- **Category**: feature
- **Planned at**: commit `46e6064`, 2026-11-12
- **Plan**: [role map story](role-map-story.md), PRD R16 and section 13

Approach, scope, test plan and done-when are in the Linear issue.

## Drift log

- The first test fixture used `--card-foreground` to prove `--foreground` is not matched inside
  it, but it never contains `--foreground`; a mutant without the name boundary passed. The
  fixture now uses `--accent-foreground` against `--accent`, which the mutant fails.
- Adding the command took `cli.ts` past the import limit; it carries a scoped disable, as
  `sidebar.tsx` does, since it dispatches one command per module.
