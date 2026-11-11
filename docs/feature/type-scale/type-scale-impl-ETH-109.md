---
linear: ETH-109
---
# Scale type with base, ratio and leading controls

## Status

- **Goal**: tune the nine type steps together and save the three controlling values.
- **Initial priority**: P2
- **Effort**: Medium
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `39323ce`, 2026-11-11.
- **Story**: [type-scale-story.md](type-scale-story.md), acceptance criteria 5 to 12.
  ETH-109 needs ETH-100, ETH-101 and ETH-104. Coordinate after the per-element type tickets.

## Why this matters

The named type steps need controls that resize the whole mockup while preserving its hierarchy.
Ethan approved the Type panel with base size, ratio and leading on Nov 11.

## Current state

* ETH-104 will supply nine named sizes, `--text-2xs` through `--text-4xl`.
* The dev-only Workbench already previews values and saves them through `/__workbench/values`.
* No global Type panel exists. The per-element Typography section is separate work.

## Approach

Keep scale calculations in the Template CSS, as the story requires, so the app and Storybook
read the same values. The Workbench changes only the base, ratio and leading custom properties
in `:root`, and reads the resulting sizes and line heights from the preview. Reuse the existing
field, preview, save and reset behavior. Do not add a second JavaScript scale as a source of truth.

## Scope

* In: the Workbench Type panel and endpoint validation, baseline type tokens and line-height
  consumers needed to make global leading work.
* In: browser checks for the actual computed scale in Chromium and Safari/WebKit.
* Out: per-element font selection, weights and styles, already covered by ETH-105 to ETH-107.
* Out: a second heading ratio, colour, themes and production Workbench endpoints.

## Steps

* Add base size, ratio and leading controls and a readout of all nine derived sizes/line heights.
* Start with the story's 12px base and 1.2 ratio. Determine and document the baseline leading
  from the current type styles before replacing their line heights.
* Base size steps by 2px; ratio offers 1.125, 1.2, 1.25, 1.333 and 1.5 or a typed value;
  leading steps by 0.05. Preserve keyboard access and validate finite positive input.
* Round sizes down to even pixels and line heights up to 4px. Verify that floating-point
  rounding does not turn the baseline's 10px smallest step into 8px.
* Preview immediately and save on release, Enter or blur. Reset removes that field's override.
* Preserve per-element overrides. The global controls affect elements still using the scale.

## Test plan

* At baseline, assert the nine computed sizes are 10, 12, 14, 16, 20, 24, 28, 34 and 42px.
* Use a different base and ratio and independently calculate expected values for every step.
  Check leading on both sides of a 4px rounding boundary.
* Exercise keyboard changes, typed values, save, reload and reset in the real Workbench.
* Check app and Storybook output, including changed font wrapping at desktop and narrow widths.
* Inspect Safari font rendering. Linux WebKit is useful but label it as an approximation;
  report explicitly if actual Safari cannot be checked. Helium and Chrome are also targets.
* Run typecheck, lint, formatting, Fallow, the full test suite and production builds.

## Done when

* All three controls update the real preview, persist and reset, and the nine readouts match it.
* Browser evidence covers baseline and changed scales; no text clips or overlaps.
* Production builds contain no Workbench endpoint or editor code.
* The override file is restored after tests and the change lands directly on `main`, with this
  ticket and verification in the commit body.

## Notes

Risk: MEDIUM. CSS calculation precision and cross-browser font metrics need executed checks,
not confidence from a formula. Keep one scale and one calculation path.

## Drift log

Record what differed from this plan and why.
