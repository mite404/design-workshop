# Story: point to an element and discuss it with the agent

Status: requested by Ethan, Nov 11 2026. Acceptance criteria drafted from the two recordings
and discussion. Implementation ticket: [ETH-110](element-reference-impl.md).

**As** a designer refining the running app,
**I want** to select an element and attach it to an agent conversation,
**so that** I can ask for changes without describing where it is or finding its code.

## What it should feel like

Ethan prefers Amp's selector: fluid highlighting with a small amount of snap, without feeling
like he is fighting the UI. Cursor's equivalent feels finicky. Matching that ease of targeting
is part of the feature, not optional polish after attaching a tag works.

Selection should settle confidently without becoming sticky. The outline should follow an
intentional move promptly, while small accidental movements should not change the target.

## Reference observations

Both recordings were supplied in the
[story discussion](https://ampcode.com/threads/T-01a1c8bc-3735-73e1-87d4-4a039c78dcca).
The private recordings remain in that thread rather than being copied into the public repo.

* Amp reference: `Screen-Recording-2026-11-10-at-11.32.58-PM.mov`. The highlight moves between
  containers and children. Selecting a button adds a `<button>` chip to a staging bar, with
  Add comment options. The clip does not show the resulting conversation attachment.
* Cursor comparison: `Screen-Recording-2026-11-10-at-11.50.14-PM.mov`. Around 00:09 to 00:13,
  small movements across paragraph text alternate between inline spans and the whole paragraph.
  Its navigation buttons are easier to target. The issue is target stability, not every selection.
* Neither recording establishes the snapping algorithm, animation duration or threshold values.
  Tune against the interaction, not invented measurements.

## Acceptance criteria

1. The bottom-right chat button opens the chat panel upward from the bottom. Opening chat does
   not engage selection. Only explicitly clicking the arrow selector button enters selection mode;
   ordinary hover and preview clicks otherwise keep their normal behavior.
2. While selecting, show a light translucent fill across the entire target region with a readable
   outline. An outline alone, especially light blue, is too hard to follow. Keep underlying content
   legible and the highlight distinguishable on light and dark previews. Move fluidly between bounds
   with slight snap, not distracting bounce or trailing motion; respect reduced motion.
3. Small movements near boundaries do not repeatedly alternate targets. A clear move to a
   neighboring element switches promptly; stability must not make targets hard to leave.
4. Prefer recognizable visible units. Moving across styled words should not require hunting for
   the gaps between spans to select their paragraph. Deliberate refinement still lets the user
   choose a child or containing element; no element becomes unreachable because of heuristics.
5. Target choice and highlight animation agree. Clicking selects the indicated target, never a
   different element hidden behind an in-flight animation, and does not activate that element.
6. With an element selected, Add to chat opens the chat panel upward from the bottom and adds a
   removable reference chip to its draft. If chat is already open, use that same panel and draft.
   Use a recognizable label such as `button · Start with a refund workflow`, not just a raw tag.
   Removing a chip preserves the typed instruction. Reuse a familiar bottom-panel interaction
   rather than inventing a separate conversation window.
7. The user can write an instruction alongside the reference. Selection never sends the draft,
   calls a live model or changes the selected element's styling.
8. Sending preserves the reference alongside the instruction in the conversation message. Keep
   the selected element's identity and preview context; the chip must not be decoration only.
9. If the referenced element disappears or identity becomes ambiguous after a render or edit,
   mark it unresolved and allow reselection. Never silently substitute a different element.
10. Escape exits selection without changing the existing draft. Selection controls, refinement
    and chip removal are keyboard accessible with visible focus and meaningful accessible names.
11. Reuse Workbench selection and identity where applicable. Reference selection must not break
    normal preview interaction or existing spacing selection and drag behavior.

## Scope and boundaries

* Cover references from the live preview and component preview where each is available. Preserve
  the preview or story identity so matching labels in different previews are distinguishable.
* Keep the app's design flow mocked. Gateway, sign-in and live-model integration remain outside
  this feature. Prove the reference reaches a mocked conversation message, without a network call.
* No bulk selection, automatic code editing, new Storybook navigation or new agent service.
* No prescribed spring, timing, pixel radius or DOM-ranking algorithm. Those are implementation
  choices to test against the recordings, including small and nested targets.

## Verification

Use a paragraph with inline spans, small adjacent controls, a nested card/button, and a moving
or scrolling target. Record a real pointer sweeping across each before selecting and attaching.
Demonstrate deliberate child/parent refinement, prompt switching to a neighbor, reference removal,
send, cancellation, and stale identity after rerender. Verify the exact reference in the message.
Show chat opening from the bottom-right button without selection, then explicit arrow activation,
selection and Add to chat opening the bottom panel with the reference. Inspect the translucent
whole-region fill on light and dark previews, including while its bounds change.

Check reduced motion and keyboard use. Compare the feel with Amp's recording and the span/paragraph
failure in Cursor's. Check Helium and Chrome, plus Safari; label Linux WebKit as an approximation
if actual Safari is unavailable. Report browser gaps rather than claiming equivalent coverage.
