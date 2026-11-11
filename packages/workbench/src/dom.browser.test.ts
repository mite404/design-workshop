import { expect, test } from "vitest";
import { chain, selectorOf } from "./dom";

test("isolated stories keep a named viewport root selectable, but never the unnamed canvas", () => {
  const root = document.createElement("section");
  root.dataset.wb = "FullScreen";
  root.style.cssText = "position:fixed;inset:0;display:block";
  const child = document.createElement("p");
  child.textContent = "Story content";
  root.append(child);
  document.body.append(root);
  try {
    expect(chain(child)).not.toContain(root);
    expect(chain(child, true)).toEqual([root, child]);
    root.removeAttribute("data-wb");
    expect(chain(child, true)).toEqual([child]);
  } finally {
    root.remove();
  }
});

test("Live selectors keep their instance when another named component mounts", () => {
  const canvas = document.createElement("main");
  canvas.id = "live-selector-test";
  const component = document.createElement("section");
  component.dataset.wb = "Card";
  const paragraph = document.createElement("p");
  paragraph.textContent = "First instance";
  component.append(paragraph);
  canvas.append(component);
  document.body.append(canvas);
  try {
    const selectors = [selectorOf(component), selectorOf(paragraph)];
    canvas.insertAdjacentHTML(
      "beforeend",
      '<section data-wb="Card"><p>Second instance</p></section>',
    );
    expect(selectors.map((selector) => [...document.querySelectorAll(selector)])).toEqual([
      [component],
      [paragraph],
    ]);
    expect([selectorOf(component), selectorOf(paragraph)]).toEqual(selectors);
  } finally {
    canvas.remove();
  }
});

test("Component edits use the nearest name, ignore instance ids, and lose to Live overrides", () => {
  const canvas = document.createElement("main");
  canvas.id = "component-reach-test";
  canvas.innerHTML = `<section data-wb="Card"><p id="first-paragraph">First</p>
    <div data-wb="Inner"><b>Nested</b></div></section>
    <section data-wb="Card"><p>Second</p></section>`;
  document.body.append(canvas);
  const sheet = document.createElement("style");
  document.head.append(sheet);
  try {
    const first = canvas.querySelector("p");
    const second = canvas.querySelectorAll("p")[1];
    const nested = canvas.querySelector("b");
    if (first === null || second === undefined || nested === null)
      throw new Error("fixture missing");
    const shared = selectorOf(first, "component");
    expect(shared).toBe('[data-wb="Card"] > p:nth-child(1)');
    expect(selectorOf(nested, "component")).toBe('[data-wb="Inner"] > b:nth-child(1)');
    const live = selectorOf(first);
    for (const declarations of [
      `${live} { padding-left: 46px; } ${shared} { padding-left: 38px; }`,
      `${shared} { padding-left: 38px; } ${live} { padding-left: 46px; }`,
    ]) {
      sheet.textContent = declarations;
      expect(getComputedStyle(first).paddingLeft).toBe("46px");
      expect(getComputedStyle(second).paddingLeft).toBe("38px");
    }
  } finally {
    canvas.remove();
    sheet.remove();
  }
});
