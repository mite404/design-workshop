# Story: save, load and unload palettes and type pairings

Status: drafted Nov 12 2026 from PRD R16 and section 16, and the
[portability plan](../../research/project-portability-plan.md), decision 8.

A theme is the Workbench's own JSON file, `.workbench/themes/<name>.theme.json`. It names roles
(surfaces, ink, accent, hover and focus colours, light and dark, and the text and display fonts
and type scale), not the host's CSS variables. A palette is a theme with only colour roles; a
type pairing is one with only type roles. A role map turns roles into this Template's design
values; applying a theme never writes the app's code.

## 1. Save the current colours as a palette

**As** a designer who has tuned the colours,
**I want** to save them as a named palette,
**so that** I can return to them, or use them in another project, without redoing the work.

1. The Colours section has a Save as palette control that asks for a name.
2. The saved file holds every colour name with its current value, light and dark, and nothing
   else. Reading it back gives the same values.
3. A name that already exists is refused with a message, not overwritten.
4. Saving writes only that file; the override file and git are untouched.

## 2. Load and unload a palette

**As** a designer comparing looks,
**I want** to load a saved palette and take it off again,
**so that** I can try a palette without losing my other changes.

1. The Colours section lists saved palettes. Choosing one writes its values into the override
   file through the normal save path, and the canvas shows them at once.
2. Loading touches only colour values. Radius, spacing and type values stay as they were.
3. Unload removes the palette's names from the override file, so each colour returns to its
   baseline value.
4. A load or an unload is one step of undo.
5. Every control works from the keyboard (R11).

## 3. Save, load and unload a type pairing

**As** a designer choosing fonts,
**I want** to save a font pairing and swap between pairings,
**so that** I can try "font pairing 2" from the current state (PRD R16).

1. The Type section offers the same save, load and unload as palettes, for the five type
   values.
2. Loading a pairing leaves colours and every element-level type value untouched.
3. A pairing whose font is not in the repo or installed shows the existing missing-font
   warning.

## Not in this story

- Whole-project themes and starting a project from one. Those are project files (phase 3).
- Drafting a theme from a component elsewhere with an agent.
