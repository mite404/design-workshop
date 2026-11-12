import type { Selection } from "./catalog";

/** Synthetic evaluation data, never presented as live business data. */
export const trend = {
  catalogVersion: "1",
  component: "LineChart",
  props: {
    title: "A clearer view of the week",
    source: "Demo service desk · Sep 14–20",
    unit: "cases",
    variant: "trend",
    rows: [
      { date: "2026-09-14", label: "Mon", value: 24 },
      { date: "2026-09-15", label: "Tue", value: 38 },
      { date: "2026-09-16", label: "Wed", value: 31 },
      { date: "2026-09-17", label: "Thu", value: 52 },
      { date: "2026-09-18", label: "Fri", value: 46 },
      { date: "2026-09-19", label: "Sat", value: 62 },
      { date: "2026-09-20", label: "Sun", value: 58 },
    ],
  },
} satisfies Selection;

/** Deterministic scenarios keep product evaluation independent of model variability. */
export const scenarios: Record<string, { label: string; question: string; payload: unknown }> = {
  trend: {
    label: "Weekly trend",
    question: "How did closed cases change this week?",
    payload: trend,
  },
  snapshot: {
    label: "Snapshot readings",
    question: "Show readings as discrete snapshots.",
    payload: { ...trend, props: { ...trend.props, variant: "snapshot" } },
  },
  comparison: {
    label: "Compare teams",
    question: "Which team closed the most cases?",
    payload: {
      ...trend,
      component: "BarChart",
      props: {
        ...trend.props,
        title: "A side-by-side team comparison",
        variant: "comparison",
        rows: [
          { label: "Support", value: 84 },
          { label: "Success", value: 56 },
          { label: "Operations", value: 71 },
        ],
      },
    },
  },
  table: {
    label: "Exact values",
    question: "Let me inspect the exact numbers.",
    payload: {
      ...trend,
      component: "DataTable",
      props: { ...trend.props, variant: "audit" },
    },
  },
  sparse: {
    label: "Too little data",
    question: "Show a trend from this one observation.",
    payload: {
      ...trend,
      props: { ...trend.props, rows: [{ date: "2026-09-14", label: "Mon", value: 24 }] },
    },
  },
  missing: {
    label: "Missing observations",
    question: "Show the week without inventing Wednesday.",
    payload: {
      ...trend,
      props: {
        ...trend.props,
        rows: trend.props.rows.map((row) => ({
          ...row,
          value: row.label === "Wed" ? null : row.value,
        })),
      },
    },
  },
  empty: {
    label: "No observations",
    question: "What happened before collection started?",
    payload: { ...trend, props: { ...trend.props, rows: [] } },
  },
  unsupported: {
    label: "Unsupported request",
    question: "Predict next month with a confidence interval.",
    payload: { ...trend, component: "ForecastChart" },
  },
  unsafe: {
    label: "Unsafe props",
    question: "Make the chart run custom code.",
    payload: {
      ...trend,
      props: { ...trend.props, onClick: "alert(document.cookie)" },
    },
  },
};
