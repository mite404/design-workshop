---
linear: ETH-101
github: 3
filed: 2026-11-11
---
# Change the window's corner radius

## Status

- **Goal**: the first design value, end to end: three ways to change it, saved to the override file,
  running in the app.
- **Initial priority**: P1
- **Effort**: Large
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `94a319b`, 2026-11-11
- **Story**: [corner-radius-story.md](corner-radius-story.md). Needs ETH-99 and ETH-100.

## Why this matters

This is the first time Ethan changes the look of the app by dragging instead of describing.
Everything built here (the write endpoint, the Workbench page, the inspector field, the scrub, the
canvas handle) is reused by every later value. The story's numbered acceptance criteria are the
contract. "AC 9" below means criterion 9 in `corner-radius-story.md`.

## Current state

* The window radius is the literal `md:rounded-[12px]` in `apps/web/src/shell/window.tsx`, line 63.
  Mobile is full-bleed with no radius.
* After ETH-100, `overrides.css` exists and loads, with `parseOverrides` and `setOverride` in
  `packages/workbench`.
* There is no Workbench page, no write endpoint and no editable value.

## Approach

Build in five parts, each checked before the next: expose the value, the write endpoint, the
Workbench page with the inspector field, the label scrub, the canvas handles. One piece of state
owns the radius; the field, the label and the handles all read and write it, so the three inputs
cannot disagree.

The Workbench frames the app on the same origin, served by the app's own dev server. That lets it
read the window's geometry and set the in-hand value directly on the frame's document. Rejected: a
separate Workbench server talking to the app by messages. It needs a protocol and origin checks for
no gain while there is one app.

The endpoint is a dev-only Vite plugin. Rejected: a standalone writer process. The dev server
already runs beside the checkout and already hot reloads the file.

The label scrub, the handles and the readout pill take their look from the [Moving mountains
thread](https://ampcode.com/threads/T-01a1be69-69d6-77ac-97bc-2c6be01e9bd3): sleek and minimal,
small quiet handles, a pill that highlights on hover and drag, resize cursors. That thread is a
reference for the look, not for the technique. Plain pointer events are enough here, so there is no
drag library. Handles follow the pointer exactly, with no lag or bounce, and keyboard parity stays
because the story requires it. Rejected: bklit here. It is the chart library for later, and nothing
in this ticket is a chart.

## Scope

* In: `packages/catalog/src/tokens.css` and `apps/web/src/shell/window.tsx`, to expose
  `--window-radius`.
* In: `packages/workbench`: the Vite plugin, the Workbench page, the drag maths and their tests.
* In: `apps/web/vite.config.ts`, to add the plugin.
* Out: layers and assets panels, and the Component Canvas view. No story needs them yet.
* Out: selecting any region but the window, and any other value.
* Out: undo, Check and commit, the command line tool. Each is its own ticket.
* Out: per-corner radii. The story excludes them.

## Steps

Part 1, expose the value:

* Add `--window-radius: 12px` to `:root` in `tokens.css`.
* Change `md:rounded-[12px]` to `md:rounded-[var(--window-radius)]`. Mobile stays full-bleed.
* Check: the app looks identical. A hand-typed override of 20px rounds the window more.

Part 2, the write endpoint:

* Add a Vite plugin in `packages/workbench` with `apply: "serve"`, so it cannot exist in a build (AC
  14).
* `GET /__workbench/values` returns the baseline and override value of each editable name.
* `POST /__workbench/values` takes a name, a value and `was`. A null value resets (AC 12). `was` is
  the override value the client last read; if the file now says otherwise, answer 409 and write
  nothing (AC 13).
* The endpoint is a trust boundary. It writes `overrides.css` and no other path, whatever the
  request says. It accepts only names on the editable list (to start, `--window-radius`) and only
  values that are a pixel length. It rejects requests whose `Origin` is not the dev server's own. It
  writes through a temp file and a rename, so a crash cannot leave half a file.
* Check: `curl` sets, replaces and resets the value, and the app hot reloads each time. A bad name,
  a bad value, a foreign origin and a stale `was` are each refused. `git status` shows one file (AC
  11).

Part 3, the Workbench page and inspector field:

* Serve the Workbench at `/__workbench/` from the app's dev server: the canvas (a frame of the app)
  in the centre, the inspector on the right. Spike this first. If React Router's dev server will not
  allow it, record the alternative in the drift log before building further.
* In hand: set `--window-radius` inline on the frame's root element (AC 9, live).
* On Enter or blur: POST, then drop the inline value once the hot reload lands (AC 9, saved).
* Clamp to 0 and half the window's shorter side, measured from the frame (AC 3).
* Arrow keys change the value by 1, and by 10 with Shift. Bad input keeps the last good value (AC 4,
  5).
* Add a reset button (AC 12) and a conflict message on 409 (AC 13).

Part 4, the label scrub:

* Pointer capture on the "Corner radius" label, with a horizontal resize cursor. 1 per pixel, 10
  with Shift (AC 6).
* Escape restores the value from before the drag (AC 10). Release saves.

Part 5, the canvas handles:

* Draw an overlay in the Workbench, positioned over the frame from the window's bounding box. It
  adds nothing to the app's markup.
* Clicking the window selects it. Four round handles appear, each inset along its corner's diagonal
  by the current radius (AC 7).
* Dragging towards the centre raises the radius, and all four move together (AC 7).
* A readout pill by the pointer shows "Radius N" (AC 8). Escape restores (AC 10). Release saves.
* The handles follow frame resize and scroll.
* The drag maths (pointer position to radius, with clamping) is a pure function.

## Test plan

* One browser test walks the story: type a value, scrub the label, drag a handle by an uneven
  amount, press Escape mid-drag, reset. At each step it asserts the window's computed radius, the
  field's value and the override file's contents.
* Unit tests cover the drag maths and each refusal of the endpoint.
* Search the `pnpm build` output for `__workbench` (AC 14).
* Take screenshots of the Workbench with the window selected, mid-drag and after reset, and look at
  them.

## Done when

* The browser test and the unit tests pass.
* The build output contains no `__workbench` string.
* The three screenshots show nothing misaligned.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: MEDIUM. Two unknowns. Serving the Workbench from React Router's dev server is untested; part 3
spikes it first. The write endpoint touches the file system from a browser request, so its refusals
are tested, not assumed. Atlas's old `LiveMode.tsx` on the `design-tutorial-workshop` branch is a
second reference for pointer capture and keyboard parity.

## Drift log

Record here anything built differently from this plan, and why.
