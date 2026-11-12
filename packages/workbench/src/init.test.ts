import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { detect, inspect } from "./init";

const SHELL =
  '<div data-slot="window"><b data-slot="title-bar" /><nav data-slot="sidebar" /></div>';
const noStorybook = () => null;

test("an app-shell host that reads the side is asked it, defaulting to its Sidebar's side", () => {
  const found = detect(
    new Map([
      ["apps/web/src/shell/Shell.tsx", `${SHELL}<Sidebar collapsible side="right" />`],
      ["apps/web/src/shell/Shell.stories.tsx", '<i data-slot="ignored" />'],
      ["packages/ui/src/button.tsx", '<button data-slot="button" />'],
      ["apps/web/src/index.css", ':root[data-shell-side="right"] {}'],
      ["apps/storybook/.storybook/main.ts", ""],
      ["pnpm-lock.yaml", ""],
    ]),
    (dir) => (dir === "apps/storybook/.storybook" ? "10.6.0" : null),
  );
  expect(found).toEqual({
    config: {
      format: "design-workshop/config",
      version: 1,
      sources: ["apps/web/src", "packages/ui/src"],
      storybook: { configDir: "apps/storybook/.storybook" },
    },
    failures: [],
    shell: "app-shell",
    missingSlots: [],
    storybook: { configDir: "apps/storybook/.storybook", version: "10.6.0" },
    side: { asked: true, default: "right" },
    packageManager: "pnpm",
  });
});

test("some app-shell slots make a full-screen host, told what is missing, and not asked", () => {
  const found = detect(
    new Map([
      ["src/App.tsx", '<main data-slot="window" />'],
      ["src/app.css", "html { --shell-side: left; }"],
    ]),
    noStorybook,
  );
  expect(found.shell).toBe("full-screen");
  expect(found.missingSlots).toEqual(["title-bar", "sidebar"]);
  expect(found.side).toEqual({ asked: false, default: "left" });
});

test("a host with no declarations scans src and has no Storybook", () => {
  const found = detect(new Map([["src/main.tsx", "<App />"]]), noStorybook);
  expect(found.config.sources).toEqual(["src"]);
  expect(found.config.storybook).toBeNull();
  expect(found.missingSlots).toEqual([]);
  expect(found.packageManager).toBeNull();
});

test("a host with no source folder at all gives a config the check refuses", () => {
  const found = detect(new Map([["lib/x.ts", ""]]), noStorybook);
  expect(found.failures.map((f) => f.code)).toEqual(["bad-sources"]);
});

test("this repo's detected config is the one it commits", async () => {
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const found = await inspect(root);
  expect(found.config).toEqual(JSON.parse(readFileSync(`${root}.workbench/config.json`, "utf8")));
  expect(found.shell).toBe("app-shell");
  expect(found.storybook?.version).toBe("10.6.0");
  expect(found.side).toEqual({ asked: true, default: "left" });
});
