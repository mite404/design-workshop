import { expect, test } from "vitest";
import { storyTree } from "./tree";

test("keeps story titles, labels and index order without documentation branches", () => {
  expect(
    storyTree({
      entries: {
        docs: { type: "docs", id: "guide--docs", title: "Guide/Intro", name: "Docs" },
        busy: { type: "story", id: "motion-agent--busy", title: "Motion/Agent", name: "Working" },
        plain: { type: "story", id: "button--plain", title: "Button", name: "Plain" },
        text: { type: "story", id: "forms-field--text", title: "Forms/Field", name: "Text input" },
        idle: { type: "story", id: "motion-agent--idle", title: "Motion/Agent", name: "Idle" },
        deep: {
          type: "story",
          id: "motion-more-agent--idle",
          title: "Motion/More/Agent",
          name: "Idle",
        },
      },
    }),
  ).toEqual([
    {
      kind: "branch",
      name: "Motion",
      children: [
        {
          kind: "branch",
          name: "Agent",
          children: [
            { kind: "story", id: "motion-agent--busy", name: "Working" },
            { kind: "story", id: "motion-agent--idle", name: "Idle" },
          ],
        },
        {
          kind: "branch",
          name: "More",
          children: [
            {
              kind: "branch",
              name: "Agent",
              children: [{ kind: "story", id: "motion-more-agent--idle", name: "Idle" }],
            },
          ],
        },
      ],
    },
    {
      kind: "branch",
      name: "Button",
      children: [{ kind: "story", id: "button--plain", name: "Plain" }],
    },
    {
      kind: "branch",
      name: "Forms",
      children: [
        {
          kind: "branch",
          name: "Field",
          children: [{ kind: "story", id: "forms-field--text", name: "Text input" }],
        },
      ],
    },
  ]);
  expect(storyTree({ entries: {} })).toEqual([]);
});
