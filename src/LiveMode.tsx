import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Search, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const initial = { lights: 24, navigation: 160, tabs: 328 };
type Group = keyof typeof initial;
const names = {
  lights: "Traffic lights",
  navigation: "Navigation",
  tabs: "Document tabs",
};
const groups: Group[] = ["lights", "navigation", "tabs"];
const width = 800;

/** A fixed-scale title-bar artboard. Moving groups never changes their geometry. */
export function LiveMode() {
  const [positions, setPositions] = useState(initial);
  const [selected, setSelected] = useState<Group>("navigation");
  const [height, setHeight] = useState(56);
  const [radius, setRadius] = useState(16);
  const [size, setSize] = useState(36);
  const [gap, setGap] = useState(8);
  const [grid, setGrid] = useState(true);
  const drag = useRef<{ pointer: number; start: number; x: number } | null>(
    null,
  );
  const widths = { lights: 72, navigation: size * 2 + gap, tabs: 288 };
  const ordered = [...groups].sort((a, b) => positions[a] - positions[b]);
  const overlaps = ordered.some((group, i) => {
    const next = ordered[i + 1];
    return (
      next !== undefined && positions[group] + widths[group] > positions[next]
    );
  });

  function move(group: Group, x: number) {
    const snapped = Math.max(
      0,
      Math.min(
        Math.floor((width - widths[group]) / 8) * 8,
        Math.round(x / 8) * 8,
      ),
    );
    setPositions((previous) => ({ ...previous, [group]: snapped }));
  }

  return (
    <section className="live-mode">
      <div className="section-label">COMPOSITION LAB / LIVE MODE</div>
      <h2>Move the group. Keep the rhythm.</h2>
      <p className="intro-copy">
        Drag title-bar groups along an 8px grid. Their size stays fixed. Like
        moving a grouped layer in a layout, the contents travel together.
      </p>
      <div className="live-controls">
        <label>
          Window radius{" "}
          <input
            aria-label="Window radius"
            type="range"
            min="0"
            max="32"
            step="4"
            value={radius}
            onChange={(event) => setRadius(Number(event.target.value))}
          />
          <output>{radius}px</output>
        </label>
        <label>
          Title-bar height{" "}
          <input
            aria-label="Title-bar height"
            type="range"
            min="48"
            max="96"
            step="8"
            value={height}
            onChange={(event) => setHeight(Number(event.target.value))}
          />
          <output>{height}px</output>
        </label>
        <label>
          Control size{" "}
          <input
            aria-label="Control size"
            type="range"
            min="24"
            max="40"
            step="4"
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
          <output>{size}px</output>
        </label>
        <label>
          Control gap{" "}
          <input
            aria-label="Control gap"
            type="range"
            min="4"
            max="16"
            step="4"
            value={gap}
            onChange={(event) => setGap(Number(event.target.value))}
          />
          <output>{gap}px</output>
        </label>
      </div>
      <div className="live-tools">
        <label>
          <input
            type="checkbox"
            checked={grid}
            onChange={(event) => setGrid(event.target.checked)}
          />{" "}
          Show 8px grid
        </label>
        <span>800px artboard · 1:1 CSS pixels · scroll to explore</span>
        <Button
          variant="outline"
          onClick={() => {
            setPositions(initial);
            setHeight(56);
            setRadius(16);
            setSize(36);
            setGap(8);
            setSelected("navigation");
            setGrid(true);
          }}
        >
          Reset composition
        </Button>
      </div>
      <div
        className="live-scroll"
        role="region"
        aria-label="Composition artboard"
        tabIndex={0}
      >
        <div className="live-window" style={{ borderRadius: radius }}>
          <div
            className={`live-titlebar ${grid ? "live-grid" : ""}`}
            style={{ height }}
          >
            {groups.map((group) => (
              <button
                key={group}
                className={`live-group live-${group}`}
                aria-label={`Move ${names[group]}`}
                aria-pressed={selected === group}
                style={{
                  left: positions[group],
                  width: widths[group],
                  height: size,
                  top: (height - size) / 2,
                  gap,
                }}
                onPointerDown={(event) => {
                  setSelected(group);
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = {
                    pointer: event.pointerId,
                    start: event.clientX,
                    x: positions[group],
                  };
                }}
                onPointerMove={(event) => {
                  if (drag.current?.pointer === event.pointerId)
                    move(
                      group,
                      drag.current.x + event.clientX - drag.current.start,
                    );
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
                onFocus={() => setSelected(group)}
                onKeyDown={(event) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    move(
                      group,
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? width
                          : positions[group] +
                            (event.key === "ArrowLeft" ? -8 : 8),
                    );
                  }
                }}
              >
                {group === "lights" ? (
                  <>
                    <i />
                    <i />
                    <i />
                  </>
                ) : group === "navigation" ? (
                  <>
                    <span style={{ width: size, height: size }}>
                      <ArrowLeft size={16} />
                    </span>
                    <span style={{ width: size, height: size }}>
                      <ArrowRight size={16} />
                    </span>
                  </>
                ) : (
                  <>
                    <span>Brand refresh</span>
                    <span>Research</span>
                  </>
                )}
              </button>
            ))}
          </div>
          <div className="live-body">
            <aside>
              <PanelLeft size={18} />
              <strong>Forma studio</strong>
              <span>Overview</span>
              <span>Projects</span>
              <span>Library</span>
              <small>
                Shell region
                <br />
                Fixed navigation
              </small>
            </aside>
            <article>
              <div className="section-label">PROJECT / 04</div>
              <h3>Brand refresh</h3>
              <p>Content grid starts inside the shell.</p>
              <div className="live-content-grid">
                {["Direction", "Typography", "Assets"].map((name, index) => (
                  <div key={name}>
                    <span>0{index + 1}</span>
                    <strong>{name}</strong>
                    <Search size={20} />
                  </div>
                ))}
              </div>
              <p>12 columns · 16px gutters · 24px content padding</p>
            </article>
          </div>
          <div className="live-status">
            All changes saved <span>Mock desktop window</span>
          </div>
        </div>
      </div>
      <div className="live-readout">
        <div>
          <label>
            Selected group{" "}
            <select
              value={selected}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "lights" ||
                  value === "navigation" ||
                  value === "tabs"
                )
                  setSelected(value);
              }}
            >
              {groups.map((group) => (
                <option key={group} value={group}>
                  {names[group]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Selected group X{" "}
            <input
              aria-label="Selected group X"
              type="number"
              min="0"
              max={width - widths[selected]}
              step="8"
              value={positions[selected]}
              onChange={(event) => move(selected, Number(event.target.value))}
            />
          </label>
          <p>
            Drag, use this field, or focus a group and press ← / →. Home and End
            move to the edges. Vertical centering stays automatic.
          </p>
        </div>
        <div role="status">
          <strong>
            {overlaps
              ? "Groups overlap. Try separating them."
              : "Groups are clear of one another."}
          </strong>
          <p>
            {(height - size) / 2}px above and below each control box. Radius
            changes the corner, not that space.
          </p>
          <p>
            {ordered
              .map((group, i) => {
                const next = ordered[i + 1];
                return next
                  ? `${names[group]} → ${names[next]}: ${positions[next] - positions[group] - widths[group]}px`
                  : null;
              })
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <div className="two-up">
        <article className="paper-card">
          <div className="section-label">TRY YOUR SCREENSHOT</div>
          <h3>28px radius. 80px title bar.</h3>
          <p>
            Keep 36px control boxes. That leaves 22px above and below. Reduce
            the bar to 56px and the space becomes 10px. You changed the
            container, not every button.
          </p>
          <p>
            The colored dots stay 12px inside a larger group. Visible marks and
            clickable areas are different measurements.
          </p>
        </article>
        <article className="paper-card">
          <div className="section-label">A RULE, NOT A RESTRICTION</div>
          <h3>Use two grids for two jobs.</h3>
          <p>
            The 8px grid helps place controls. The 12-column grid divides
            content. Desktop shells usually combine fixed bars, bounded
            sidebars, and flexible content, rather than forcing everything onto
            12 columns.
          </p>
          <p>
            This sandbox moves title-bar groups only. Values are learning
            examples, not native macOS title-bar specifications. Changes reset
            when you leave this section.
          </p>
        </article>
      </div>
    </section>
  );
}
