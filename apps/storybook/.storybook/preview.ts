/// <reference types="vite/client" />
import type { Decorator, Preview } from "@storybook/react-vite";
import { trackInputModality } from "@yaklabs/catalog/inputModality";
import fontsCss from "@yaklabs/catalog/fonts.css?inline";
import overridesCss from "../../../.workbench/overrides.css?inline";
import catalogCss from "@yaklabs/catalog/tokens.css?inline";
import appCss from "./app-cascade.css?inline";
import chartsCss from "./charts.css?inline";

trackInputModality();

// Dark mode is set on the root element, the way the app would (ADR-046).
const withTheme: Decorator = (Story, context) => {
  document.documentElement.dataset.theme = context.globals.theme === "dark" ? "dark" : "light";
  return Story();
};

// One stylesheet at a time, first in the head, where the tokens import always sat: the catalog's
// own CSS, or for a story that asks for `cascade: "app"` (the shadcn components in packages/ui)
// the web app's Tailwind cascade. Loading Tailwind for every story would restyle the catalog's,
// which the app draws in its own layer (ADR-082). Either way the override file comes last and
// outside every layer, as in the app, so a saved value reaches stories too (ADR-002).
// The app's layer order (apps/web/src/index.css), so the catalog's tokens outrank the theme
// Tailwind ships with bklit's chart utilities, as they do in the app.
const LAYERS = "@layer theme, base, catalog, components, utilities;";
const withCascade: Decorator = (Story, context) => {
  const css =
    (context.parameters.cascade === "app"
      ? appCss
      : `${LAYERS}@layer catalog {${catalogCss}}${chartsCss}`) +
    fontsCss +
    overridesCss;
  let sheet = document.querySelector<HTMLStyleElement>("style#cascade");
  if (sheet === null) {
    sheet = document.createElement("style");
    sheet.id = "cascade";
    document.head.prepend(sheet);
  }
  if (sheet.textContent !== css) sheet.textContent = css;
  return Story();
};

const preview: Preview = {
  parameters: {
    layout: "padded",
    // Any axe violation fails the story's test, locally and in CI.
    a11y: { test: "error" },
  },
  globalTypes: {
    theme: {
      description: "Light or dark mode",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withTheme, withCascade],
};

export default preview;
