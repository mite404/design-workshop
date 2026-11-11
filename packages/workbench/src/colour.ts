/** The two selectors isolate colour edits even when the baseline shares a colour. */
export const COLOUR_ROOT = {
  light: ':root[data-theme="light"]',
  dark: ':root[data-theme="dark"]',
};

/** Opaque six-digit sRGB, the native picker's lossless format. */
export const HEX = /^#[\da-f]{6}$/i;

// Each named colour's baseline expressions. Aliases and transparent mixes remain visible.
type Colour = { light: string; dark: string; editable: boolean };

function declarations(body: string): Record<string, string> {
  return Object.fromEntries(
    [...body.matchAll(/^\s*(--[\w-]+): ([^;]+);/gm)].flatMap((m) =>
      m[1] === undefined || m[2] === undefined ? [] : [[m[1], m[2]]],
    ),
  );
}

/** Reads root colours from the baseline; only names with a literal hex in either mode edit. */
export function colourTokens(css: string): Record<string, Colour> {
  const rules = [...css.matchAll(/^:root(?:\[data-theme="(dark)"\])? \{([^}]+)\}/gm)];
  const light = declarations(rules.find((m) => m[1] === undefined)?.[2] ?? "");
  const dark = { ...light, ...declarations(rules.find((m) => m[1] === "dark")?.[2] ?? "") };
  return Object.fromEntries(
    Object.entries(light)
      .filter(([, value]) => /^(#|rgba?\(|color-mix\(|var\(|white$|transparent$)/.test(value))
      .map(([name, value]) => [
        name,
        {
          light: value,
          dark: dark[name] ?? value,
          editable: HEX.test(value) || HEX.test(dark[name] ?? ""),
        },
      ]),
  );
}

function luminance(hex: string): number {
  const channel = (at: number) => {
    const n = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return channel(1) * 0.2126 + channel(3) * 0.7152 + channel(5) * 0.0722;
}

/** WCAG relative-luminance contrast ratio for two opaque six-digit sRGB colours. */
export function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Text roles and the surfaces they actually sit on, including aliases and derived colours. */
export const CONTRAST: Record<string, readonly string[]> = {
  "--ink": ["--paper", "--paper-deep", "--bg", "--compose-bg", "--control-bg"],
  "--soft-ink": ["--paper", "--paper-deep", "--compose-bg"],
  "--faint-ink": ["--paper", "--paper-deep"],
  "--on-blue": ["--blue"],
  "--olive": ["--paper"],
  "--on-accent": ["--olive", "--moss"],
  "--on-ink": ["--ink"],
  "--on-send": ["--send"],
  "--warn-ink": ["--warn-bg"],
  "--on-attention": ["--attention-bg"],
  "--on-attention-soft": ["--attention-bg"],
  "--attention-hover-ink": ["--attention-hover"],
  "--on-attention-inverse": ["--on-attention"],
  "--tile-ink": ["--tile-bg"],
  "--tile-muted": ["--tile-bg"],
  "--tile-field-placeholder": ["--tile-bg"],
  "--awaiting-label-ink": ["--awaiting-label-bg"],
  "--on-chrome": ["--chrome", "--chrome-hover"],
  "--on-chrome-soft": ["--chrome", "--chrome-hover"],
  "--on-chrome-painting-soft": ["--chrome-painting"],
  "--on-chrome-pill": ["--chrome-pill", "--chrome-pill-hover"],
  "--on-chrome-pill-soft": ["--chrome-pill", "--chrome-pill-hover"],
};
