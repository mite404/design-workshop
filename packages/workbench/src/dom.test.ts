import { expect, test } from "vitest";
import { canvasPath } from "./dom";

test("canvas path accepts app routes and defaults unsafe or recursive targets to root", () => {
  expect(canvasPath("")).toBe("/");
  expect(canvasPath("?path=%2Ft%2Fdemo-brief%3Fmode%3Dcomponent%23card")).toBe(
    "/t/demo-brief?mode=component#card",
  );
  for (const path of [
    "//evil.test",
    "https://evil.test",
    "javascript:alert(1)",
    "relative",
    "/\\evil.test",
    "/__workbench/",
    "/a/../__workbench",
    "/%5f_workbench/",
    "/%2fexample.test",
    "/%",
    "/\n/evil.test",
  ]) {
    expect(canvasPath(`?path=${encodeURIComponent(path)}`)).toBe("/");
  }
});
