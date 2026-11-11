---
linear: ETH-106
---
# Pick a font from Google fonts and installed fonts

## Status

- **Goal**: open the family row, search every Google font and every font installed on the
  computer, preview each on the selected text, and save the pick so the mockup carries the font.
- **Initial priority**: P2
- **Effort**: Large
- **Risk**: MEDIUM
- **Category**: feature
- **Planned at**: commit `6132eaa`, 2026-11-11
- **Story**: [type-inspector-story.md](type-inspector-story.md). Needs ETH-105 (the Typography
  section), ETH-100 and ETH-101.

## Why this matters

Trying a font is the change Ethan can least describe to an agent: he has to see it. This ticket
gives him Figma's font list, with the same two sources Figma has. "AC 10" below means criterion
10 in `type-inspector-story.md`. This ticket covers AC 8 to 13, and AC 16 to 19 for the family
control.

## Current state

* After the Typography section ticket, the family row shows the current family, read-only.
* The Template's fonts come from two npm packages, `@fontsource-variable/inter` and
  `@fontsource-variable/newsreader`, imported in `packages/catalog/src/tokens.css`. Every
  element takes its family from `--font-text` or `--font-display`.
* `overrides.css` is exported from `packages/catalog`, imported last in `apps/web/src/root.tsx`
  and appended to each story in `apps/storybook/.storybook/preview.ts`.
* The override file holds one value on one line. It cannot hold a font declaration, which has
  several parts and can repeat.
* Checked Nov 11 2026: `https://api.fontsource.org/v1/fonts?type=google` lists 1984 families
  with no key, to any origin. `/v1/fonts/ID` lists a family's files, and `/v1/variable/ID` its
  weight range.
* Checked Nov 11 2026: `window.queryLocalFonts()` exists in Chrome and Edge from version 103,
  and not in Safari or Firefox. It needs a secure page and asks for permission once.

## Approach

Two sources, one list, three ways to end up in the mockup.

A font already in the mockup needs nothing but its name. A font installed on the computer is
also saved by name only: it shows on a computer that has it and nowhere else, which Ethan
accepted. A Google font is copied into the repo (ADR-021): its files and licence go into
`packages/catalog/src/fonts/ID/`, and its `@font-face` rules go into a second file the
Workbench writes, `packages/catalog/src/fonts.css`. Rejected: loading Google fonts from a font
server when the app runs, because the mockup would break offline and depend on someone else's
server. Rejected: adding an npm package per font, which would mean running an install from a
button.

The browser fetches the list of Google fonts itself. The dev server does the download, and it
takes only a font's ID from the browser, never a web address. It asks Fontsource for that ID's
files and fetches them from one known host. That keeps the endpoint from being used to fetch
or write anything else.

A preview loads the font straight from the Fontsource host into the frame, with nothing saved.
Only a pick writes to the repo.

The picker is a plain search field over a list. Rows use the browser's own
`content-visibility: auto`, so 2000 rows stay cheap. Rejected: a combobox library and a
virtual list library.

Whether a family is missing is found by measuring: a sample string set in the family with a
fallback is the same width as the fallback alone, for two different fallbacks. It works in
every browser and needs no permission.

## Scope

* In: `packages/workbench`: the picker, the font endpoint, the `font-family` value check, and
  their tests.
* In: `packages/catalog`: `src/fonts.css` (empty to start), `src/fonts/`, and the export.
* In: one import line each in `apps/web/src/root.tsx` and `apps/storybook/.storybook/preview.ts`.
* Out: drawing each name in its own font inside the list. The preview is on the selected text.
* Out: any subset but the font's default one, which is Latin for nearly all of them.
* Out: removing a font's files when nothing uses it any more. Delete the folder and its rules
  by hand.
* Out: uploading a font file, and a helper program for Safari and Firefox. The story excludes
  them.

## Steps

Part 1, the font file:

* Add an empty `fonts.css` to `packages/catalog/src`, export it as `./fonts.css`, and import it
  in `root.tsx` just before `overrides.css` and in Storybook's `preview.ts`.
* Check: a hand-written `@font-face` rule in `fonts.css` with a file in `src/fonts/` shows in
  the app, in a story, and in `pnpm build` output.

Part 2, the font endpoint:

* `POST /__workbench/fonts` takes one field, a Fontsource ID. It lives in the same dev-only
  plugin and refuses a foreign `Origin`, as the values endpoint does.
* Accept an ID only if it is lower-case letters, digits and single hyphens, at most 64 long.
* If `fonts/ID/` and its rules already exist, answer with the family and fetch nothing.
* Otherwise ask `api.fontsource.org` for the ID. For a variable font, take the weight-axis
  file, plus its italic if the family has one. For any other font, take one file per weight and
  style. Take the default subset only, in `woff2`.
* Fetch font files only from `cdn.jsdelivr.net`, and refuse a file over 5 MB. Save the licence
  from the same host as `LICENSE` in the font's folder (AC 11).
* Write the folder first, then append the family's `@font-face` rules to `fonts.css` under a
  comment line holding the ID. The family name in the rules is Google's name for it. A variable
  font's rule gives its weight range.
* Write through a temp path and a rename. A second request for the same ID changes nothing.
* The rules are built by a pure function from the font's details.

Part 3, the value:

* Add `font-family` to the properties the values endpoint accepts for an element, and
  `--font-text` and `--font-display` to the names it accepts for `:root`.
* The value is one family in double quotes, then a comma and `serif`, `sans-serif` or
  `monospace`. The name is at most 100 characters and holds no quote, backslash, brace,
  semicolon, angle bracket, line break or comment marker.
* The fallback comes from the font's category. Display, handwriting and installed fonts fall
  back to `sans-serif`.

Part 4, the picker:

* The family row opens a list with a search field and a filter for the three groups (AC 8).
* "In this mockup" lists the families in the frame's `document.fonts`. "Google" lists the
  Fontsource families, fetched once when the picker first opens. "Installed" lists the
  families from `queryLocalFonts()`.
* A Google family already in the mockup, with or without " Variable" after its name, is listed
  once, in the first group.
* If the Google list cannot be fetched, or the browser has no `queryLocalFonts`, or permission
  is refused, that group shows one line saying why.
* Typing narrows the list on each letter, matching anywhere in the name and ignoring case.
  Up and Down move through it and Enter picks (AC 9). The field and list carry combobox and
  listbox roles.
* Moving to a row previews that font on the selected text, 150 ms after the move settles
  (AC 10). A Google font is loaded for the preview with a `FontFace` in the frame. Escape or a
  click outside closes the list and removes the preview.
* Picking a Google font calls the font endpoint, waits for it, then saves `font-family` for
  the element (AC 11, 16). Picking the others saves `font-family` at once (AC 12).
* After a pick, the Style list of the Typography section shows the new family's weights. For
  an installed family they are worked out from its style names (Light, Bold Italic and so on);
  a style whose name is not one of the nine weight names is left out.
* The family row has a reset, as every control does (AC 18).

Part 5, the missing font warning:

* When the first family in the element's computed list is neither in `document.fonts` nor
  found by measuring, show a warning mark on the family row with the family's name (AC 12).

Part 6, the Template's two fonts:

* When the window is selected, the inspector shows two rows, "Text font" and "Display font",
  each opening the same picker (AC 13). A pick saves `--font-text` or `--font-display` to the
  `:root` block. The preview sets the variable inline on the frame's root element.
* The story puts these rows in the Type panel, which the dial ticket builds. Until then they
  sit beside Corner radius. Record this in the drift log.

## Test plan

* Unit tests for the font endpoint stub `fetch`. They cover a variable font, a font with
  separate weights, a second request for the same ID, an ID that is not allowed, a file address
  on another host, and a file that is too large.
* Unit tests cover the rule-building function, the `font-family` value check with a name that
  tries to close the declaration, the search match, the style names of an installed family, and
  the Google and mockup lists merged without a double entry.
* One browser test, with no network: select a heading, open the picker, type "news", move to
  Newsreader Variable and see the heading change, press Escape and see it change back, then
  pick it and assert the override file. Then reset.
* By hand, with the network: pick one variable Google font and one with separate weights. The
  font shows in the app and in a story, `git status` shows only `overrides.css`, `fonts.css`
  and the font's folder (AC 17), and `pnpm build` output holds the font files.
* By hand: set a made-up family in `overrides.css` and see the warning.
* Try the Installed group in the orb's Chrome. If its permission prompt cannot be answered
  there, say so in the report and Ethan checks it on his computer.
* Search the `pnpm build` output for `__workbench` (AC 19).
* Take screenshots of the open picker, a filtered search, and the warning, and look at them.

## Done when

* The unit tests and the browser test pass.
* The two Google fonts picked by hand show in the app, a story and the build, and the report
  lists what `git status` showed. Remove them again before committing.
* The build output contains no `__workbench` string.
* The report includes the three screenshots and says whether the Installed group was tried.
* `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
* The change is on `main` in a commit whose body names this ticket's Linear identifier.

## Notes

Risk: MEDIUM. The font endpoint fetches from the network and writes files into the repo, so
its three limits (the ID's shape, the one host, the file size) are tested, not assumed. A
family name is written into a CSS file from a browser request, so its check is tested with a
hostile name. Known ceilings: an installed family's weights are read from its style names, so
an unusual name such as "Book" is not offered; a font whose default subset is not Latin may
miss Latin letters; and measuring cannot tell a missing font from one that is exactly as wide
as both fallbacks. Each Google font has its own licence, nearly always the SIL Open Font
License, and the licence file travels with the font.

## Drift log

Record here anything built differently from this plan, and why.
