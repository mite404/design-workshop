import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { readManifest, readSources } from "./project.ts";

test("a data-wb name points at the line that declares it, from the repo root", async () => {
  const sources = await readSources();
  const file = "packages/catalog/src/ComposeBox.tsx";
  const lines = readFileSync(new URL(`../../../${file}`, import.meta.url), "utf8").split("\n");
  const line = lines.findIndex((text) => text.includes('data-wb="ComposeBox"')) + 1;
  expect(line).toBeGreaterThan(1);
  expect(sources.ComposeBox).toBe(`${file}:${line}`);
});

test("a host root is read from its own config: its slots, no Storybook, full-screen", async () => {
  const root = mkdtempSync(join(tmpdir(), "workbench-host-"));
  try {
    mkdirSync(join(root, ".workbench"));
    mkdirSync(join(root, "app"));
    writeFileSync(
      join(root, ".workbench/config.json"),
      '{"format":"design-workshop/config","version":1,"sources":["app"],"storybook":null}',
    );
    writeFileSync(join(root, "app/Shell.tsx"), '<main data-slot="window" data-wb="Shell" />\n');
    const manifest = await readManifest(root);
    expect(manifest.shell).toBe("full-screen");
    expect(manifest.slots).toEqual(["window"]);
    expect(manifest.components).toEqual({ Shell: { stories: [] } });
    expect(await readSources(root)).toEqual({ Shell: "app/Shell.tsx:1" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a root whose config is refused is not read", async () => {
  const root = mkdtempSync(join(tmpdir(), "workbench-host-"));
  try {
    mkdirSync(join(root, ".workbench"));
    writeFileSync(join(root, ".workbench/config.json"), '{"format":"x"}');
    await expect(readManifest(root)).rejects.toThrow("format");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
