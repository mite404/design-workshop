---
linear: ETH-118
---
# Open a story in Component mode

## Status

- **Goal**: a component or a state the app is not showing opens as its Storybook story, from
  the drawer, and is edited there.
- **Initial priority**: P3
- **Effort**: Large
- **Risk**: HIGH
- **Category**: feature
- **Planned at**: commit `45c22d6`, 2026-11-11, as part B of ETH-115. Split into its own
  ticket on 2026-11-11.
- **Story**: [component-stories-story.md](component-stories-story.md), criteria 13 to 19.
  Needs ETH-115. The Light and Dark switch comes from ETH-113.

## Why this matters

PRD R18 and ADR-024. A component or a state the app is not showing cannot be opened in place,
so it has no way into Component mode. Its story is that way in. "AC 14" below means criterion
14 in `component-stories-story.md`.

## Current state

* Opening a component in place, the drawer's tree in Component mode and the reach of an edit
  come from ETH-115.
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

* In: the forward to Storybook in the app's dev config; the index-to-tree function;
  the story rows; the story frame inside the app; the Workbench editing that document; hot
  reload of the override file in the story; their tests.
* Out: Storybook's controls, addons and search, dragging components into the shell, a shape
  creator, and a "Push to live" button. The story excludes them.
* Out: any change to the drawer's look, and the thread list outside the Workbench.
* Out: stories, components and Storybook's own config beyond what the forward needs.
* Out: opening a component in place and the reach of an edit. Those are ETH-115.

## Steps

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

* The unit test and the browser test pass.
* The drawer's screenshots in each mode differ only in their rows.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass, and the production build contains no
  forward and no story list.
* The change is on `main` in commits whose bodies name this ticket's Linear identifier.

## Notes

Risk: HIGH. Four things can each fail on their own: serving Storybook under the app's origin
with its hot reload intact, editing a document two frames down, getting a write to reload in
two dev servers, and the two cascades. Stories load the catalog's CSS unless they ask for
`cascade: "app"`, so a story can look different from the shell.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

* Built on ETH-115 at `45b8b96`. The preview remains one chat, with no Canvas button. The
  Components tree still contains only rendered app components. Stories appear below it only
  in Component mode, using the existing drawer rows and section styles.
* The app forwards `/__stories/` to port 6006. Storybook's development Vite builder needs
  that base, prefixed virtual entry scripts, and a same-origin HMR socket. These changes
  apply only in its middleware-mode dev server, not its Vitest or production builds.
* The selected story and app route are stored as `story` and `path` in the Workbench URL.
  Opening an app component clears the story. Switching modes retains the story iframe and
  app workspace instead of navigating either document.
* The existing overlay moves to the story iframe's rectangle. Measurements remain in the
  active document's coordinates, rather than adding the nested offset to every handle.
  Reference highlights add that offset too. Listeners follow document changes and are
  installed once per document, including after switching back to a retained frame.
* Named story roots remain selectable when they fill the viewport. Unnamed surroundings
  remain unselectable. The same named-root selector and override file serve both cascades.
* A Workbench API write hot reloads Storybook through its existing watcher. No second
  notification endpoint was needed. The browser check waits for the computed value and
  removal of the temporary inline preview, then checks the same value in the Live shell.
* The story theme follows the app root, including after Storybook rerenders on hot reload.
* CI has a separate stories browser group with both dev servers. It runs the forward and
  editing checks, stops Storybook, then checks the start-command message and app-component
  opening. The full local browser command now also needs Storybook running.
* Chrome checks run in Chromium in the Linux orb. Safari remains a manual check, as for
  ETH-115. No Mac satellite was started.
