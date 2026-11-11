---
linear: ETH-115
---
# Open and edit a Storybook story in Component mode

## Status

- **Goal**: Component mode lists Storybook's stories and shows the selected one as an editable
  canvas.
- **Initial priority**: P2
- **Effort**: Large
- **Risk**: HIGH
- **Category**: feature
- **Planned at**: commit `04cb7ad`, 2026-11-11. Refresh against the landed editor entry before
  starting.
- **Story**: [component-stories-story.md](component-stories-story.md). Needs ETH-114.
  The Light and Dark switch comes from ETH-113.

## Why this matters

PRD R3. Component mode exists as a button, but it shows one fixed chat, so no component can be
worked on alone. The PRD marks story navigation as planned, not built. "AC 9" below means
criterion 9 in `component-stories-story.md`.

## Current state

* `apps/web/src/shell/deck.tsx` renders Component mode as the shared mock chat
  (`ChatThreadPanel` with `MOCK_CHAT`). No story is loaded.
* Storybook runs as its own dev server on port 6006. Its preview already loads the override
  file last (`apps/storybook/.storybook/preview.ts`), so a saved value reaches stories.
* The Workbench reads and writes inside the canvas through `frame.contentDocument`, which the
  browser allows only for a page on the Workbench's own origin.
* The Workbench's plugin asks the app's dev server to hot reload the override file after a
  write. Storybook's server is not told.

## Approach

Frame the story's own Storybook URL (`iframe.html` with the story's id). No story is rendered
by the app, so there is no second renderer to keep in step (ADR-014).

The story has to be on the app's origin, or the Workbench cannot read it. The app's dev
server forwards one path to Storybook's dev server. Rejected: messaging between two origins,
which would mean a second copy of selection, measuring and handles inside Storybook. Rejected:
importing story files into the app, which is the second renderer the PRD rules out.

The story's document must be the document the Workbench edits directly, not a frame inside the
app inside the Workbench's frame. Where that frame sits depends on the editor entry work now
in progress, so inspect what landed before choosing.

The list is Storybook's `index.json`, turned into a tree by a pure function over its titles.
It is shown in the existing history panel with the panel's own components and styles.

## Scope

* In: the forward to Storybook in the app's dev config; the index-to-tree function; the
  panel's content in Component mode; the story frame; the selected story in the URL; hot
  reload of the override file in the story; their tests.
* Out: Storybook's controls, addons and search, and dragging components into the shell. The
  story excludes them.
* Out: any change to the history panel's look, and any change to Live mode's thread history.
* Out: stories, components and Storybook's own config beyond what the forward needs.

## Steps

* Forward one path on the app's dev server to Storybook, dev only. Confirm a story's page
  loads through it with its scripts and hot reload working.
* Add the index-to-tree function: group, component, story, in Storybook's order, without
  documentation entries (AC 1, 4).
* List the tree in the history panel in Component mode, unchanged in look; keep thread history
  in Live mode (AC 1 to 3).
* Show the selected story in the preview and keep the shared chat until one is chosen. Put the
  selection in the URL (AC 5 to 7).
* Show the not-running message when the index cannot be fetched (AC 8).
* Make the story the Workbench's canvas so selection and every editor work on it (AC 9).
* Confirm a write hot reloads the story; if Storybook's watcher misses it, tell its server as
  the plugin tells the app's (AC 10, 11).
* Set the story's theme from the Workbench's switch (AC 12).

## Test plan

* A unit test covers the index-to-tree function on a small index with two groups, a
  documentation entry and a story at the top level.
* One browser test with both servers running: pick a story from the panel, select an element
  in it, drag a padding, and assert the story's element changed, the override file changed,
  and the same component in the Live shell shows the new padding.
* Stop Storybook and assert the panel's message.
* Compare a screenshot of the panel in Component mode with one in Live mode; only the rows
  may differ.
* Reload on a selected story and switch modes both ways; assert the story and the saved panes
  and threads are kept.
* Inspect in Chrome and Safari, light and dark.

## Done when

* The unit test and the browser test pass.
* The panel screenshots differ only in their rows.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass, and the production build contains no
  forward and no story list.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: HIGH. Three things can each fail on their own: serving Storybook under the app's origin
with its hot reload intact, making a story the edited document, and getting a write to reload
in two dev servers. Do the forward first and stop if it cannot be made to work; the rest
depends on it. If it grows, split the list and preview (AC 1 to 8) from editing (AC 9 to 12).

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.
