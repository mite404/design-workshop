import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { checkConfig } from "./config";

const VALID = {
  format: "design-workshop/config",
  version: 1,
  sources: ["src", "packages/ui/src"],
  storybook: { configDir: ".storybook" },
};
const codes = (change: object, exists?: (path: string, kind: string) => boolean) =>
  checkConfig(JSON.stringify({ ...VALID, ...change }), exists).map((f) => `${f.code} ${f.path}`);

test("this repo's own config is accepted", () => {
  const text = readFileSync(new URL("../../../.workbench/config.json", import.meta.url), "utf8");
  expect(checkConfig(text)).toEqual([]);
});

test("a host without Storybook is a valid config", () => {
  expect(codes({ storybook: null })).toEqual([]);
});

test("each kind of breach fails with its own code and path", () => {
  expect(checkConfig("{").map((f) => f.code)).toEqual(["not-json"]);
  expect(codes({ version: 2 })).toEqual(["bad-format format"]);
  expect(codes({ shell: "app-shell" })).toEqual(["unknown-field shell"]);
  expect(codes({ sources: [] })).toEqual(["bad-sources sources"]);
  expect(codes({ sources: "src" })).toEqual(["bad-sources sources"]);
  expect(codes({ storybook: { configDir: ".storybook", port: 6006 } })).toEqual([
    "bad-storybook storybook",
  ]);
});

const onlySrc = (path: string, kind: string) => kind === "folder" && path === "src";

test("tokens is an optional file inside the root", () => {
  expect(codes({ tokens: "src/tokens.css" })).toEqual([]);
  expect(codes({ tokens: "../tokens.css" })).toEqual(["bad-tokens tokens"]);
  expect(codes({ tokens: "src", storybook: null, sources: ["src"] }, onlySrc)).toEqual([
    "missing-file tokens",
  ]);
});

test("folders must stay inside the root", () => {
  for (const escape of ["/etc", "../other", "src/../../x", "C:/x", "src\\ui", ""])
    expect(codes({ sources: ["src", escape] })).toEqual(["bad-source sources/1"]);
  expect(codes({ storybook: { configDir: "../.storybook" } })).toEqual([
    "bad-storybook storybook/configDir",
  ]);
});

const exists = (path: string) => path === "src";

test("a folder that is not there is named, and failures sort by path the same way twice", () => {
  const text = JSON.stringify({ ...VALID, extra: 1, sources: ["lib", "src", "/x"] });
  const first = checkConfig(text, exists).map((f) => `${f.code} ${f.path}`);
  expect(first).toEqual([
    "unknown-field extra",
    "missing-folder sources/0",
    "bad-source sources/2",
    "missing-folder storybook/configDir",
  ]);
  expect(checkConfig(text, exists).map((f) => `${f.code} ${f.path}`)).toEqual(first);
});

test("roles name known roles with variables; colour selectors are one rule each", () => {
  expect(
    codes({ roles: { page: "--background" }, colourSelectors: { light: ":root", dark: ".dark" } }),
  ).toEqual([]);
  expect(codes({ roles: { pgae: "--background", ink: "background" } })).toEqual([
    "bad-role roles/ink",
    "bad-role roles/pgae",
  ]);
  expect(codes({ colourSelectors: { light: ":root", dark: ".dark } :root {" } })).toEqual([
    "bad-colour-selectors colourSelectors",
  ]);
});
