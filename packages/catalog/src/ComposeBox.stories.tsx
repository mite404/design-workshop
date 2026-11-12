import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { ComposeBox } from "./ComposeBox";

const meta = {
  title: "Thread/Compose box",
  component: ComposeBox,
  args: { draft: "", onDraftChange: fn(), onSend: fn(), onDictate: fn(), onStop: fn() },
  argTypes: {
    // The host owns the draft; the story keeps it in state so typing works.
    draft: { table: { disable: true } },
    attachments: { table: { disable: true } },
  },
  render: function Render(args) {
    const [draft, setDraft] = useState(args.draft);
    return (
      <div style={{ width: 640 }}>
        <ComposeBox {...args} draft={draft} onDraftChange={setDraft} />
      </div>
    );
  },
} satisfies Meta<typeof ComposeBox>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty, waiting for the first message. */
export const Empty: Story = {};

/** A draft with a card choice that will be sent with it. */
export const WithAttachment: Story = {
  args: {
    draft: "Compare this with last week",
    attachments: [{ id: "c1", label: "Still open on Friday", kind: "card" }],
    onRemoveAttachment: fn(),
  },
};

/** A reply is streaming: Stop joins the bar and sending stays open. */
export const Busy: Story = { args: { busy: true } };
