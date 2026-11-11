---
linear: ETH-115
---
# Open a component in Component mode, in place

## Status

- **Goal**: a component opened from the tree is edited where it sits in the running app, and
  its edits reach every instance.
- **Initial priority**: P2
- **Effort**: Large
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `45c22d6`, 2026-11-11. Replaces the plan made at `04cb7ad`, which
  made a Storybook story the only target (ADR-024). Stories were split into ETH-118 on
  2026-11-11.
- **Story**: [component-stories-story.md](component-stories-story.md), criteria 1 to 12 and
  20 on. Needs ETH-114.

## Why this matters

PRD R3. Component mode exists as a button, but it shows one fixed chat, so no component can
be worked on alone. "AC 9" below means criterion 9 in `component-stories-story.md`.

This ticket is the in-place view and the reach of an edit (AC 1 to 12). Stories (AC 13 to 19)
are ETH-118, which needs this ticket.

## Current state

* `DesignWorkspace` in `apps/web/src/shell/deck.tsx` renders Component mode as the shared
  mock chat (`MockThread component`) and hides the Live workspace. The mode is saved in the
  shell's state (`mode` in `state.ts`), and inside the Workbench's frame a switch stays in
  the app (`verbs.ts`).
* `selectorOf` in `packages/workbench/src/dom.ts` uses a `data-wb` name only when it is
  unique in the page. The grammar in `selector.ts` already accepts
  `[data-wb="Name"] > tag:nth-child(n)`, so the override file's format does not change.
* The overlay reads the selection's box on every frame (`page.ts`), so the Workbench already
  measures the rectangle the fade needs.
* The override file loads after `index.css` and outside every layer (`root.tsx`), and
  Storybook's preview loads it last too (`apps/storybook/.storybook/preview.ts`).

## Approach

**Opening.** A click on a row already selects (ETH-114). It now also opens the component the
row belongs to: the app switches to Component mode and keeps the Live workspace on screen
instead of the shared chat. The open component is kept in the URL. Read how the mode is
saved in `state.ts` before choosing between the app's URL and the Workbench's.

**The view.** The component is scrolled into view, and one CSS mask fades what is around its
rectangle. The drawer is inside the frame, so the mask has to leave it visible: either mask
the workspace beside the drawer, or add the drawer's rectangle to the mask. An untested
sketch of the mask is in the
[design discussion](https://ampcode.com/threads/T-01a1cb77-b3f0-7646-810b-65c747a9ac27).

**Selection.** The elements a click can pick are limited to the open component's root and
what is inside it. Nudge is off for the root.

**Reach.** `selectorOf` takes the reach of the edit. In Component mode it anchors at the
nearest ancestor that has a `data-wb` name, unique or not. In Live mode it is unchanged. The
nearest name wins, so an edit inside a card that sits inside the chat panel is saved under
the card.

**Which rule wins.** Worked out from the grammar, to be confirmed by a test: a Live mode
selector for an instance runs from a higher anchor through the component's root, so it has
every step of the component's selector and at least one more. It is the more specific rule
and wins wherever it sits in the file. A component that appears once has the same selector
in both modes, which is one rule, as intended.

Rejected: a "Push to live" button (ADR-023). Rejected: stand-in surroundings drawn around a
story (ADR-024).

## Scope

* In: the click that opens a component; the Live workspace kept on screen in
  Component mode; the open component in the URL; the mask; the limit on selection; the reach
  in `selectorOf`; the reach shown in the inspector; their tests.
* Out: Storybook's controls, addons and search, dragging components into the shell, a shape
  creator, and a "Push to live" button. The story excludes them.
* Out: any change to the drawer's look, and the thread list outside the Workbench.
* Out: stories in Component mode. Those are ETH-118.

## Steps

* Make a row's click open its component: switch the mode, keep the Live workspace shown, and
  put the component in the URL (AC 1, 2, 6, 7).
* Scroll the component into view and apply the mask, with the drawer left visible. No
  animated fade under reduced motion (AC 3).
* Limit selection to the component, and turn nudge off for its root (AC 4, 9).
* Remove the mask and the limit on a switch to Live mode (AC 5).
* Give `selectorOf` the reach and anchor at the nearest name in Component mode (AC 8).
* Show the reach in the inspector (AC 11).
* Confirm an instance's Live mode value wins, and that a value unmatched in another state of
  the component is listed (AC 10, 12).

## Test plan

* A unit test covers the reach: for an element inside a repeated component, Live mode gives
  a path from a higher anchor, Component mode gives the component's name and the inner path,
  and an element inside a nested component is saved under the inner one.
* One browser test on a component with at least two instances: open it from the tree, drag a
  padding inside it, and assert both instances changed and the override file holds one rule
  under the component's name. Then, in Live mode, change the same padding on one instance
  and assert only that instance differs.
* Assert an element outside the open component cannot be selected, and the root cannot be
  nudged.
* Reload on an open component and switch modes both ways; assert the component, the saved
  panes and the threads are kept.
* Look at the fade on a component at the edge of the window, one beside the drawer, and one
  taller than the window, in light and dark, in Chrome and Safari.

## Done when

* The unit test and the browser test pass, and the fade has been looked at in each case the
  test plan names.
* The drawer's screenshots in each mode differ only in their rows.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass, and the production build contains no
  fade.
* The change is on `main` in commits whose bodies name this ticket's Linear identifier.

## Notes

Risk: MEDIUM. It is one document, one cascade and one dev server. The parts that can go wrong
are the mask around the drawer and a component whose inner structure differs between states,
where a saved path stops matching.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.
