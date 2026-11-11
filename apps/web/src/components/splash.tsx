// The splash (ADR-113, ADR-136): the field's dots, a clearing of plain paper behind the words, a
// sheet of construction lines and Atlas with his globe ringing the words, all drawn in
// index.css. It is a picture only: hidden from the tree, and a press or a carried card goes
// through it to the ground. Bottom to top: the paper, the carry's lit fill (the open space's
// ::before), the dots, the lines, the clearing, Atlas, then the words and the button.

// Where the sheet is drawn, which names its two layers for the levers: the empty canvas's, and
// the Vitruvian look of a new thread's welcome (ADR-135).
const SLOTS = {
  canvas: { sheet: "canvas-splash", figure: "splash-drawing" },
  welcome: { sheet: "welcome-splash", figure: "welcome-figure" },
} as const;

/**
 * The picture behind an empty canvas's words, or behind a new thread's welcome in its Vitruvian
 * look: dots and construction lines on the surface, cleared to plain paper behind the words,
 * with Atlas over them, his globe ringing the words.
 */
export function SplashDrawing({ where = "canvas" }: { where?: keyof typeof SLOTS }) {
  const slots = SLOTS[where];
  return (
    <div data-slot={slots.sheet} aria-hidden="true" className="splash pointer-events-none">
      <div className="splash-dots" />
      <div className="splash-lines" />
      <div className="splash-clearing" />
      <div data-slot={slots.figure} className="splash-drawing" />
    </div>
  );
}
