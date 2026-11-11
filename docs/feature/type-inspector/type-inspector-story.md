# Story: set the type of one element, as in Figma

Status: confirmed by Ethan, Nov 11 2026 ("confirmed good"). Tickets: ETH-105, ETH-106 and
ETH-107, listed at the end.

**As** a designer tuning a mockup an agent has already built,
**I want** to pick the font and set the type of a piece of text in a panel that works like
Figma's,
**so that** I can try fonts and fix type by eye instead of describing it to an agent.

## Where the rules come from

Ethan: "our whole font inspector feature can be identical to how figma's is" (ADR-009). The
model is his screenshot of Figma's panel, Nov 10 2026: the Typography section, and the Basics
popover behind its settings button. He asked for vertical trim, list style and paragraph spacing
from that popover as well.

How Figma gets fonts
([Add a font to Figma](https://help.figma.com/hc/en-us/articles/360039956894-Add-a-font-to-Figma)):

- Google fonts are built in.
- Fonts installed on the computer come through the desktop app, or in a browser through a small
  helper program (FigmaAgent) that lists the installed fonts to figma.com over localhost. The
  font files stay on the computer.

What the Workbench uses for the same two jobs:

- The list of Google fonts comes from the Fontsource API, which needs no account or key. On
  Nov 11 2026 it listed 1984 families, 573 of them variable (one file covers every weight).
- Installed fonts come from the browser's own
  [`queryLocalFonts()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queryLocalFonts),
  so no helper program is needed. The browser asks for permission once. It works in Chrome and
  Edge 103 and later on a computer, and not in Safari or Firefox. In those two the list shows
  Google fonts only.

Five places where this story differs from Figma, all on purpose:

- The Workbench does not edit text, only values (ADR-001). So Figma's habit of turning a typed
  `- ` or `1. ` into a list is not here; list style is a control only. Editing text would be
  its own story.
- A text layer in Figma holds many paragraphs. On the web each paragraph is its own element, so
  paragraph spacing is the space after the selected element, and list style turns the selected
  element into one list item (or changes the markers when a list is selected).
- Size offers the nine named steps first, so the element keeps following the type dial of the
  [type scale story](../type-scale/type-scale-story.md). Figma's size field is a free number.
- A chosen Google font is downloaded into the repo, because the mockup is the running app and
  has to carry its own fonts (ADR-014). Figma keeps fonts on its servers.
- An installed font is saved by name only. It shows on a computer that has it and nowhere else.
  Ethan, Nov 11 2026: "this tradeoff is acceptable for now". The inspector shows a missing font
  warning for it, as Figma does.

## Acceptance criteria

### Typography section

1. Selecting an element that holds text directly shows a Typography section in the inspector,
   laid out as in Figma: family, then style and size, then line height and letter spacing, then
   alignment. Selection works as in the [spacing story](../spacing/spacing-story.md).
2. Every control shows the element's current value, wherever that value comes from.
3. Style lists the weights and italics the chosen family has, by name (Regular, Medium, Bold
   Italic and so on).
4. Size is a field with a list. The list holds the nine steps with their pixel sizes; arrow keys
   move one step. A typed whole number is accepted and saved in pixels, and the field marks that
   element as off the scale, because it no longer follows the type dial.
5. Line height is in pixels. Arrow keys move it 4px, the line grid of the type scale story.
6. Letter spacing is a percentage of the size, as in Figma. Arrow keys move it 1%, or 10% with
   Shift; a typed decimal such as -0.5 is accepted.
7. Horizontal alignment is left, centre or right. Vertical alignment is top, middle or bottom,
   and shows only when the element is taller than its text.

### Font picker

8. Family opens a list with a search field. Fonts already used in the mockup come first, then
   Google fonts, then fonts installed on the computer. A filter narrows the list to one of the
   three groups.
9. Typing in the search field narrows the list as each letter is typed. Arrow keys move through
   it and Enter picks.
10. Moving through the list previews each font on the selected text. Escape closes the list and
    the old font returns.
11. Picking a Google font saves its files and its licence into the repo, so the font works for
    a teammate, offline and in a production build.
12. Picking an installed font saves its name only. If a saved family is neither in the repo nor
    installed, the family field shows a missing font warning.
13. The same picker sets the two fonts the whole Template is built on, the text font and the
    display font, from the Type panel of the type scale story. That changes every element at
    once.

### Basics popover

14. The settings button in the Typography section opens a popover with: alignment (adds
    justify), decoration (none, underline, strikethrough), case (as typed, upper, lower, title,
    small caps), vertical trim (standard, or cap height to baseline), list style (none,
    bulleted, numbered) and paragraph spacing.
15. Paragraph spacing moves in steps of 2px (ADR-015) and never goes below 0.

### Saving, for every control

16. The text updates live during a change. On release, Enter, or blur, the value is written to
    the selected element's block in the override file and the app hot reloads.
17. After a change, `git status` shows only the override file as modified, plus the font's own
    files the first time a Google font is picked. The mockup's source is never rewritten.
18. Reset on a control removes that value from the override file and the mockup's own value
    returns.
19. None of this exists in a production build.

## Not in this story

- Truncate text and wrap style, the Details tab, and the extra decoration settings (line style,
  thickness, offset).
- Text colour. In Figma that is the Fill section, so it belongs to the first colour story.
- Text styles (the four-dot button). The nine steps are the nearest thing so far.
- Uploading a font file so that an installed font ships with the mockup.
- Several elements selected at once, and different type on part of one element's text.
- Editing the text itself, which includes Markdown-style typing.

## Decisions made while drafting, confirmed with the story

- Size picks a step first (criterion 4). The type scale story said resizing one element was an
  agent's job; this replaces that line.
- Google fonts are downloaded into the repo, with a second Workbench-written stylesheet that
  declares them (criterion 11, ADR-021). This widens ADR-002, which says the override file is
  the only file the Workbench writes. Rejected: loading fonts from a font server at run time,
  because the mockup would then break offline and depend on someone else's server.
- Installed fonts need Chrome or Edge. Rejected for now: a helper that reads the computer's font
  folders, which is what FigmaAgent is. Add it if Ethan designs in Safari or Firefox.
- Criterion 13, the two Template-wide fonts, is not in Figma's panel. It is here because every
  font in the Template comes from those two values, so it is the one-step way to try a font
  pairing (PRD R16).

## Tickets

1. [ETH-105](type-inspector-impl-ETH-105.md) - Typography section: style, size, line height,
   letter spacing and the two alignments (criteria 1 to 7). Needs ETH-102 for selection and
   ETH-104 for the steps.
2. [ETH-106](type-inspector-impl-ETH-106.md) - Font picker (criteria 8 to 13). Needs ETH-105
   and ETH-100. Criterion 13 also needs the dial ticket's Type panel.
3. [ETH-107](type-inspector-impl-ETH-107.md) - Basics popover (criteria 14 and 15). Needs
   ETH-105.
