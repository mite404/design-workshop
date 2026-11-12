---
linear: ETH-157
---
# Apply themes through an app's role map

## Status

- **Goal**: Role map story item 2. See [the story](role-map-story.md).
- **Initial priority**: P3
- **Category**: feature
- **Planned at**: commit `6862bef`, 2026-11-12
- **Plan**: [role map story](role-map-story.md), PRD R16 and section 13

Approach, scope, test plan and done-when are in the Linear issue.

## Drift log

- A shadcn app's light selector is `:root` itself, so the server's names for `:root` are the
  union of the root tokens, the type roles and, when a mode selector is `:root`, the colour
  roles. The page tells a colour from a root token by its name, not its selector.
- The Colours section still lists the Template's colour variables only; a host's colour rows
  are not in this ticket.
