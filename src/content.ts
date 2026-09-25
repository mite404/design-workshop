export type Pattern = "dashboard" | "list" | "editor" | "settings";

export const patterns: {
  id: Pattern;
  name: string;
  short: string;
  rule: string;
  use: string;
}[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    short: "Overview + navigation",
    rule: "Separate the shell from the content grid.",
    use: "Use when people need a summary before choosing where to go. Keep the navigation stable; let the workspace stretch.",
  },
  {
    id: "list",
    name: "List + detail",
    short: "Browse without losing context",
    rule: "Keep selection and detail visible together.",
    use: "Use for inboxes, project lists, and asset browsers. Give the list a bounded width and the detail the remaining space. On narrow windows, show one pane at a time.",
  },
  {
    id: "editor",
    name: "Editor workspace",
    short: "Tools + canvas + inspector",
    rule: "Give the work the largest region.",
    use: "Use for creative tools. Keep tools and properties at stable widths, with the canvas absorbing resize. Collapsing inspectors preserves working space.",
  },
  {
    id: "settings",
    name: "Settings",
    short: "Navigation + focused form",
    rule: "Constrain the form, not the whole window.",
    use: "Use for configuration. A 480–640px form keeps labels and controls close, even inside a very wide workspace. Separate destructive actions.",
  },
];

export const projects = [
  {
    name: "Brand refresh",
    type: "Identity",
    status: "In progress",
    due: "Oct 12",
    color: "peach",
    initials: "AK",
  },
  {
    name: "Studio website",
    type: "Digital",
    status: "In review",
    due: "Oct 16",
    color: "lavender",
    initials: "JL",
  },
  {
    name: "Autumn campaign",
    type: "Marketing",
    status: "Planning",
    due: "Oct 24",
    color: "sage",
    initials: "MR",
  },
];

export const spacing = [
  {
    value: 4,
    label: "Micro",
    usage: "Icon adjustment, badge inset. Use sparingly.",
  },
  {
    value: 8,
    label: "Related",
    usage: "Icon to label, between related buttons.",
  },
  {
    value: 12,
    label: "Compact",
    usage: "Horizontal button padding, menu item inset.",
  },
  {
    value: 16,
    label: "Component",
    usage: "Card padding, gaps in compact forms.",
  },
  {
    value: 24,
    label: "Group",
    usage: "Card gutters, content padding, field groups.",
  },
  {
    value: 32,
    label: "Section",
    usage: "Between distinct sections of a view.",
  },
  {
    value: 48,
    label: "Region",
    usage: "Major page divisions and generous outer space.",
  },
];

export const anatomy = [
  {
    name: "Title bar",
    value: "36px",
    detail:
      "This example uses 36px. Native title bars are owned by the OS; follow its window, drag-region, and caption-button rules.",
  },
  {
    name: "Toolbar",
    value: "56px",
    detail:
      "A 36px control centered in a 56px toolbar has 10px above and below. Toolbar height follows controls, not the column grid.",
  },
  {
    name: "Sidebar",
    value: "160px",
    detail:
      "This compact teaching example uses 160px. Real apps often start around 200–280px. Test long labels and allow resizing when useful.",
  },
  {
    name: "Content padding",
    value: "24px",
    detail:
      "Space from the workspace edge to its content. This is separate from the gap between cards. Change it in the inspector.",
  },
  {
    name: "Status bar",
    value: "28px",
    detail:
      "For passive status in this example. Interactive items still need adequate targets; don’t compress controls to fit a thin bar.",
  },
];

export const lessons = [
  {
    level: "Beginner",
    title: "Space creates relationships",
    kicker: "01 / Proximity",
    body: "Imagine a film poster: the title and subtitle belong together, while the credits form a separate group. Interface spacing does the same job. Smaller gaps say “related”; larger gaps say “new thought.”",
    rule: "Inside a group < between groups < between sections.",
    exercise:
      "Two buttons belong to one action group. Another group follows below. Which spacing makes that relationship clearest?",
    options: [
      "Use 24px everywhere",
      "8px within, 24px between",
      "24px within, 8px between",
    ],
    answer: 1,
    explanation:
      "8px joins the related buttons. 24px separates the groups. The ratio communicates the relationship; the exact values can change with density.",
    practice:
      "Open Spacing system. Compare 8px, 24px, and 48px. Then change the dashboard gutter and notice when cards stop feeling like one group.",
  },
  {
    level: "Beginner",
    title: "Hierarchy before decoration",
    kicker: "02 / Attention",
    body: "Treat the screen like a shot. Decide what the audience should see first, second, and third. Size, weight, position, and contrast establish that order before color or borders.",
    rule: "One clear primary action per task region.",
    exercise:
      "A form has Save, Cancel, and Delete actions. What gives Save a clear priority?",
    options: [
      "Three filled buttons",
      "A filled Save, quiet Cancel, separated Delete",
      "Make every button larger",
    ],
    answer: 1,
    explanation:
      "A filled primary action attracts attention. A quiet alternative preserves that priority. A separated destructive action reduces accidental activation.",
    practice:
      "Open Components. Compare the primary, secondary, and destructive buttons. Squint at the screen: the primary action should remain obvious.",
  },
  {
    level: "Intermediate",
    title: "A grid inside a shell",
    kicker: "03 / Structure",
    body: "A publishing grid divides the page. A desktop window first divides into functional regions: navigation, workspace, and sometimes an inspector. A column grid can live inside the workspace. The sidebar does not need to occupy two of twelve columns.",
    rule: "Stable panels outside. Flexible columns inside.",
    exercise: "Why is 12 a popular column count?",
    options: [
      "All desktop apps require it",
      "It divides evenly into 2, 3, 4, and 6",
      "It guarantees accessibility",
    ],
    answer: 1,
    explanation:
      "12 supports halves, thirds, quarters, and sixths. 10 supports halves and fifths. Choose divisibility for the content; neither count is a desktop standard.",
    practice:
      "Enable Column grid. Switch between 12 and 10 columns. Observe that three equal cards use four columns each at 12, but need a 3/3/4 split at 10.",
  },
  {
    level: "Intermediate",
    title: "Density is a product decision",
    kicker: "04 / Rhythm",
    body: "An editor used all day can benefit from compact controls. A touch-first check-in screen needs larger targets. Density changes row heights, gaps, and padding as a coordinated set, not the text size alone.",
    rule: "Optimize for the input method and the task, not the screenshot.",
    exercise:
      "A desktop app will also be used on touch screens. What should you do?",
    options: [
      "Shrink labels to fit more rows",
      "Keep 20px targets everywhere",
      "Offer comfortable targets and test touch tasks",
    ],
    answer: 2,
    explanation:
      "WCAG 2.2 AA target size is generally at least 24×24 CSS px, with spacing and other exceptions. 44×44 is the enhanced AAA target, with exceptions. A larger comfortable mode is often useful.",
    practice:
      "Switch the dashboard between Comfortable and Compact. Notice that row heights change from 48 to 36px while labels stay readable.",
  },
  {
    level: "Advanced",
    title: "Design the states, not just the screen",
    kicker: "05 / Behavior",
    body: "The polished default screen is one frame in a sequence. A usable component also needs focus, disabled, error, empty, and success states. Feedback must say what happened and what the person can do next.",
    rule: "Never use color as the only signal.",
    exercise: "A required field is empty. What is the most useful response?",
    options: [
      "A red border alone",
      "A field-linked message that explains the fix",
      "Disable every action without explanation",
    ],
    answer: 1,
    explanation:
      "A specific message and programmatic association make the error understandable to more people. Keep valid entries so the user does not repeat work.",
    practice:
      "Open Components. Clear the project name and save. Follow the error message, correct the field, and save again. Use Tab to inspect focus.",
  },
  {
    level: "Advanced",
    title: "Respond to the window, not the device",
    kicker: "06 / Adaptation",
    body: "Desktop windows are resizable. A laptop can have a narrow app beside a video call. Resize until the content stops working, then change the composition. A breakpoint is the point where the layout needs a new arrangement.",
    rule: "Collapse secondary regions before shrinking essential content.",
    exercise:
      "A list/detail app becomes too narrow to read both panes. What should happen?",
    options: [
      "Shrink all text",
      "Keep both panes and clip labels",
      "Show the list, then open detail with a Back action",
    ],
    answer: 2,
    explanation:
      "One pane at a time preserves readable content and clear navigation. Keep selection state when moving back. Test long labels, translations, and browser zoom.",
    practice:
      "Resize this workbook. Its inspector moves beneath the preview. The desktop specimen keeps its minimum working width inside a labeled scroll region.",
  },
  {
    level: "Senior",
    title: "Tokens are decisions with names",
    kicker: "07 / Systems",
    body: "A design token is a named value shared by many components. Like a color grade applied across a film, one deliberate change can update the whole system. Name tokens by purpose when different contexts should evolve independently.",
    rule: "Share a value because the meaning matches, not because the number matches.",
    exercise:
      "A card gutter and a touch target happen to be 24px. Should they share one semantic token?",
    options: [
      "Yes, every equal number is the same decision",
      "No, their purposes and constraints differ",
      "Never use tokens",
    ],
    answer: 1,
    explanation:
      "A spacing token and a minimum target-size token may currently resolve to the same number but must be able to change independently.",
    practice:
      "Open the layout code. Identify which values describe content spacing and which describe the shell. Change one purpose without affecting the other.",
  },
  {
    level: "Senior",
    title: "Know when to break the rule",
    kicker: "08 / Judgment",
    body: "A grid is a starting hypothesis. Test it against actual work: finding an item, comparing options, recovering from an error. An optical adjustment may improve alignment; an unusually wide panel may be necessary for a real task.",
    rule: "Make exceptions explainable, repeatable, and tested.",
    exercise:
      "A strict 8px grid makes an icon appear off-center. What is the best response?",
    options: [
      "Keep it visibly off-center",
      "Make a documented optical adjustment and verify it",
      "Remove the entire spacing scale",
    ],
    answer: 1,
    explanation:
      "Bounding boxes and perceived visual centers differ. A small optical correction is valid. Verify it at actual sizes and document the reason, rather than adding arbitrary exceptions everywhere.",
    practice:
      "Remix a layout for a video editor. Sketch what stays fixed, what stretches, and what collapses. Test keyboard use, 200% zoom, long content, and task completion before calling it done.",
  },
];
