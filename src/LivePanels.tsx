import { useRef, useState } from "react";
import { GripHorizontal, MessageSquare, Plus, Send } from "lucide-react";

const panels = {
  sidebar: { name: "Side navigation", width: 192, height: 400 },
  chat: { name: "Chat thread", width: 512, height: 440 },
};
type Panel = keyof typeof panels;
const panelIds: Panel[] = ["sidebar", "chat"];
const initial = { sidebar: { x: 16, y: 24 }, chat: { x: 240, y: 24 } };
const stage = { width: 800, height: 560 };

function snap(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, Math.round(value / 8) * 8));
}

/** Fixed-size mock panels with grid-snapped, bounded two-axis movement. */
export function LivePanels({
  grid,
}: {
  /** Show the shared 8px placement grid. */ grid: boolean;
}) {
  const [positions, setPositions] = useState(initial);
  const [selected, setSelected] = useState<Panel>("sidebar");
  const drag = useRef<{
    pointer: number;
    panel: Panel;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const sidebar = positions.sidebar;
  const chat = positions.chat;
  const overlap =
    sidebar.x < chat.x + panels.chat.width &&
    sidebar.x + panels.sidebar.width > chat.x &&
    sidebar.y < chat.y + panels.chat.height &&
    sidebar.y + panels.sidebar.height > chat.y;
  const horizontalGap =
    Math.max(sidebar.x, chat.x) -
    Math.min(sidebar.x + panels.sidebar.width, chat.x + panels.chat.width);

  function move(panel: Panel, x: number, y: number) {
    setPositions((previous) => ({
      ...previous,
      [panel]: {
        x: snap(x, stage.width - panels[panel].width),
        y: snap(y, stage.height - panels[panel].height),
      },
    }));
  }

  return (
    <>
      <div
        className={`live-panel-stage ${grid ? "live-grid" : ""}`}
        style={{ height: stage.height }}
      >
        <span className="live-stage-caption">
          BODY GRID / 800 × 560 · Drag a panel header
        </span>
        {panelIds.map((id) => (
          <section
            key={id}
            role="region"
            aria-label={`${panels[id].name} panel`}
            className={`live-panel live-panel-${id}`}
            data-selected={selected === id}
            style={{
              left: positions[id].x,
              top: positions[id].y,
              width: panels[id].width,
              height: panels[id].height,
              zIndex: selected === id ? 2 : 1,
            }}
          >
            <button
              className="live-panel-handle"
              aria-label={`Move ${panels[id].name}`}
              aria-pressed={selected === id}
              onFocus={() => setSelected(id)}
              onPointerDown={(event) => {
                setSelected(id);
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  pointer: event.pointerId,
                  panel: id,
                  startX: event.clientX,
                  startY: event.clientY,
                  ...positions[id],
                };
              }}
              onPointerMove={(event) => {
                const active = drag.current;
                if (active?.pointer === event.pointerId)
                  move(
                    active.panel,
                    active.x + event.clientX - active.startX,
                    active.y + event.clientY - active.startY,
                  );
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
              onKeyDown={(event) => {
                const offsets: Record<string, { x: number; y: number }> = {
                  ArrowLeft: { x: -8, y: 0 },
                  ArrowRight: { x: 8, y: 0 },
                  ArrowUp: { x: 0, y: -8 },
                  ArrowDown: { x: 0, y: 8 },
                };
                const offset = offsets[event.key];
                if (offset) {
                  event.preventDefault();
                  move(
                    id,
                    positions[id].x + offset.x,
                    positions[id].y + offset.y,
                  );
                }
              }}
            >
              <GripHorizontal size={16} />
              <span>{panels[id].name}</span>
            </button>
            {id === "sidebar" ? (
              <div className="live-sidebar-content">
                <strong>Forma studio</strong>
                <div className="live-nav-new">
                  <Plus size={16} /> New conversation
                </div>
                <span className="section-label">RECENT THREADS</span>
                {["Layout exploration", "Brand refresh", "Type & spacing"].map(
                  (name, index) => (
                    <div
                      key={name}
                      className={`live-nav-row ${index === 0 ? "active" : ""}`}
                    >
                      <MessageSquare size={14} />
                      <span>{name}</span>
                    </div>
                  ),
                )}
                <small>
                  16px padding
                  <br />
                  36px rows · 8px gaps
                </small>
              </div>
            ) : (
              <div className="live-chat-content">
                <header>
                  <strong>Layout exploration</strong>
                  <span>Mock conversation</span>
                </header>
                <div className="live-chat-messages">
                  <div className="live-chat-message">
                    <small>YOU · 10:42</small>
                    <p>How do I give the chat room to breathe?</p>
                  </div>
                  <div className="live-chat-message">
                    <small>DESIGN GUIDE · 10:43</small>
                    <p>Keep the controls grouped.</p>
                    <p>
                      Start with 24px panel padding and 16px between messages.
                      Move the whole panel before adjusting individual elements.
                    </p>
                  </div>
                </div>
                <div className="live-chat-composer">
                  <span>Message your design guide…</span>
                  <Send size={16} />
                </div>
                <small>Layout preview only · messages are not sent</small>
              </div>
            )}
          </section>
        ))}
      </div>
      <div className="live-panel-inspector">
        <div className="live-panel-fields">
          <label>
            Panel{" "}
            <select
              value={selected}
              onChange={(event) => {
                if (
                  event.target.value === "sidebar" ||
                  event.target.value === "chat"
                )
                  setSelected(event.target.value);
              }}
            >
              <option value="sidebar">Side navigation</option>
              <option value="chat">Chat thread</option>
            </select>
          </label>
          <label>
            Panel X{" "}
            <input
              type="number"
              step="8"
              min="0"
              max={stage.width - panels[selected].width}
              value={positions[selected].x}
              onChange={(event) =>
                move(
                  selected,
                  Number(event.target.value),
                  positions[selected].y,
                )
              }
            />
          </label>
          <label>
            Panel Y{" "}
            <input
              type="number"
              step="8"
              min="0"
              max={stage.height - panels[selected].height}
              value={positions[selected].y}
              onChange={(event) =>
                move(
                  selected,
                  positions[selected].x,
                  Number(event.target.value),
                )
              }
            />
          </label>
          <span>
            {panels[selected].width} × {panels[selected].height}px · size locked
          </span>
        </div>
        <p className="live-panel-feedback" role="status">
          {overlap
            ? "Panels overlap. Move one to expose the content."
            : "Panels are clear of one another."}{" "}
          {horizontalGap >= 0
            ? `Horizontal gap: ${horizontalGap}px.`
            : "Horizontal extents overlap."}
        </p>
        <p>
          Origin (0, 0) is the body’s top-left corner, below the title bar. Drag
          a header or focus it and use all four arrow keys. Panel edges stay
          inside the body.
        </p>
      </div>
    </>
  );
}
