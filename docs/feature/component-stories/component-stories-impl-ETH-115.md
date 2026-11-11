---
linear: ETH-115
---
# Open a component in Component mode: in place, then as a story

## Status

- **Goal**: a component opened from the tree is edited where it sits in the running app, and
  its edits reach every instance. After that, a component the app is not showing opens as
  its Storybook story.
- **Initial priority**: P2
- **Effort**: Large
- **Risk**: MEDIUM for part A, HIGH for part B
- **Category**: feature
- **Planned at**: commit `45c22d6`, 2026-11-11. Replaces the plan made at `04cb7ad`, which
  made a Storybook story the only target (ADR-024).
- **Story**: [component-stories-story.md](component-stories-story.md). Needs ETH-114.
  The Light and Dark switch comes from ETH-113.

## Why this matters

PRD R3. Component mode exists as a button, but it shows one fixed chat, so no component can
be worked on alone. "AC 9" below means criterion 9 in `component-stories-story.md`.

The work is in two parts. Part A is the in-place view and the reach of an edit (AC 1 to 12).
Part B is stories (AC 13 to 19). Part A does not depend on part B. When part A lands, part B
gets its own Linear ticket.

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
* Storybook runs as its own dev server on port 6006 and renders every story inside
  `#storybook-root`. Read from the code, not run: `selectorOf` would anchor a story edit at
  that id, so it would apply to every story and never to the shell.
* The Workbench reads and writes inside the canvas through `frame.contentDocument`, which
  the browser allows only for a page on the Workbench's own origin.
* The Workbench's plugin asks the app's dev server to hot reload the override file after a
  write. Storybook's server is not told.
* 13 story files exist, for about half of the catalog's components.

## Approach

### Part A: the component in place

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

### Part B: stories

Frame the story's own Storybook URL (`iframe.html` with the story's id). No story is
rendered by the app, so there is no second renderer to keep in step (ADR-014).

The story has to be on the app's origin, or the Workbench cannot read it. The app's dev
server forwards one path to Storybook's dev server. Rejected: messaging between two
origins, which would mean a second copy of selection, measuring and handles inside
Storybook. Rejected: importing story files into the app, which is the second renderer the
PRD rules out.

The drawer belongs to the app (ADR-025), so the story is shown in a frame inside the app's
Component mode. The Workbench's canvas document is then the story's, two frames down, and
the overlay has to add that frame's position. This reverses the earlier plan, which wanted
the story's document directly in the Workbench's frame.

The list is Storybook's `index.json`, turned into a tree by a pure function over its titles,
and shown in the drawer below the components on the canvas.

## Scope

* In, part A: the click that opens a component; the Live workspace kept on screen in
  Component mode; the open component in the URL; the mask; the limit on selection; the reach
  in `selectorOf`; the reach shown in the inspector; their tests.
* In, part B: the forward to Storybook in the app's dev config; the index-to-tree function;
  the story rows; the story frame inside the app; the Workbench editing that document; hot
  reload of the override file in the story; their tests.
* Out: Storybook's controls, addons and search, dragging components into the shell, a shape
  creator, and a "Push to live" button. The story excludes them.
* Out: any change to the drawer's look, and the thread list outside the Workbench.
* Out: stories, components and Storybook's own config beyond what the forward needs.

## Steps

### Part A

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

### Part B

* Forward one path on the app's dev server to Storybook, dev only. Confirm a story's page
  loads through it with its scripts and hot reload working. Stop here if it cannot be made
  to work.
* Add the index-to-tree function: group, component, story, in Storybook's order, without
  documentation entries (AC 13).
* List the stories in the drawer in Component mode and show the not-running message when the
  index cannot be fetched (AC 13, 19).
* Show the selected story in a frame inside the app and put the selection in the URL
  (AC 14, 18).
* Make the story's document the one the Workbench selects, measures and edits, with only
  named components selectable (AC 15).
* Confirm a write hot reloads the story; if Storybook's watcher misses it, tell its server
  as the plugin tells the app's (AC 16).
* Set the story's theme from the Workbench's switch (AC 17).

## Test plan

### Part A

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

### Part B

* A unit test covers the index-to-tree function on a small index with two groups, a
  documentation entry and a story at the top level.
* One browser test with both servers running: pick a story from the drawer, select an
  element in it, drag a padding, and assert the story's element changed, the override file
  changed, and the same component in the Live shell shows the new padding.
* Stop Storybook and assert the drawer's message, and that a component on screen still
  opens.
* Reload on a selected story and switch modes both ways; assert the story is kept.
* Inspect in Chrome and Safari, light and dark.

## Done when

* Part A: its unit test and browser test pass, and the fade has been looked at in each case
  the test plan names.
* Part B: its unit test and browser test pass.
* The drawer's screenshots in each mode differ only in their rows.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass, and the production build contains no
  forward, no story list and no fade.
* The change is on `main` in commits whose bodies name this ticket's Linear identifier.

## Notes

Risk, part A: MEDIUM. It is one document, one cascade and one dev server. The parts that can
go wrong are the mask around the drawer and a component whose inner structure differs
between states, where a saved path stops matching.

Risk, part B: HIGH. Four things can each fail on their own: serving Storybook under the
app's origin with its hot reload intact, editing a document two frames down, getting a write
to reload in two dev servers, and the two cascades. Stories load the catalog's CSS unless
they ask for `cascade: "app"`, so a story can look different from the shell.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.
