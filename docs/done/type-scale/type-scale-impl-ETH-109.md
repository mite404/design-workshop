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

* Baseline leading is 1.3. Measured on `f4adfd2` over the shell, `/new` and both demo threads
  (296 text elements): 12/16, 14/24 and 14/20 are the common size/line pairs. No single leading
  keeps all of them on a 4px grid; 1.3 keeps 51%, 1.45 to 1.5 keep 29%. So 14px reply prose and
  card headings now sit on 20px lines, not 24px, and `type-check.mjs` expects 20, then 28.
  Approved by Ethan on Nov 11 2026: "do 109's proposed baseline leading".
* The scale is in `tokens.css`: `--type-base`, `--type-ratio` and `--type-leading` on `:root`,
  each step `round(down, base × pow(ratio, n), 2px)` and each line
  `round(up, size × leading, 4px)`, as `--text-<step>--line-height`. The 18 results are
  registered `<length>` properties, so they compute to pixels once on the root and inherit as
  lengths; the Workbench reads its nine readouts from there.
* Precision: compared against exact rational maths for bases 6 to 30, ten ratios from 1.067 to 2
  and leading 1 to 2 in 0.05s, 24,570 cases each in Playwright Chromium and Playwright WebKit
  (Linux, an approximation of Safari). No step or line differed, with or without an epsilon, so
  the CSS has none. 12/1.2 stays 10px.
* Every `line-height` that went with a step's `font-size` now reads that step's line height, and
  the `leading-*` classes ETH-104 added to keep old lines are removed. Kept: `line-height: 1`
  and `inherit`, which centre a glyph in a fixed box, not text lines.
* Base steps by 2px and is saved even (4 to 96px); ratio takes the named ratios with arrows or
  any typed value from 1.001 to 3; leading steps by 0.05 from 1 to 3. The endpoint checks the
  same bounds. A drag on a label scrubs, as the corner radius label does.
* The Text and Display font rows ETH-106 placed by Corner radius moved into the Type panel, which
  is always shown, so the scale and the two fonts sit together.
* `scale-check.mjs` joins `pnpm test:browser`. The corner radius lever now finds its label by
  `for=radius`, since the Type panel adds three more `.scrub` labels.
* Review fixes: Escape during a label scrub cancels it and its release saves nothing; a typed
  value must be a whole plain decimal (no `1.5garbage`, `1e1` or `Infinity`) that passes the
  endpoint's own check, else it is refused with a message and the saved value stays. The panel's
  ratio minimum is the endpoint's 1.001; only the base is normalized, down to even.
