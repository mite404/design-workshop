import { expect, test } from "vitest";
import { parseMessages, storedRef } from "./chatStore";

const REF = {
  label: "button · Send",
  selector: "#send",
  preview: "Component · /",
  source: "",
  values: ["gap: 4px"],
};

test("a stored chat reads back, dropping what is not a message", () => {
  const good = { text: "Tighten it", refs: [REF] };
  const text = JSON.stringify([good, { text: 3, refs: [] }, { text: "x", refs: [{ label: "y" }] }]);
  expect(parseMessages(text)).toEqual([good]);
});

test("no chat, broken JSON or another shape is no messages", () => {
  for (const text of [null, "{", '{"text":"x"}']) expect(parseMessages(text)).toEqual([]);
});

test("a sent reference keeps its identity, not its element", () => {
  const chosen = { ...REF, node: { tagName: "BUTTON" } };
  expect(storedRef(chosen)).toEqual(REF);
});
