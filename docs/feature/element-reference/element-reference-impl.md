---
linear: ETH-110
---
# Point to an element and discuss it with the agent

## Status

* **Goal**: attach an accurately targeted element reference to a conversation without fiddly aiming.
* **Initial priority**: P2
* **Effort**: Medium
* **Risk**: MEDIUM
* **Category**: feature
* **Planned at**: Nov 11 2026; refresh against landed ETH-102 before implementation.
* **Story**: [element-reference-story.md](element-reference-story.md).

## Why this matters

The designer should point at what needs changing instead of describing its location. Ethan prefers
Amp's fluid, slightly snapping selector because it does not feel like fighting the UI. Cursor's
inline-span/paragraph switching is the concrete interaction to avoid.

## Current state

* ETH-102 owns the existing Workbench selection and element-identity foundation. This checkout
  predates its landing; inspect the landed implementation before choosing integration points.
* The story records two inspected videos, numbered acceptance criteria and the intended feel.
* A tag reaching a staging bar is visible in the reference; delivery into our conversation is a
  requirement to build and verify, not behavior established by that recording.

## Approach

Reuse the existing selection foundation and conversation draft/message path. Keep target choice
stable around incidental pointer movement, with deliberate child/parent refinement. Animate the
translucent filled highlight without letting it disagree with the click target. The bottom-right
chat button opens a bottom chat panel; only the arrow button engages selection. Add to chat opens
that same panel with the selected reference. Preserve reference identity and preview
context through the mocked message flow. Smoothing animation alone cannot fix unstable targeting;
do not build a second selector or enable a live-model service to demonstrate the feature.

## Scope

* In: bottom chat panel, explicit arrow activation, filled highlight motion, nested refinement,
  removable draft chips, message reference data, unresolved references, and accessibility.
* In: live and component previews where available, without changing their navigation.
* Out: bulk selection, automatic code editing and new Storybook navigation; unnecessary for one
  element reference to reach a conversation.
* Out: gateway, sign-in and live-model integration; the design flow remains mocked.

## Steps

* Inspect landed ETH-102 selection/identity and the current draft/message contract.
* Open chat from the bottom-right button without selection; enter selection only via the arrow.
  Preserve normal preview and spacing drag behavior outside reference selection.
* Tune target stability and slight-snap highlighting against both recordings and nested targets.
  Use a light translucent whole-region fill plus a readable outline, not an outline alone.
* Make Add to chat open the bottom chat panel and attach a labelled, removable reference to the
  existing draft. Preserve it when the mock message sends.
* Detect unresolved identity without retargeting, and cover keyboard use and reduced motion.

## Test plan

* Sweep a real pointer across inline spans, their paragraph, adjacent small controls and nested
  card/button targets. Show stable targets and deliberate child/parent refinement in a recording.
* During highlight travel, clicking selects the indicated target without activating it.
* Open chat without selection, activate the arrow, then select and Add to chat. Verify one bottom
  panel, preserved draft and a chip. Inspect filled highlights in light and dark previews.
* Assert the reference identity and preview context reach the sent mock message, not just the chip.
* Exercise removal, Escape, rerender/removal of a target, reduced motion and keyboard operation.
* Recheck spacing selection and dragging. Run the existing relevant tests and repository checks.
* Inspect Helium/Chrome and Safari. Report actual browser coverage; WebKit is not actual Safari.

## Done when

* All numbered story criteria pass, including stable targeting and correct message reference data.
* The recorded interaction supports the claimed feel; a chip-only screenshot is insufficient.
* No live-model request or accidental preview activation occurs during reference selection.
* Changes land directly on main under ADR-017, with this ticket and verification in the commit body.

## Notes

Risk: MEDIUM. Pointer stability, nested targeting and stale identity can fail independently.
Use poteto-mode, emil-design-eng and gestures per the project's UI build workflow. This ticket
does not change serial build order. Linear owns status; no GitHub issue or PR under repo policy.
