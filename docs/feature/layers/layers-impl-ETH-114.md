---
linear: ETH-114
---
# Name the components and list them in the drawer's component tree

## Status

- **Goal**: every catalog component carries its name, and the app's side drawer lists what is
  on the canvas as a tree a component can be selected from.
- **Initial priority**: P2
- **Effort**: Medium
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `45c22d6`, 2026-11-11. Replaces the plan made at `04cb7ad`, which
  put a Layers panel in the Workbench (ADR-025).
- **Story**: [layers-story.md](layers-story.md). Blocks ETH-115.

## Why this matters

PRD R4 and building block 4. Selection is by clicking the canvas only, and nothing shows how a
screen is put together. Component mode (ETH-115) needs both halves of this ticket: the names
are what an edit is saved under (ADR-023), and the tree is how a component is opened. "AC 3"
below means criterion 3 in `layers-story.md`.

## Current state

* No component carries `data-wb`. The 24 component files in `packages/catalog/src` have no
  name on their roots. The shadcn parts in `packages/ui` and `apps/web/src/shell` carry
  `data-slot`.
* `selectorOf` in `packages/workbench/src/dom.ts` anchors a selector at the nearest ancestor
  whose `data-wb` or `id` is unique in the page.
* The drawer is `AppSidebar` in `apps/web/src/shell/sidebar.tsx`. Its content is
  `ProjectTree`, built from the rows in `tree-rows.tsx`.
* The app already knows when it is inside the Workbench's frame: `verbs.ts` tests
  `import.meta.env.DEV` and `window.self === window.top`.
* The Workbench's page (`packages/workbench/src/page.ts`) is the canvas frame, the overlay and
  the inspector. Selection goes through one function, `select(node)`, called from the frame's
  pointer events in `watchFrame`. It reads the app through `frame.contentDocument`.
* The override file holds no element values today, only an empty `:root` block.

## Approach

**Names.** An agent adds `data-wb="<ComponentName>"` to the root element of each catalog
component, in source. This is the Structure lane; the Workbench does not write it (ADR-001).

**The tree's data.** A pure function in `packages/workbench` takes a root element and
returns the nested list of elements that have a `data-wb` name, in page order. An element
with only a `data-slot` name is a part of a component and is not listed. It skips a subtree it
is told to skip, which is the drawer.

**The tree's rows.** In development, inside the Workbench's frame, the drawer renders the
tree in place of `ProjectTree`, with the drawer's existing row components, so its look does
not change (AC 4). A `MutationObserver` on the page rebuilds it and ignores changes inside
the drawer, or the tree would rebuild itself forever.

**Selecting across two pages.** The rows are in the app's page and `select` is in the
Workbench's. Both are on one origin, so one DOM event each way on the frame's document is
enough: a row announces its element and the Workbench selects it; the Workbench announces
the selection and the tree marks its row.

Rejected: a Layers panel in the Workbench (ADR-025). Rejected: the Workbench drawing rows
into the drawer from outside; React owns that part of the page and would replace them.
Rejected: a file that lists the components, which someone would have to keep in step with
them (ADR-014). Rejected: names read from React while editing (ADR-023). Rejected: a tree
component library; the tree is a nested list with the standard tree roles.

## Scope

* In: `data-wb` on the catalog components' roots; the tree function and its test; the
  drawer's content inside the Workbench; the two events; their tests.
* Out: opening a component in Component mode, the fade, and saving under a component's name.
  Those are ETH-115.
* Out: the Workbench's page layout. It stays canvas and inspector.
* Out: Assets, renaming, reordering, hiding, locking. The story excludes them.

## Steps

* Add `data-wb` to each catalog component's root (AC 1, 2). Ten of the files render a
  fragment or a portal somewhere; where a component has no single root element, note it in
  the drift log and leave it unnamed.
* Add the tree function: a root element in, nested component roots out, in page order,
  without the skipped subtree (AC 3, 6, 7, 8).
* Render the tree in the drawer when the app is inside the Workbench in development, with
  tree roles and keys (AC 3, 4, 9, 13).
* Rebuild on changes to the page (AC 5).
* Wire a click and Enter to `select`, hover to the outline, and the selection back to the
  marked row (AC 10 to 12).
* Confirm the production build has the names and not the tree (AC 2, 14).

## Test plan

* A unit test covers the tree function: nesting, page order, two instances of one name as
  two rows, a `data-slot` part between two components skipped without losing the nesting,
  and the skipped subtree left out.
* One browser test: click a row and assert the same selector is selected as clicking that
  element on the canvas; select a paragraph inside a component on the canvas and assert the
  component's row is marked; navigate the app and assert the tree changed.
* Drive the tree with the keyboard only and assert Enter selects.
* Open the app outside the Workbench and assert the drawer lists threads.
* Compare a screenshot of the drawer listing components with one listing threads; only the
  rows may differ. Look at both in light and dark, at a wide and a narrow window.
* Rerun the spacing and nudge browser tests. A name on a component that appears once
  becomes the anchor of the selectors inside it, so a test that asserts a selector may need
  its expected value changed.

## Done when

* The unit test and the browser test pass.
* The drawer screenshots differ only in their rows.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass, and the production build contains no
  tree.
* The change is on `main` in commits whose bodies name this ticket's Linear identifier, the
  names in one commit and the tree in another.

## Notes

Risk: MEDIUM, up from LOW. The tree is the first Workbench interface drawn by the app, so
two pages have to agree on a selection, and development-only code now lives in the Template.
Adding names changes the selectors generated in Live mode for elements inside a component
that appears once. Nothing saved is orphaned, because the override file holds no element
values yet.

Build it in its own thread with poteto-mode and emil-design-eng. Linear owns status; no GitHub
issue or PR under repo policy (ADR-007, ADR-017).

## Drift log

Record here anything built differently from this plan, and why.

* Named the existing DOM roots without adding wrappers. `DictationModal` delegates its root to
  `Modal`, so that root keeps `Modal`. `SharedThreadView` renders a fragment in its loaded state
  and stays unnamed. `InteractiveCard` names its approved root; its rejected state is a
  `CatalogCard` and keeps that name. Fragments and portals below a single root do not prevent
  that root from carrying its component's name.
* Live selectors keep their ID or structural anchors rather than component names (ADR-023).
  A name unique now can match another instance after navigation or a mode change, so only
  Component mode may use a name for a shared edit. Existing saved selectors remain valid.
* The override file now supports Light and Dark colour blocks from ETH-113. This ticket does
  not rewrite saved values or change either theme's cascade.
* Inactive tabs and panes remain mounted under `data-retain` with `inert`. The reader skips
  those subtrees and observes `inert` changes, so navigation and mode changes list only the
  components on screen rather than retained, off-screen instances.
