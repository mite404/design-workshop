import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { readSources } from "./project.ts";

test("a data-wb name points at the line that declares it, from the repo root", async () => {
  const sources = await readSources();
  const file = "packages/catalog/src/ComposeBox.tsx";
  const lines = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8").split("\n");
  const line = lines.findIndex((text) => text.includes('data-wb="ComposeBox"')) + 1;
  expect(line).toBeGreaterThan(1);
  expect(sources.ComposeBox).toBe(`${file}:${line}`);
});
