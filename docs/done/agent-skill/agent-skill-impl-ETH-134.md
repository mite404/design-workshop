---
linear: ETH-134
---
# Write the agent skill file for the two lanes

## Status

- **Goal**: Any agent working in the Template knows the Workbench's rules from one skill file.
- **Initial priority**: P3
- **Effort**: Small
- **Category**: feature
- **Planned at**: commit `bcb1f82`, 2026-11-12
- **Plan**: `docs/research/project-portability-plan.md`, work order phase 10; PRD block 6 (R12)

## Why this matters

PRD section 7: "the Template carries one skill file telling any agent the rules". R12 listed it
as not written. Without it an agent may edit the override file or hard-code a literal the
designer then cannot tune.

## Approach

* One skill, `.agents/skills/design-values/SKILL.md`: the two lanes, the override file as the
  Workbench's alone, `data-wb` names, how to expose a new design value, and the command line.
* Each rule names its ADR rather than restating it.

## Scope

* In: the skill file; R12's status line in the PRD.
* Out: the Workbench writing an exact request (element, file and line, current value).

## Done when

* Every path, command and code name in the skill exists or runs in this repo.
* `pnpm format:check`, `pnpm lint` and `git diff --check` pass.
* Commit bodies name this ticket's Linear identifier.

## Notes
