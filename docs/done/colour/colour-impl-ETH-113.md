---
linear: ETH-113
---
# Change named colours in light and dark

## Status

- **Goal**: each named colour of the Template can be picked per mode, with a contrast readout,
  and saved to the override file.
- **Initial priority**: P2
- **Effort**: Large
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `04cb7ad`, 2026-11-11
- **Story**: [colour-story.md](colour-story.md). Needs ETH-111.

## Why this matters

PRD R5 and R7. The first success measure is re-skinning the shell to a clearly different look
in under an hour, and a look is mostly colour. Today the Workbench can change one radius and
the spacing of single elements. "AC 2" below means criterion 2 in `colour-story.md`.

## Current state

* `packages/catalog/src/tokens.css` declares the colours as hex values in a `:root` block and
  again, for dark, in a `:root[data-theme="dark"]` block.
* `packages/workbench/src/plugin.ts` lets `:root` take one name, `--window-radius`, and only a
  whole pixel value. Its `baseline` reads the first match in `tokens.css`, which is light's.
* `packages/workbench/src/overrides.ts` already accepts a `:root[data-theme="dark"]` block, so
  the file format does not change.
* The Workbench has no theme switch. Storybook has one in its toolbar.

## Approach

Light and dark land first, as their own commit with no ticket of their own (Ethan's call). A
dark value is a line in a `:root[data-theme="dark"]` block of the override file. A light value
in the `:root` block cannot leak into dark, because the baseline's dark block is more specific
than `:root`. A value the baseline declares once, such as the radius, keeps living in `:root`
and applies to both. Rejected: a second override file for dark, which breaks "the diff of that
file is the look".

The picker is the browser's own `<input type="color">`, since every editable colour is a
plain hex value. Its ceiling is no transparency, which is why the story leaves `--rule` and
`--hairline` read-only. Rejected for now: a custom picker. Build one only if the native one
fails Ethan's look references in section 12 of the PRD.

Contrast is WCAG relative luminance, a pure function of two hex colours. Rejected: a colour
library for one formula.

## Scope

* In: `packages/workbench`: the mode switch, per-mode baselines, the list of editable colour
  names, hex validation on the endpoint, the Colours section, the contrast function, and
  their tests.
* Out: transparent and mixed colours, per-element colours, palettes. The story excludes them.
* Out: changing `tokens.css`. The baseline stays untouched (PRD section 6).

## Steps

* First commit, light and dark: let the endpoint accept `:root[data-theme="dark"]` with the
  same names as `:root`; return each name's baseline per mode; add the switch and the mode
  label (AC 1 to 3).
* List the editable colours: the names in `tokens.css` whose value is a hex colour. Record the
  count in the drift log.
* Accept a six-digit hex colour for those names on the endpoint, and nothing else.
* Add the Colours section: swatch, name, hex field, reset (AC 4 to 6, 8). Preview live on the
  canvas root and save on close.
* Add the contrast function and the readout for each text colour on each surface, with the
  flag under 4.5:1 (AC 7).
* Record each save as one undo step (AC 10).

## Test plan

* A unit test checks the contrast function against ratios `tokens.css` already states, such
  as ink on paper at 13.3:1.
* One browser test: in light, change `--paper`; assert the canvas background changed, then
  switch to dark and assert dark's is the baseline. Change `--paper` in dark and assert the
  override file holds two different values in two blocks. Reset both and assert the file is
  byte for byte the starting file.
* Send the endpoint a colour with transparency and a name that is not a colour, and assert
  both are refused.
* Open a story of a shadcn component and confirm it follows a changed colour (AC 9).
* Take screenshots of the Colours section in both modes, with one flagged ratio, and look at
  them. Check the picker in Safari as well as Chrome.

## Done when

* The unit test and the browser test pass.
* The screenshots show nothing misaligned and the flag is readable in both modes.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in commits whose bodies name this ticket's Linear identifier.

## Notes

Risk: MEDIUM. The cascade between `:root`, the dark block and the override file is easy to get
subtly wrong, so the browser test reads computed colours in both modes. The native picker
looks different in each browser and is drawn by the system, so it may not meet the look
references.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.

- Refreshed against `45c22d6`, including ETH-111. The endpoint already supports grouped history,
  undo, redo and discard. Colour releases use that path rather than introducing colour history.
  The existing type and scale controls remain shared between modes.
- The baseline contains 78 named colours. Of these, 58 have a literal six-digit hex in at least
  one mode and can be edited. Aliases, mixes and transparent values remain visible read-only
  where neither mode has a literal hex.
- Light colours use `:root[data-theme="light"]`, not plain `:root`. The planned specificity
  argument fails for colours such as `--sage` that have no dark declaration. An explicit light
  selector isolates those colours too. Ethan accepted this correction. Shared non-colour values
  remain in `:root`; both colour modes still live in the same override file.
- Contrast includes the baseline's text aliases and derived text roles. The browser resolves
  expressions and composites transparency before the dependency-free WCAG calculation.
- The native picker remains. Chrome event-path checks cover preview, acceptance and Escape;
  Safari's native palette was opened and visually inspected on macOS.
- Browser checks now wait for discard to refresh the radius before starting the next drag.
  The reference check targets the chat's exact Send button, not the new Reset --send control.
- Integrated ETH-112 through `7313a32` after its review and green CI. Both colour selectors
  appear in its check-and-commit review. The combined browser suite retains the commit-dialog
  lever as well as the colour lever. No product commit is pushed by the Workbench.
