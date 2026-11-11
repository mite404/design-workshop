import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { SidebarSection } from "./sidebar-section";

const ROWS = ["Weekly brief", "Refund audit", "September invoices"];

const meta = {
  title: "Sidebar/Section",
  component: SidebarSection,
  parameters: { cascade: "app" },
  args: { label: "Archived", count: ROWS.length, defaultOpen: false },
  argTypes: {
    className: { table: { disable: true } },
    children: { table: { disable: true } },
  },
  render: (args) => (
    <div className="flex w-64 flex-col bg-sidebar p-2">
      <SidebarSection {...args} key={String(args.defaultOpen)}>
        <ul className="flex flex-col">
          {ROWS.slice(0, args.count).map((row) => (
            <li key={row} className="h-8 truncate px-2 pl-6 text-sm leading-8 text-soft-ink">
              {row}
            </li>
          ))}
        </ul>
      </SidebarSection>
    </div>
  ),
} satisfies Meta<typeof SidebarSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Folded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button", { name: "Archived, 3" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByText("Weekly brief")).toBeNull();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByText("Weekly brief")).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(canvas.queryByText("Weekly brief")).toBeNull();
  },
};

export const Open: Story = {
  args: { label: "Projects", defaultOpen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Projects, 3" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(canvas.getByText("September invoices")).toBeVisible();
  },
};

export const Empty: Story = {
  args: { label: "Snoozed", count: 0 },
  argTypes: { defaultOpen: { table: { disable: true } } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Snoozed")).toBeVisible();
    await expect(canvas.queryByRole("button")).toBeNull();
    await expect(canvasElement.querySelector("[data-slot=fold-chevron]")).toBeNull();
    await expect(canvas.queryByText("0")).toBeNull();
  },
};
