import { expect, test } from "vitest";
import { componentTree } from "./tree";

test("keeps named instances in DOM order and nesting, without the drawer", () => {
  const root = document.createElement("main");
  root.innerHTML = `<section data-wb="Card" data-slot="card">
    <div><header data-slot="heading"><h2 data-wb="Heading"></h2></header></div>
    <aside id="drawer"><div data-wb="Tree"></div></aside>
  </section><div><section data-wb="Card"></section></div>
  <div data-retain inert><section data-wb="Offscreen"></section></div>`;
  document.body.append(root);
  try {
    const [first, second] = root.querySelectorAll("section");
    const heading = root.querySelector("h2");
    expect(componentTree(root, root.querySelector("aside"))).toEqual([
      {
        element: first,
        name: "Card",
        children: [{ element: heading, name: "Heading", children: [] }],
      },
      { element: second, name: "Card", children: [] },
    ]);
    root.setAttribute("data-slot", "canvas");
    expect(componentTree(root, root)).toEqual([]);
    expect(componentTree(root)[0]?.name).toBe("Card");
    root.setAttribute("data-wb", "Canvas");
    expect(componentTree(root)[0]?.name).toBe("Canvas");
  } finally {
    root.remove();
  }
});

test("lists rendered components, including those below the fold, but not hidden states", () => {
  const root = document.createElement("main");
  root.innerHTML = `<section data-wb="Visible">Shown</section>
    <section hidden data-wb="Hidden">Hidden attribute</section>
    <div style="display:none"><section data-wb="UnmountedView">Hidden parent</section></div>
    <section style="visibility:hidden" data-wb="Invisible">Invisible</section>
    <section style="opacity:0" data-wb="Transparent">Transparent</section>
    <div style="content-visibility:hidden"><section data-wb="Skipped">Skipped contents</section></div>
    <section style="margin-top:200vh" data-wb="BelowFold">Scroll to me</section>`;
  document.body.append(root);
  try {
    expect(componentTree(root).map((node) => node.name)).toEqual(["Visible", "BelowFold"]);
  } finally {
    root.remove();
  }
});
