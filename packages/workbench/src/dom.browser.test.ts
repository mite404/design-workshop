import { expect, test } from "vitest";
import { selectorOf } from "./dom";

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
