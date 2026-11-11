# Story: change the Template's colours

Status: draft, Nov 11 2026. Not yet confirmed by Ethan. Ticket:
[ETH-113](colour-impl-ETH-113.md).

**As** a designer giving the Template a new look,
**I want** to pick each named colour directly, in light and in dark, and see its contrast,
**so that** I can re-skin the shell by eye and know the text stays readable.

## Where the rules come from

PRD R5 (colour picker with contrast readout) and R7 (light and dark edited separately and
clearly labelled). The contrast pairs are the ones `tokens.css` already records in its
comments, such as "13.3:1 on paper".

## Acceptance criteria

### Light and dark

1. The Workbench has a Light and Dark switch. It sets the canvas's theme, and the inspector
   says which mode is being edited.
2. A value whose baseline differs between the modes is saved for the mode on show only. The
   other mode's value does not change.
3. A value that is the same in both modes, such as the corner radius or a padding, is saved
   once and is labelled as applying to both.

### Colours

4. A Colours section in the inspector lists the Template's named colours, each with a swatch,
   its name and its value in the mode on show.
5. Clicking a swatch opens a colour picker. The canvas updates live while a colour is being
   chosen. Closing the picker saves; Escape restores the colour from before.
6. Each colour also has a hex field. Input that is not a hex colour is rejected and the last
   good value stays.
7. Each text colour shows its contrast ratio against the surfaces it sits on. A ratio under
   4.5:1 is flagged.
8. Reset on a colour removes it from the override file and the baseline colour returns.
9. An imported shadcn component in a story changes with the colour it maps to.

### Everywhere

10. Undo and redo step through colour changes like any other.
11. After a change, `git status` shows only the override file as modified.
12. None of this exists in a production build.

## Not in this story

- Colours with transparency or `color-mix`, such as `--rule` and `--hairline`. They are shown
  read-only.
- A colour for one element. Colours are changed by name, for everything that uses the name.
- Palettes and presets (PRD R16), an OKLCH picker, an eyedropper on the canvas.
