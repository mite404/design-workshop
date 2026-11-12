// oxlint-disable no-await-in-loop, no-console -- a lever drives one step at a time and reports on stdout
// The type lever (ETH-105): drives the Workbench at /__workbench/ in headless Chromium through the
// first heading of the scripted demo brief: select it, pick a larger step, type 15, pick Bold
// Italic, set letter spacing to -0.5, press Up twice in line height, align centre, align a taller
// block to the bottom, then reset each. Then the font picker (ETH-106), with no network: open it,
// type "news", move to Newsreader Variable and back out with Escape, pick it, reset it, and see
// the missing font warning for a made-up family. Then the Basics popover (ETH-107) on a paragraph:
// justify, underline, small caps then upper case, cap height trim, bulleted, and paragraph spacing
// up three times, each reset after; and numbered on a list item saves its markers alone. Each step checks the computed style, the control
// and the override file. Screenshots go to .artifacts/type/. Exits 1 when any step fails. It
// writes the real override file and leaves it empty, so start from an empty one.
//
//   node apps/web/scripts/type-check.mjs [--base http://localhost:5173] [--out dir]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { arg, launch, report, ROOT, workbenchPage } from "./harness.mjs";

const base = arg("--base", "http://localhost:5173");
const out = arg("--out", path.join(ROOT, ".artifacts/type"));
const OVERRIDES = path.join(ROOT, "packages/catalog/src/overrides.css");
const EMPTY =
  "/* Written by the Workbench. One design value per line. Do not edit by hand. */\n:root {\n}\n";
mkdirSync(out, { recursive: true });
assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "the override file starts empty");
const sorted = (list) => list.toSorted((a, b) => a.localeCompare(b));
const changed = () =>
  sorted(
    execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
      .map((l) => l.slice(3)),
  );
const before = changed();

const browser = await launch();
const { context, page, errors } = await workbenchPage(browser);
await context.route(/api\.fontsource\.org|cdn\.jsdelivr\.net/, (route) => route.abort());
const frame = page.frameLocator("iframe");
const heading = frame.locator("h2").first();
const panel = page.locator("details[aria-label=Typography]");
const control = (id) => page.locator(`#wb-${id}`);
let subject = heading; // the element the checks read
const css = (name) => subject.evaluate((el, n) => getComputedStyle(el).getPropertyValue(n), name);
let sel = "";
const file = (decls) =>
  decls.length === 0 ? EMPTY : `${EMPTY}${sel} {\n${decls.map((d) => `  ${d};\n`).join("")}}\n`;

const selects = async (locator) => {
  const text = (await page.locator(".selector").textContent()) ?? "";
  return locator.evaluate(
    (el, s) => s !== "" && el.ownerDocument.querySelectorAll(s)[0] === el,
    text,
  );
};
// Clicks 30px in from the left at mid height: on a 24px tall element the padding handles cover
// its centre and left edge, and a click on one opens its field instead of selecting deeper.
const select = async (locator) => {
  for (let i = 0; i < 40 && !(await selects(locator)); i++) {
    const b = await locator.boundingBox();
    await page.mouse.click(b.x + 30, b.y + b.height / 2);
    await page.waitForTimeout(35);
  }
  assert.ok(await selects(locator), "clicks select the heading");
};

// The file holds `decls`, the heading has no inline value left, and its computed `name` is
// `value` from the file.
async function expectType(decls, name, value) {
  for (let i = 0; i < 50 && readFileSync(OVERRIDES, "utf8") !== file(decls); i++) {
    await page.waitForTimeout(100);
  }
  const note = await page.locator(".message").textContent();
  assert.equal(readFileSync(OVERRIDES, "utf8"), file(decls), `override file ${note}`);
  await subject.evaluate(async (el) => {
    for (let i = 0; i < 100 && el.getAttribute("style"); i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  assert.equal((await subject.getAttribute("style")) ?? "", "", "no inline value left behind");
  for (let i = 0; i < 50 && (await css(name)) !== value; i++) await page.waitForTimeout(100);
  assert.equal(await css(name), value, `computed ${name} from the file`);
}
const expectControl = (id, want) =>
  page.waitForFunction(([i, w]) => document.querySelector(`#wb-${i}`)?.value === w, [id, want], {
    timeout: 5000,
  });

const results = [];
const step = async (name, run) => {
  try {
    await run();
    results.push({ name, ok: true, detail: "" });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
};

await step("the demo brief's first heading is selected and the section shows it", async () => {
  await page.goto(`${base}/__workbench/`);
  await frame.locator("[data-slot=window]").waitFor({ timeout: 30_000 });
  await page.locator(".tool").click();
  await page.frames()[1].goto(`${base}/t/demo-brief`);
  await heading.waitFor({ timeout: 30_000 });
  await heading.scrollIntoViewIfNeeded();
  await page.locator(".tool").click();
  await select(heading.locator(".."));
  await panel.waitFor({ state: "hidden" });
  await select(heading);
  sel = (await page.locator(".selector").textContent()) ?? "";
  await panel.waitFor();
  assert.equal(await page.locator(".type-family").textContent(), "Inter Variable");
  await expectControl("font-size", "14");
  assert.equal(await page.locator("#wb-font-size + .unit").textContent(), "sm");
  assert.equal(await control("style").inputValue(), "550");
  assert.equal(await control("style").locator("option").first().textContent(), "550");
  assert.ok((await control("style").locator("option").allTextContents()).includes("Bold Italic"));
  assert.equal(await control("line-height").inputValue(), "20"); // 14px × 1.3 (ETH-109)
  assert.equal(await control("letter-spacing").inputValue(), "-1.4");
  assert.equal(
    await panel.locator("[aria-label='Align left']").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".type-align").nth(1).isHidden(), true, "one line, no vertical");
  await page.screenshot({ path: `${out}/01-heading-selected.png` });
});

await step("Up in Size moves one step live; the list picks a larger step", async () => {
  await control("font-size").focus();
  await page.keyboard.press("ArrowUp");
  assert.equal(await css("font-size"), "16px", "live during the change");
  await page.keyboard.press("Escape");
  assert.equal(await css("font-size"), "14px", "Escape puts it back");
  await page.getByRole("button", { name: "Size steps" }).click();
  await page.locator("#wb-steps").waitFor();
  assert.equal(
    await page.locator("#wb-steps [aria-selected=true] span").first().textContent(),
    "sm",
  );
  assert.equal(await page.locator("#wb-steps [data-step=lg] .unit").textContent(), "20");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/02-size-list.png` });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expectType(["font-size: var(--text-lg)"], "font-size", "20px");
  await expectControl("font-size", "20");
  assert.equal(await page.locator("#wb-font-size + .unit").textContent(), "lg");
  assert.deepEqual(
    changed(),
    sorted([...new Set([...before, "packages/catalog/src/overrides.css"])]),
  );
});

await step("typing 15 saves pixels and marks the size off the scale", async () => {
  await control("font-size").fill("15");
  await control("font-size").press("Enter");
  await expectType(["font-size: 15px"], "font-size", "15px");
  const mark = page.locator("#wb-font-size + .unit");
  assert.equal(await mark.textContent(), "off");
  assert.equal(await control("font-size").inputValue(), "15");
  assert.equal(await mark.getAttribute("data-off"), "true");
  await page.screenshot({ path: `${out}/03-off-scale.png` });
});

await step("Bold Italic sets weight and italic together", async () => {
  await control("style").selectOption({ label: "Bold Italic" });
  await expectType(
    ["font-size: 15px", "font-weight: 700", "font-style: italic"],
    "font-weight",
    "700",
  );
  assert.equal(await css("font-style"), "italic");
  assert.equal(await control("style").inputValue(), "700i");
});

await step("letter spacing -0.5 saves -0.005em", async () => {
  await control("letter-spacing").fill("-0.5");
  await control("letter-spacing").press("Enter");
  const decls = [
    "font-size: 15px",
    "font-weight: 700",
    "font-style: italic",
    "letter-spacing: -0.005em",
  ];
  await expectType(decls, "letter-spacing", "-0.075px");
  await expectControl("letter-spacing", "-0.5");
});

await step("Up twice in line height moves 20 to 28", async () => {
  await control("line-height").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  assert.equal(await css("line-height"), "28px", "live during the change");
  await page.keyboard.press("Enter");
  const decls = [
    "font-size: 15px",
    "font-weight: 700",
    "font-style: italic",
    "letter-spacing: -0.005em",
    "line-height: 28px",
  ];
  await expectType(decls, "line-height", "28px");
  await expectControl("line-height", "28");
});

const story = [
  "font-size: 15px",
  "font-weight: 700",
  "font-style: italic",
  "letter-spacing: -0.005em",
  "line-height: 28px",
  "text-align: center",
];

await step("align centre", async () => {
  await page.getByRole("button", { name: "Align center" }).click();
  await expectType(story, "text-align", "center");
  assert.equal(
    await page.getByRole("button", { name: "Align center" }).getAttribute("aria-pressed"),
    "true",
  );
});

await step("a block taller than its text aligns to the bottom", async () => {
  await heading.evaluate((el) => (el.style.minHeight = "80px"));
  const bottom = page.getByRole("button", { name: "Align bottom" });
  await bottom.waitFor();
  const top = await heading.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().top - el.getBoundingClientRect().top;
  });
  await bottom.click();
  for (let i = 0; i < 50 && !readFileSync(OVERRIDES, "utf8").includes("align-content"); i++) {
    await page.waitForTimeout(100);
  }
  assert.ok(readFileSync(OVERRIDES, "utf8").includes("  align-content: end;\n"));
  assert.equal(await css("align-content"), "end");
  const moved = await heading.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().top - el.getBoundingClientRect().top;
  });
  assert.ok(moved > top + 40, `the text moved down: ${top} → ${moved}`);
  await page.getByRole("button", { name: "Reset vertical alignment" }).click();
  await heading.evaluate((el) => el.style.removeProperty("min-height"));
  await expectType(story, "align-content", "normal");
  await page.locator(".type-align").nth(1).waitFor({ state: "hidden" });
});

await step("each reset removes its value and the heading's own value returns", async () => {
  const resets = [
    ["horizontal alignment", "text-align", "start"],
    ["line height", "line-height", "20px"],
    ["letter spacing", "letter-spacing", "-0.2px"],
    ["style", "font-weight", "550"],
    ["size", "font-size", "14px"],
  ];
  let left = story;
  for (const [label, name, value] of resets) {
    await page.getByRole("button", { name: `Reset ${label}` }).click();
    left = left.filter(
      (d) => !d.startsWith(name) && !(label === "style" && d.startsWith("font-style")),
    );
    await expectType(left, name, value);
  }
  assert.equal(await css("font-style"), "normal");
  await expectControl("font-size", "14");
  assert.equal(await page.locator("#wb-font-size + .unit").textContent(), "sm");
  assert.equal(await control("style").inputValue(), "550");
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY);
});

await step("a type value in the element's own style is read-only", async () => {
  await heading.evaluate((el) => el.style.setProperty("font-size", "18px"));
  await page.keyboard.press("Escape");
  await page.locator("details[aria-label=Typography]:not([hidden])").waitFor({ state: "detached" });
  await select(heading);
  await page.waitForFunction(() => document.querySelector("#wb-font-size").readOnly);
  await page.getByRole("button", { name: "Size steps", disabled: true }).waitFor();
  assert.equal(await panel.locator(".type-note").isVisible(), true);
  await heading.evaluate((el) => el.style.removeProperty("font-size"));
});

const family = page.locator(".type-family");
const picker = page.locator("#wb-fonts");
const search = page.getByRole("combobox", { name: "Search fonts" });
const openPicker = async () => {
  await page.getByRole("button", { name: /^Font family/ }).click();
  await picker.waitFor();
  await page.waitForFunction(() => document.activeElement?.ariaLabel === "Search fonts", null, {
    timeout: 5000,
  });
};
// Offline there is no Google category to say Newsreader is a serif, so it falls back to sans-serif.
const NEWS = '"Newsreader Variable", sans-serif';
const settled = (want) =>
  page.waitForFunction(
    ([w]) =>
      getComputedStyle(document.querySelector("iframe").contentDocument.querySelector("h2"))
        .fontFamily === w,
    [want],
    { timeout: 5000 },
  );

await step("the family row opens the font picker with its three groups", async () => {
  await page.keyboard.press("Escape");
  await select(heading);
  await openPicker();
  const groups = await picker.getByRole("group").evaluateAll((els) => els.map((e) => e.ariaLabel));
  assert.deepEqual(groups, ["In this mockup", "Google", "Installed"]);
  const mockup = await picker
    .getByRole("group", { name: "In this mockup" })
    .getByRole("option")
    .allTextContents();
  assert.deepEqual(mockup, ["Inter Variable", "Newsreader Variable"]);
  await picker.getByText(/Google fonts could not be listed/).waitFor();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/11-font-picker.png` });
});

await step("typing narrows the list; moving previews; Escape puts the font back", async () => {
  const own = await css("font-family");
  await search.pressSequentially("news");
  assert.deepEqual(await picker.getByRole("option").filter({ visible: true }).allTextContents(), [
    "Newsreader Variable",
  ]);
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await picker.getByRole("option", { name: "Newsreader Variable" }).getAttribute("aria-selected"),
    "true",
  );
  assert.equal(await css("font-family"), own, "no preview before the move settles");
  await settled(NEWS);
  await page.screenshot({ path: `${out}/12-font-search.png` });
  await page.keyboard.press("Escape");
  await picker.waitFor({ state: "hidden" });
  await settled(own);
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY, "nothing saved");
});

await step("Enter picks the font and saves it; the styles follow it", async () => {
  await openPicker();
  await search.pressSequentially("news");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expectType([`font-family: ${NEWS}`], "font-family", NEWS);
  assert.equal(await family.textContent(), "Newsreader Variable");
  const styles = await control("style").locator("option").allTextContents();
  assert.ok(styles.includes("ExtraLight") && !styles.includes("Thin"), styles.join());
  assert.deepEqual(
    changed(),
    sorted([...new Set([...before, "packages/catalog/src/overrides.css"])]),
  );
});

await step("reset puts the heading's own font back", async () => {
  await page.getByRole("button", { name: "Reset font family" }).click();
  await expectType([], "font-family", '"Inter Variable", Inter, Helvetica, Arial, sans-serif');
  assert.equal(await family.textContent(), "Inter Variable");
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY);
});

// A failed copy, refused by the dev server or lost on the network, leaves no preview face behind:
// Lora stays a Google font, the heading its own, and the repo unchanged.
const failures = {
  refused: (route) => route.fulfill({ status: 502, json: { error: "stubbed refusal" } }),
  lost: (route) => route.abort(),
};
for (const how of Object.keys(failures)) {
  const fail = failures[how];
  await step(`a ${how} Google font copy leaves no preview face and saves nothing`, async () => {
    const google = [
      {
        id: "lora",
        family: "Lora",
        category: "serif",
        variable: true,
        weights: [400, 700],
        styles: ["normal", "italic"],
        defSubset: "latin",
      },
    ];
    await page.route(/api\.fontsource\.org\/v1\/fonts\?type=google/, (r) =>
      r.fulfill({ json: google }),
    );
    await page.route("**/__workbench/fonts", fail);
    const own = await css("font-family");
    await page.evaluate(() => location.reload()); // a fresh page fetches the stubbed list
    await frame.locator("[data-slot=window]").waitFor({ timeout: 30_000 });
    await page.locator(".tool").click();
    await page.frames()[1].goto(`${base}/t/demo-brief`);
    await heading.waitFor({ timeout: 30_000 });
    await heading.scrollIntoViewIfNeeded();
    await page.locator(".tool").click();
    await select(heading);
    await openPicker();
    await search.pressSequentially("lora");
    await picker
      .getByRole("group", { name: "Google" })
      .getByRole("option", { name: "Lora" })
      .waitFor();
    await page.keyboard.press("ArrowDown");
    await settled("Lora, serif");
    await page.keyboard.press("Enter");
    await page.locator(".message").filter({ hasText: "Not saved" }).waitFor();
    await settled(own);
    const lora = () =>
      heading.evaluate(
        (el) => [...el.ownerDocument.fonts].filter((f) => f.family === "Lora").length,
      );
    for (let i = 0; i < 50 && (await lora()) > 0; i++) await page.waitForTimeout(50);
    assert.equal(await lora(), 0, "no Lora face left in the frame");
    assert.equal((await heading.getAttribute("style")) ?? "", "");
    assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY);
    assert.deepEqual(changed(), before, "the repo is unchanged");
    await openPicker();
    await search.pressSequentially("lora");
    const group = await picker
      .getByRole("option", { name: "Lora", exact: true })
      .evaluate((el) => el.closest("[role=group]").ariaLabel);
    assert.equal(group, "Google", "Lora is still listed as a Google font");
    await page.keyboard.press("Escape");
    await page.unrouteAll();
  });
}

await step("a saved family that is nowhere shows the missing font warning", async () => {
  const warning = page.locator(".font-missing");
  assert.equal(await warning.isHidden(), true, "Inter is in the repo");
  const post = (value, was) =>
    page.evaluate(
      async ([selector, v, w]) =>
        (
          await fetch("/__workbench/values", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ selector, name: "font-family", value: v, was: w }),
          })
        ).status,
      [sel, value, was],
    );
  const made = '"Zzyzx Made Up", sans-serif';
  assert.equal(await post(made, null), 200);
  await warning.waitFor();
  assert.equal(
    await warning.getAttribute("title"),
    "Zzyzx Made Up is not in the repo or installed on this computer",
  );
  await page.screenshot({ path: `${out}/13-font-missing.png` });
  assert.equal(await post(null, made), 200);
  await warning.waitFor({ state: "hidden" });
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY);
});

const para = frame.locator("p", { hasText: "The backlog fell" });
const basics = page.locator("#wb-basics");
const inBasics = (name) => basics.getByRole("button", { name, exact: true });
const pressed = async (name) => (await inBasics(name).getAttribute("aria-pressed")) === "true";
const openBasics = async () => {
  if ((await basics.isVisible()) === true) return;
  await page.getByRole("button", { name: "Type settings" }).click();
  await basics.waitFor();
};
/** @type {string[]} */
let paraDecls = [];
const basicsStep = (name, decls, run, prop, value) =>
  step(name, async () => {
    await run();
    paraDecls = decls;
    await expectType(paraDecls, prop, value);
  });

await step("the settings button opens the Basics popover in Figma's order", async () => {
  await page.keyboard.press("Escape");
  subject = para;
  await para.scrollIntoViewIfNeeded();
  await select(para);
  sel = (await page.locator(".selector").textContent()) ?? "";
  await panel.waitFor();
  await openBasics();
  const rows = await basics.locator(".basics-row > span").allTextContents();
  assert.deepEqual(rows, [
    "Alignment",
    "Decoration",
    "Case",
    "Vertical trim",
    "List style",
    "Paragraph spacing",
  ]);
  assert.ok(await pressed("Align left"), "filled from the computed style");
  assert.ok(await pressed("No decoration"));
  assert.ok(await pressed("As typed"));
  assert.ok(await pressed("Standard"));
  assert.ok(await pressed("No list"));
  assert.equal(
    await page.getByRole("button", { name: "Type settings" }).getAttribute("aria-expanded"),
    "true",
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/14-basics.png` });
});

await basicsStep(
  "justify",
  ["text-align: justify"],
  () => inBasics("Justify").click(),
  "text-align",
  "justify",
);
await basicsStep(
  "underline",
  [...paraDecls, "text-decoration-line: underline"],
  () => inBasics("Underline").click(),
  "text-decoration-line",
  "underline",
);
await step(
  "small caps saves font-variant-caps alone; upper case puts it back to normal",
  async () => {
    await inBasics("Small caps").click();
    paraDecls = [...paraDecls, "font-variant-caps: small-caps"];
    await expectType(paraDecls, "font-variant-caps", "small-caps");
    assert.ok(await pressed("Small caps"));
    await inBasics("Upper case").click();
    paraDecls = [
      ...paraDecls.slice(0, -1),
      "font-variant-caps: normal",
      "text-transform: uppercase",
    ];
    await expectType(paraDecls, "text-transform", "uppercase");
    assert.equal(await css("font-variant-caps"), "normal");
    assert.ok(await pressed("Upper case"));
  },
);
// Chrome saves the shortest form of "trim-both cap alphabetic".
await basicsStep(
  "cap height to baseline trim",
  [...paraDecls, "text-box: cap alphabetic"],
  () => inBasics("Cap height to baseline").click(),
  "text-box",
  "cap alphabetic",
);
await step("bulleted makes a plain block one list item", async () => {
  await inBasics("Bulleted list").click();
  // A paragraph's list-style-type is already disc, so it is not saved again.
  paraDecls = [...paraDecls, "display: list-item", "list-style-position: inside"];
  await expectType(paraDecls, "display", "list-item");
  assert.equal(await css("list-style-type"), "disc");
  assert.equal(await css("list-style-position"), "inside");
  assert.ok(await pressed("Bulleted list"));
});
await step("Up three times in paragraph spacing adds 6px", async () => {
  const from = Number(String(await css("margin-bottom")).replace(/px$/, "")); // "16px" → 16
  await control("margin-bottom").focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
  assert.equal(await css("margin-bottom"), `${from + 6}px`, "live during the change");
  await page.keyboard.press("Enter");
  paraDecls = [...paraDecls, `margin-bottom: ${from + 6}px`];
  await expectType(paraDecls, "margin-bottom", `${from + 6}px`);
  await expectControl("margin-bottom", String(from + 6));
  await control("margin-bottom").focus(); // Enter left the field
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowDown"); // 22, 12, 2, 0
  assert.equal(await css("margin-bottom"), "0px", "never below 0");
  await page.keyboard.press("Escape");
  assert.equal(await css("margin-bottom"), `${from + 6}px`, "Escape puts it back");
  await openBasics();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/15-basics-applied.png` });
  await para.screenshot({ path: `${out}/16-paragraph-applied.png` });
  assert.deepEqual(
    changed(),
    sorted([...new Set([...before, "packages/catalog/src/overrides.css"])]),
  );
});
await step("Escape closes the popover, keeps the selection, and focus returns", async () => {
  await inBasics("Justify").focus();
  await page.keyboard.press("Escape");
  await basics.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.activeElement?.ariaLabel), "Type settings");
  assert.equal(await page.locator(".selector").textContent(), sel, "still the paragraph");
  await openBasics();
  await page.locator(".inspector .mode-note").first().click(); // outside the popover
  await basics.waitFor({ state: "hidden" });
  await openBasics();
  await control("margin-bottom").press("Enter"); // focus leaves for the page
  await page.keyboard.press("Escape");
  await basics.waitFor({ state: "hidden" });
  assert.equal(await page.locator(".selector").textContent(), sel, "Escape only closed it");
});

await step("each reset removes what its control wrote", async () => {
  await openBasics();
  // Each reset: what it removes, and a computed value that shows the paragraph's own returned.
  const resets = [
    { label: "alignment", names: ["text-align"], name: "text-align", value: "start" },
    {
      label: "decoration",
      names: ["text-decoration-line"],
      name: "text-decoration-line",
      value: "none",
    },
    {
      label: "case",
      names: ["text-transform", "font-variant-caps"],
      name: "text-transform",
      value: "none",
    },
    { label: "vertical trim", names: ["text-box"], name: "text-box", value: "normal" },
    {
      label: "list style",
      names: ["display", "list-style-type", "list-style-position"],
      name: "display",
      value: "block",
    },
    {
      label: "paragraph spacing",
      names: ["margin-bottom"],
      name: "list-style-type",
      value: "disc",
    },
  ];
  for (const { label, names, name, value } of resets) {
    await basics.getByRole("button", { name: `Reset ${label}` }).click();
    paraDecls = paraDecls.filter((d) => names.every((n) => !d.startsWith(`${n}:`)));
    await expectType(paraDecls, name, value);
  }
  assert.equal(readFileSync(OVERRIDES, "utf8"), EMPTY);
  assert.ok(await pressed("No list"));
});

await step("numbered on a list item saves list-style-type alone", async () => {
  await page.keyboard.press("Escape");
  const item = frame.locator("li", { hasText: "Access requests are few" });
  subject = item;
  await item.scrollIntoViewIfNeeded();
  await select(item);
  sel = (await page.locator(".selector").textContent()) ?? "";
  await openBasics();
  assert.ok(await pressed("Bulleted list"));
  await inBasics("Numbered list").click();
  await expectType(["list-style-type: decimal"], "list-style-type", "decimal");
  assert.equal(await css("display"), "list-item");
  await basics.getByRole("button", { name: "Reset list style" }).click();
  await expectType([], "list-style-type", "disc");
  assert.deepEqual(changed(), before, "the repo is unchanged");
});

await context.close();
await browser.close();
report(results, errors, out);
