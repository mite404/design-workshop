---
linear: ETH-160
---
# Canvas mode switch shows an app's class-based dark mode

## Status

- **Goal**: Role map story item 5. See [the story](role-map-story.md).
- **Initial priority**: P3
- **Category**: feature
- **Planned at**: commit `0006b08`, 2026-11-13
- **Plan**: [role map story](role-map-story.md), PRD R7 and section 16

Approach, scope, test plan and done-when are in the Linear issue.

## Drift log

- The first run toggled `.dark` but the canvas stayed light: the light override under plain
  `:root` tied with `.dark` and loaded later. The light selector became `:root:not(.dark)`.
- A host without the Template's fonts still shows the missing-font warning in Type; unchanged.
