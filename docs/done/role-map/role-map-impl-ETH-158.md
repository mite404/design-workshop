---
linear: ETH-158
---
# init writes the role map and asks about unmatched roles

## Status

- **Goal**: Role map story item 3. See [the story](role-map-story.md).
- **Initial priority**: P3
- **Category**: feature
- **Planned at**: commit `9db73cd`, 2026-11-12
- **Plan**: [role map story](role-map-story.md), PRD R16 and section 13

Approach, scope, test plan and done-when are in the Linear issue.

## Drift log

- Detecting roles needs a stylesheet, so `init` now proposes `tokens` too: the one naming the
  most roles. ADR-045 is amended; this repo's detected config now equals its committed one.
- An app with no stylesheet naming any role gets `roles: {}` and the list, not 22 questions.
- The light and dark selectors are written as `:root:not(.dark)` (ETH-160) and `.dark`
  whenever a colour role matched a shadcn name; another dark selector is edited by hand.
