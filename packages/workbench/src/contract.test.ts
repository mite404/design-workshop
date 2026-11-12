import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { checkProject, manifestOf, validate } from "./contract";

const VALID = {
  format: "design-workshop/manifest",
  version: 1,
  storybook: { version: "10.6.0", indexVersion: 5 },
  shell: "app-shell",
  slots: ["window", "title-bar", "sidebar", "stage"],
  components: {
    ChatThreadPanel: { stories: ["thread-chat-thread-panel--standard"] },
    UserTurn: { stories: ["thread-turns--user"] },
    AgentTurn: { stories: ["thread-turns--agent"] },
    ComposeBox: { stories: ["thread-compose-box--empty"] },
  },
  surfaces: ["page", "thread", "compose"],
};
const codes = (change: object) =>
  validate(JSON.stringify({ ...VALID, ...change })).map((f) => `${f.code} ${f.path}`);

test("this Template's shape is accepted", () => {
  expect(validate(JSON.stringify(VALID))).toEqual([]);
});

test("each kind of breach fails with its own code and path", () => {
  expect(validate("{").map((f) => f.code)).toEqual(["not-json"]);
  expect(codes({ format: "x" })).toEqual(["bad-format format"]);
  // A newer patch release is still refused: the pin is exact (ADR-030).
  expect(codes({ storybook: { version: "10.6.7", indexVersion: 5 } })).toEqual([
    "storybook-version storybook/version",
  ]);
  expect(codes({ storybook: { version: "10.6.0", indexVersion: 4 } })).toEqual([
    "index-version storybook/indexVersion",
  ]);
  expect(codes({ shell: "kiosk" })).toEqual(["unknown-shell shell"]);
  expect(codes({ slots: ["window", "sidebar"] })).toEqual(["missing-slot slots/title-bar"]);
  const { ComposeBox: _, ...withoutCompose } = VALID.components;
  expect(codes({ components: withoutCompose })).toEqual([
    "missing-component components/ComposeBox",
    "surface-component surfaces/compose",
  ]);
  expect(codes({ components: { ...VALID.components, UserTurn: { stories: [] } } })).toEqual([
    "missing-story components/UserTurn/stories",
  ]);
  expect(codes({ surfaces: ["page", "dock"] })).toEqual(["unknown-surface surfaces/dock"]);
});

test("a full-screen project needs only the window", () => {
  expect(
    codes({ shell: "full-screen", slots: ["window"], components: {}, surfaces: ["page"] }),
  ).toEqual([]);
});

test("every failure is reported, sorted, the same on every run", () => {
  const broken = JSON.stringify({
    ...VALID,
    storybook: { version: "9.0.0", indexVersion: 5 },
    slots: [],
    surfaces: ["dock"],
  });
  const first = validate(broken);
  expect(first.map((f) => f.path)).toEqual([
    "slots/sidebar",
    "slots/title-bar",
    "slots/window",
    "storybook/version",
    "surfaces/dock",
  ]);
  expect(validate(broken)).toEqual(first);
});

test("the validator imports only its contract data: no network, no model (ADR-029)", () => {
  const source = readFileSync(new URL("contract.ts", import.meta.url), "utf8");
  expect([...source.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1])).toEqual([
    "./contract.json",
  ]);
});

test("manifestOf reads stories by declaring file and classifies the shell from its slots", () => {
  const index = {
    v: 5,
    entries: {
      "turns--user": { type: "story", componentPath: "../../packages/catalog/src/Turns.tsx" },
      "turns--docs": { type: "docs", componentPath: "../../packages/catalog/src/Turns.tsx" },
      "compose--empty": { type: "story", componentPath: "../../src/ComposeBox.tsx" },
      "other--x": { type: "story", componentPath: "../../src/NotComposeBox.tsx" },
    },
  };
  const names = new Map([
    ["UserTurn", "Turns.tsx"],
    ["AgentTurn", "Turns.tsx"],
    ["ComposeBox", "ComposeBox.tsx"],
  ]);
  const app = manifestOf({
    version: "10.6.0",
    index,
    slots: ["sidebar", "window", "title-bar"],
    names,
  });
  expect(app.shell).toBe("app-shell");
  expect(app.components).toEqual({
    AgentTurn: { stories: ["turns--user"] },
    ComposeBox: { stories: ["compose--empty"] },
    UserTurn: { stories: ["turns--user"] },
  });
  // ChatThreadPanel is absent, so the thread surface is not claimed.
  expect(app.surfaces).toEqual(["page", "compose"]);
  expect(manifestOf({ version: "10.6.0", index, slots: ["window", "sidebar"], names }).shell).toBe(
    "full-screen",
  );
});

const project = (change: object, manifest: object = {}) =>
  JSON.stringify({
    format: "design-workshop/project",
    version: 1,
    manifest: { ...VALID, ...manifest },
    overrides: { ":root": { "--window-radius": "20px" } },
    ...change,
  });
const failed = (text: string) =>
  checkProject(text).flatMap((i) =>
    i.failure === undefined ? [] : [`${i.failure.code} ${i.path}`],
  );

test("a project's checklist names every contract item and passes a valid file", () => {
  const items = checkProject(project({}));
  expect(items.every((i) => i.failure === undefined)).toBe(true);
  expect(items.map((i) => i.path)).toContain("components/ComposeBox");
  expect(items.map((i) => i.path)).toContain("slots/title-bar");
});

test("a project file is refused with each item's own code", () => {
  expect(failed("nope")).toEqual(["not-json "]);
  expect(failed(project({ format: "design-workshop/manifest" }))).toEqual(["bad-format format"]);
  expect(failed(project({}, { storybook: { version: "10.6.7", indexVersion: 5 } }))).toEqual([
    "storybook-version storybook/version",
  ]);
  expect(failed(project({}, { slots: ["window", "sidebar"] }))).toEqual([
    "missing-slot slots/title-bar",
  ]);
  expect(
    failed(project({}, { components: { ...VALID.components, UserTurn: { stories: [] } } })),
  ).toEqual(["missing-story components/UserTurn"]);
  expect(failed(project({ overrides: { ":root": { "--x": 3 } } }))).toEqual([
    "bad-overrides overrides",
  ]);
  const text = project({}, { surfaces: ["dock"] });
  expect(failed(text)).toEqual(["unknown-surface surfaces/dock"]);
  expect(checkProject(text)).toEqual(checkProject(text));
});
