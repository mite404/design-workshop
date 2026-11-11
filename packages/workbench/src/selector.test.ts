import { describe, expect, test } from "vitest";
import { isSelector, pick, selectorFor, type Step } from "./selector";

const step = (tag: string, index: number, attrs: Partial<Step> = {}): Step => ({
  tag,
  index,
  wb: null,
  id: null,
  ...attrs,
});
const BODY = step("body", 2);

describe("selectorFor", () => {
  test("a tagged element is its data-wb name, wherever it sits", () => {
    expect(selectorFor([step("section", 3, { wb: "brief-card" }), step("div", 1), BODY])).toBe(
      '[data-wb="brief-card"]',
    );
  });

  test("an untagged element is a path from body", () => {
    expect(selectorFor([step("header", 1), step("section", 3), step("div", 4), BODY])).toBe(
      "body > div:nth-child(4) > section:nth-child(3) > header:nth-child(1)",
    );
  });

  test("the path starts at the nearest tagged or id'd ancestor, data-wb first", () => {
    const card = step("section", 3, { wb: "card", id: "c1" });
    expect(selectorFor([step("p", 2), card, step("div", 4, { id: "main" }), BODY])).toBe(
      '[data-wb="card"] > p:nth-child(2)',
    );
    expect(selectorFor([step("p", 2), step("div", 4, { id: "main" }), BODY])).toBe(
      "#main > p:nth-child(2)",
    );
  });

  test("names that would not fit the grammar, such as React's ids, are passed over", () => {
    const steps = [step("p", 1, { id: ":r1:" }), step("div", 2, { wb: 'x"]{' }), BODY];
    expect(selectorFor(steps)).toBe("body > div:nth-child(2) > p:nth-child(1)");
  });

  test("every selector it makes passes the grammar", () => {
    const made = [
      selectorFor([step("svg", 1), step("div", 12, { id: "chart_2" }), BODY]),
      selectorFor([step("li", 1, { wb: "row-a" })]),
      selectorFor([BODY]),
    ];
    expect(made.filter((s) => !isSelector(s))).toEqual([]);
  });
});

describe("isSelector", () => {
  test.each([
    ["closes the block", "body {} * { color: red"],
    ["has a semicolon", "body > p:nth-child(1);"],
    ["has a comma", "body, p"],
    ["has an at-rule", "@media x"],
    ["has a backslash", '[data-wb="a\\"]'],
    ["has a comment", "body /* x */"],
    ["uses a class", "body > .card"],
    ["starts anywhere but an anchor", "div > p:nth-child(1)"],
    ["is :root", ":root"],
  ])("refuses a selector that %s", (_, text) => {
    expect(isSelector(text)).toBe(false);
  });
});

describe("pick", () => {
  const under = ["window", "body", "card", "header"];

  test("with nothing selected, a click selects the outermost element", () => {
    expect(pick(under, [])).toBe("window");
  });

  test("a click inside the selection selects one level deeper, and stops at the target", () => {
    expect(pick(under, ["window"])).toBe("body");
    expect(pick(under, ["window", "body", "card"])).toBe("header");
    expect(pick(under, under)).toBe("header");
  });

  test("a click outside the selection selects at the level it shares with it", () => {
    expect(pick(under, ["window", "body", "footer"])).toBe("card");
    expect(pick(under, ["sidebar"])).toBe("window");
  });

  test("a click on empty space selects nothing", () => {
    expect(pick([], ["window"])).toBeNull();
  });
});
