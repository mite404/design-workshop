import { curveLinear } from "d3-shape";
import { useId, useState, type ReactNode } from "react";
import { Bar } from "@yaklabs/ui/components/charts/bar";
import { Line, LineChart } from "@yaklabs/ui/components/charts/line-chart";
import { XAxis } from "@yaklabs/ui/components/charts/x-axis";
import { BarChart } from "@yaklabs/ui/components/charts/bar-chart";
import { BarXAxis } from "@yaklabs/ui/components/charts/bar-x-axis";
import { Grid } from "@yaklabs/ui/components/charts/grid";
import { ChartTooltip } from "@yaklabs/ui/components/charts/tooltip/chart-tooltip";
import { YAxis as BarValueAxis } from "@yaklabs/ui/components/charts/y-axis";
import { CardHeader } from "./CardHeader";
import { resolve, type DataProps, type Selection } from "./catalog";
import { ShareButton } from "./ShareButton";

/** Bars are flat data colour with the button's 4px top corners; no gradient (ADR-055). */
export const BAR_RADIUS = 4;

// The table scrolls inside a capped height, so its wrapper is a named region that takes focus:
// otherwise rows below the fold are out of reach without a mouse (axe scrollable-region-focusable).
function DataTable({ props }: { props: DataProps }) {
  const caption = useId();
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll region must take focus to scroll by keyboard (WCAG 2.1.1)
    <section className="table-wrap" aria-labelledby={caption} tabIndex={0}>
      <table>
        <caption id={caption}>
          {props.title} · {props.unit}
        </caption>
        <thead>
          <tr>
            <th scope="col">Observation</th>
            <th scope="col">Value ({props.unit})</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={index}>
              <th scope="row">{row.label}</th>
              <td>{row.value === null ? "Not recorded" : String(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// "2026-09-14" → that day at local midnight; `new Date("2026-09-14")` is UTC midnight, which
// lands on the day before west of Greenwich.
function localDay(iso: string): Date {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function Chart({ selection }: { selection: Selection }) {
  const props = selection.props;
  const tooltip = (
    <ChartTooltip
      rows={(point) => [
        {
          color: "var(--data)",
          label: props.unit,
          value: typeof point.value === "number" ? point.value : "Not recorded",
        },
      ]}
    />
  );
  return (
    <div
      className="chart"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a live Recharts SVG cannot be an <img>; role="img" names the drawing
      role="img"
      aria-label={`${props.title}. Values available in the data table.`}
    >
      {selection.component === "LineChart" ? (
        // bklit's line chart (PRD section 12, ADR-035): x is time, labelled with the rows' own
        // labels; a missing value leaves a gap.
        <LineChart
          data={selection.props.rows.map((row) => ({ date: localDay(row.date), value: row.value }))}
          aspectRatio="auto"
          animationDuration={0}
          margin={{ top: 20, right: 24, bottom: 32, left: 48 }}
        >
          <Grid horizontal stroke="var(--hairline)" strokeOpacity={1} />
          <Line
            dataKey="value"
            stroke="var(--data)"
            strokeWidth={props.variant === "snapshot" ? 0 : 3}
            curve={curveLinear}
            fadeEdges={false}
            showMarkers
            animate={false}
          />
          <BarValueAxis />
          <XAxis labels={props.rows.map((row) => row.label)} tickMode="data" />
          {tooltip}
        </LineChart>
      ) : (
        // bklit's bar chart (PRD section 12), drawn at once: cards are read, not watched.
        <BarChart
          data={props.rows}
          xDataKey="label"
          aspectRatio="auto"
          margin={{ top: 20, right: 24, bottom: 32, left: 48 }}
        >
          <Grid horizontal stroke="var(--hairline)" strokeOpacity={1} />
          <Bar dataKey="value" fill="var(--data)" lineCap={BAR_RADIUS} animate={false} />
          <BarValueAxis />
          <BarXAxis />
          {tooltip}
        </BarChart>
      )}
    </div>
  );
}

// The host's controls on a card with no header: the collapse at its top left, the close at its
// top right.
function HostEnds({ leading, trailing }: { leading: ReactNode; trailing: ReactNode }) {
  return (
    <>
      {leading !== undefined && <div className="header-leading">{leading}</div>}
      {trailing !== undefined && <div className="header-trailing">{trailing}</div>}
    </>
  );
}

/**
 * The only entry point for agent-selected UI. All content passes the catalog boundary.
 * @param context Host-owned placement, never part of the agent payload: "page" for the
 * evaluation workbench, "thread" for a card inside a chat thread (ADR-023).
 * @param shareable Show the share button (ADR-064); off on the public page itself.
 * @param draggable Let the header carry the card out, as onto the compose canvas (ADR-089).
 * @param leading A host's control before the title, such as a lane's collapse (ADR-134); a
 * card with no header shows it at its top.
 * @param trailing A host's control at the title bar's far end, after the share button, such as
 * a lane's close; a card with no header shows it at its top right.
 */
export function CatalogCard({
  payload,
  context = "page",
  shareable = true,
  draggable = false,
  leading,
  trailing,
}: {
  payload: unknown;
  context?: "page" | "thread";
  shareable?: boolean;
  draggable?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const result = resolve(payload);
  const [showTable, setShowTable] = useState(false);
  if (result.kind === "rejected")
    return (
      <section data-wb="CatalogCard" className="card state" data-context={context}>
        <HostEnds leading={leading} trailing={trailing} />
        <span className="state-symbol">↗</span>
        <p className="eyebrow">CATALOG LIMIT</p>
        <h2>We don’t have a safe view for this yet.</h2>
        <p>{result.reason}</p>
        <p className="page-only">
          Try an approved view, or capture the missing capability below. We won’t substitute an
          unrelated chart.
        </p>
      </section>
    );
  if (result.kind === "empty")
    return (
      <section data-wb="CatalogCard" className="card state" data-context={context}>
        <HostEnds leading={leading} trailing={trailing} />
        <span className="state-symbol">∅</span>
        <p className="eyebrow">NO DATA</p>
        <h2>{result.title}</h2>
        <p>No observations were supplied. This is not a value of zero.</p>
      </section>
    );
  const { selection } = result;
  const { props } = selection;
  return (
    <section data-wb="CatalogCard" className="card" data-context={context}>
      <CardHeader
        eyebrow={`${selection.component} / ${props.variant}`}
        title={props.title}
        leading={leading}
        drag={
          draggable ? { card: { v: 1, kind: "catalog", payload }, title: props.title } : undefined
        }
        actions={
          <>
            <span className="badge">Validated</span>
            {shareable && <ShareButton card={{ v: 1, kind: "catalog", payload }} />}
            {trailing}
          </>
        }
      />
      {result.kind === "fallback" && (
        <p className="notice">
          <output>{result.reason}</output>
        </p>
      )}
      {selection.component === "DataTable" || showTable ? (
        <DataTable props={props} />
      ) : (
        <Chart selection={selection} />
      )}
      {props.rows.some((row) => row.value === null) && (
        <p className="notice">
          Missing observations remain gaps. No interpolation or zero-filling.
        </p>
      )}
      <footer>
        <span>
          {props.source}
          <br />
          <span className="muted">
            Source label supplied with data · not independently verified
          </span>
        </span>
        {selection.component !== "DataTable" && (
          <button
            className="btn btn-sm card-toggle"
            onClick={() => {
              setShowTable(!showTable);
            }}
          >
            {showTable ? "Show chart" : "View data table"}
          </button>
        )}
      </footer>
    </section>
  );
}
