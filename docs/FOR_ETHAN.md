# Interface Atlas: the learning log

## The story so far

Interface Atlas is a working reference you can take apart. Four desktop compositions share a
mock creative-studio dataset. The workbook puts a measurement inspector beside them, so you can
change a value and see its effect rather than memorize a diagram.

Eight lessons move from proximity and hierarchy to density, interaction states, responsive
composition, tokens, and senior design judgment. They introduce the vocabulary. Real seniority
still requires testing designs with people and learning from the results.

## Cast & crew: architecture

`content.ts` is the script: lesson text, project fixtures, spacing examples, and pattern rationale.
`App.tsx` is the director's desk: it holds the selected pattern and measurement controls.
`MockWindow.tsx` is the set: it renders those measurements as actual CSS values.
`Lessons.tsx` runs the exercises and interactive component states.

The inspector sends numbers directly into the preview. The same column count and gutter reach
both the cards and the overlay. This prevents the measurement drawing from claiming a geometry
that the cards do not use.

The shadcn/ui files own buttons, switches, inputs, badges, and tabs. Radix supplies the underlying
switch and tab interaction semantics. The workbook's CSS supplies the visual treatment.

## Behind the scenes: decisions

Two structures were compared: a lesson-led persistent editor and a canvas-led pattern workbook.
The independent comparison preferred the canvas-led option because spacing relationships remain
visible while you experiment. We kept the lesson-led candidate's progressive teaching sequence.

We dropped both candidates' generalized layout-tree editors. Four typed React examples need no
node registry, generic inspector schema, undo history, or plugin API. The smaller model leaves
the geometry visible in the code you will remix.

The visual direction combines off-white paper, neutral structural diagrams, and a rust action color.
Ethan preferred off-white to the initial sage tint.
Green now marks functional status, not the theme.
The darker technical-studio alternative would have introduced another theme to explain without
helping the first lesson: how spacing groups content.

The shell and grid have different jobs. In film terms, a studio wall should not move whenever
the camera reframes a shot. Navigation stays bounded while content columns divide the remaining
space. Twelve columns divide evenly into halves, thirds, quarters, and sixths. Ten works well
for halves and fifths. Neither is a universal desktop standard.

## Bloopers: bugs & fixes

The first tests failed because the controls did not exist yet. After implementation, browser
tests found ambiguous accessible names: a select's enclosing label included its options, and
quiz answers included their letter markers. Explicit accessible names corrected both.

The first muted palette looked calm but failed contrast checks. A shared secondary-text token
replaced the faint foreground colors. Calm design still needs readable text.

The first root font size was 14px. That made a Tailwind `h-9` button 31.5px tall, although the
lesson called it 36px. Restoring the 16px root made rem-based component dimensions match the
CSS-pixel measurements in the lessons. A pretty label is not a measurement.

## Director's commentary

Start with relationships: a small gap joins items, a larger gap separates groups. Then choose
the numbers. A spacing scale is useful because it makes repeated decisions consistent, not
because every visible edge must land on an eight-pixel multiple.

The browser tests inspect computed padding, gutters, and row heights. A test that checked only
the inspector text would miss a broken connection to the preview.

Keep the difference between a sample and a standard explicit. The title bar is 36px in this
web example. A native title bar follows its operating system. Likewise, 44px is not the WCAG
AA minimum target-size rule: WCAG 2.2 AA generally uses 24 CSS pixels with exceptions, while
44 CSS pixels belongs to the enhanced AAA criterion, also with exceptions.

For your next remix, write down what stays fixed, what stretches, what scrolls, and what collapses.
Then test the smallest useful window, long labels, keyboard navigation, and 200% zoom.

### Live mode: move the set, not every prop

The title-bar sandbox keeps three groups on an 800px artboard. Dragging changes horizontal
position in 8px steps, while vertical centering, icon size, and internal spacing stay intact.
Keyboard arrows and a numeric position field provide alternatives to dragging.

Corner radius shapes the window silhouette. It does not determine title-bar height or button size.
With an 80px bar and 36px control boxes, centered controls leave 22px above and below.
Reducing the bar to 56px leaves 10px. Adjust that relationship before resizing every icon.
Traffic-light marks remain 12px; their larger containing group is a separate measurement.

We deliberately allow groups to overlap so the learner can see the problem and its measured gap.
The warning compares group rectangles, not appearances. This is a title-bar composition exercise,
not a general page editor or a native macOS implementation. The content below demonstrates why
a fixed sidebar and a 12-column content grid need not share the title bar's positioning system.
