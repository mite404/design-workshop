import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { AgentMessage } from "./reply";
import { threads } from "./thread";
import { AgentTurn, UserTurn } from "./Turns";

const messages = threads.trend?.messages ?? [];
const user = messages.find((m) => m.role === "user");
const agent = messages.find((m): m is AgentMessage => m.role === "agent");
if (agent === undefined) throw new Error("the trend fixture has no agent turn");

const meta = {
  title: "Thread/Turns",
  component: AgentTurn,
  args: { message: agent, onChoose: fn(), cardsCarry: false, stamp: "just now" },
  argTypes: { message: { table: { disable: true } }, ref: { table: { disable: true } } },
  decorators: [(Story) => <div style={{ width: 720 }}>{Story()}</div>],
} satisfies Meta<typeof AgentTurn>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The agent's reply from the weekly review fixture. */
export const Agent: Story = {};

/** The user's turn: a tinted bubble with no time of its own. */
export const User: Story = {
  render: () => (user?.role === "user" ? <UserTurn message={user} /> : <p>No user turn</p>),
};
