# Interface Atlas

An interactive workbook for UI spacing, desktop composition, and design judgment.
Built with Bun, Vite, React, TypeScript, Tailwind CSS 4, and shadcn/ui.

## Run the workbook

Install dependencies, then start the development server:

```sh
bun install
bun run dev
```

Vite prints the local address. In an Amp orb, expose port 5173 through an Amp portal.

## Explore the examples

1. Open **Layouts** and enable **Column grid**.
2. Change 12 columns to 10. The dashboard cards change from 4/4/4 to 3/3/4 column spans.
3. Change the gutter and content padding separately. Watch their different effects.
4. Switch between the dashboard, list/detail, editor, and settings patterns.
5. Open **Components**. Test the form error, menu, empty state, and keyboard focus.
6. Open **Learning path**. Work through eight lessons and their practice exercises.
7. Open **Live mode**. Drag title-bar groups and side navigation/chat panels on an 8px grid
   without scaling their contents. Panel headers move on both axes; X/Y fields and arrow keys
   also work. Panel dimensions stay locked, and reset restores the starting composition.
   Compare corner radius, bar height, control size, and gaps independently. Arrow keys and a
   numeric field also move groups. Overlap feedback reports collisions between group boxes.

The examples use CSS pixels. The preview is a web simulation, not a native desktop window.
Static chrome illustrates composition; the lab controls and component examples are interactive.
Mock actions and lesson progress live in memory and reset on reload.
No backend or account is needed.
Fonts load from Google Fonts, with local sans-serif and monospace fallbacks.

## Verify the project

The browser tests start Vite automatically or reuse the server already running on port 5173:

```sh
bunx playwright install chromium
bun run test
bun run lint
bun run build
```

The browser tests check actual CSS geometry, layout switching, lesson feedback, and narrow reflow.
The axe checks scan all five sections for automated WCAG A/AA violations. Automated checks do not
replace keyboard, screen-reader, touch, or usability testing.

## Find the source of a decision

- `src/content.ts`: lessons, mock project data, spacing tokens, and layout rationale.
- `src/App.tsx`: workbook navigation, layout controls, spacing explorer, and CSS recipes.
- `src/MockWindow.tsx`: desktop shell and the four mock compositions.
- `src/LiveMode.tsx`: fixed-scale, grid-snapped title-bar composition sandbox.
- `src/LivePanels.tsx`: movable mock side navigation and chat panels with collision feedback.
- `src/Lessons.tsx`: interactive component examples, quizzes, and session progress.
- `src/index.css`: workbook styling, example measurements, and responsive arrangements.
- `src/components/ui/`: shadcn/ui components added through the official CLI.

Read [the learning log](docs/FOR_ETHAN.md) for the reasoning behind the architecture.

## Separate conventions from requirements

The 4px base, 8px rhythm, and 12-column grid are useful starting points, not universal laws.
Fixed navigation and resizable panels usually sit outside the content grid.
Native window chrome follows the host operating system's rules.

- [Fluent layout and spacing](https://fluent2.microsoft.design/layout)
- [Minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG enhanced target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
