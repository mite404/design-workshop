import { useState, type CSSProperties } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Folder,
  LayoutGrid,
  ListTodo,
  Plus,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { projects, type Pattern } from "./content";

type MockProps = {
  pattern: Pattern;
  columns: number;
  gutter: number;
  padding: number;
  grid: boolean;
  guides: boolean;
  compact: boolean;
};

function Dashboard({ columns, gutter }: Pick<MockProps, "columns" | "gutter">) {
  return (
    <>
      <div className="mock-heading">
        <div>
          <h3>
            Good morning, Alex <span className="sun-icon">☀</span>
          </h3>
          <p>Here's what's happening at your studio.</p>
        </div>
        <span className="mock-date">Monday, October 6</span>
      </div>
      <div
        className="metric-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: gutter,
        }}
      >
        {[
          {
            label: "Active projects",
            value: "12",
            note: "+2 this month",
            points: "0,25 10,22 18,26 28,15 40,18 48,8 60,5",
          },
          {
            label: "Tasks completed",
            value: "84",
            note: "↑ 18% this month",
            points: "0,28 12,20 23,22 33,10 42,13 50,5 60,3",
          },
          {
            label: "Team members",
            value: "8",
            note: "Across 3 teams",
            points: "0,20 10,20 20,14 30,14 40,8 50,8 60,8",
          },
        ].map((metric, i) => (
          <article
            className="metric"
            key={metric.label}
            style={{
              gridColumn: `span ${i === 2 ? columns - 2 * Math.floor(columns / 3) : Math.floor(columns / 3)}`,
            }}
          >
            <span>
              {metric.label}
              <ArrowUpRight size={12} />
            </span>
            <div>
              <strong>{metric.value}</strong>
              <svg viewBox="0 0 60 32" aria-hidden="true">
                <polyline points={metric.points} />
              </svg>
            </div>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>
      <div className="project-heading">
        <b>Recent projects</b>
        <span>
          All projects <ArrowUpRight size={12} />
        </span>
      </div>
      <div className="project-table">
        <div className="project-row table-heading">
          <span>PROJECT NAME</span>
          <span>STATUS</span>
          <span>DUE DATE</span>
          <span>LEAD</span>
        </div>
        {projects.map((project) => (
          <div className="project-row" key={project.name}>
            <span>
              <span className={`project-icon ${project.color}`}>
                <Folder size={14} />
              </span>
              <b>{project.name}</b>
            </span>
            <span>
              <i className={`status-dot ${project.color}`} />
              {project.status}
            </span>
            <span>{project.due}</span>
            <span className={`avatar ${project.color}`}>
              {project.initials}
            </span>
          </div>
        ))}
      </div>
      <div className="mock-bottom-note">
        <span className="green-dot" /> All caught up. Your workspace is looking
        good.
      </div>
    </>
  );
}

function ListDetail() {
  const [selected, setSelected] = useState(0);
  const project = projects[selected];
  return (
    <div className="list-detail">
      <div className="mock-list">
        <div className="section-label">PROJECTS / 03</div>
        {projects.map((item, i) => (
          <button
            key={item.name}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <span className={`project-icon ${item.color}`}>
              <Folder size={15} />
            </span>
            <span>
              <b>{item.name}</b>
              <small>
                {item.type} · {item.due}
              </small>
            </span>
          </button>
        ))}
      </div>
      <article className="detail-pane">
        <span className="mock-pill">{project.status}</span>
        <h3>{project.name}</h3>
        <p>
          A considered visual direction for the next chapter of Forma. Explore a
          clear, flexible system that works in print and on screen.
        </p>
        <div className="detail-metadata">
          <span>PROJECT LEAD</span>
          <b>{project.initials} · Design team</b>
          <span>DUE DATE</span>
          <b>{project.due}, 2026</b>
        </div>
        <h4>Deliverables</h4>
        {["Creative direction", "Design exploration", "Production handoff"].map(
          (task, i) => (
            <label className="task-check" key={task}>
              <input type="checkbox" defaultChecked={i === 0} />
              {task}
            </label>
          ),
        )}
      </article>
    </div>
  );
}

function Editor() {
  const [inspector, setInspector] = useState(true);
  return (
    <div className="editor-layout">
      <div className="editor-tools">
        <span>V</span>
        <span>T</span>
        <span>□</span>
        <span>○</span>
      </div>
      <div className="editor-stage">
        <div className="section-label">Scene 04 / The arrival</div>
        <div className="poster">
          <small>A FORMA STUDIOS FILM</small>
          <div className="poster-orb" />
          <h3>
            THE
            <br />
            ARRIVAL.
          </h3>
          <span>
            A NEW PERSPECTIVE
            <br />
            COMING THIS AUTUMN
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setInspector(!inspector)}
        >
          {inspector ? "Hide" : "Show"} properties
        </Button>
      </div>
      {inspector && (
        <div className="editor-properties">
          <b>Properties</b>
          <span>Canvas</span>
          <code>1920 × 1080</code>
          <span>Background</span>
          <div className="color-swatch" />
          <span>Alignment</span>
          <div>← &nbsp; ↔ &nbsp; →</div>
          <p>
            Fixed tools.
            <br />
            Flexible canvas.
            <br />
            Optional inspector.
          </p>
        </div>
      )}
    </div>
  );
}

function MockSettings() {
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="mock-settings"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
    >
      <h3>Workspace preferences</h3>
      <p>Small details that make this space yours.</p>
      <label>
        Workspace name
        <Input
          defaultValue="Forma Studio"
          required
          onChange={() => setSaved(false)}
        />
      </label>
      <label>
        Contact email
        <Input
          type="email"
          defaultValue="alex@example.com"
          required
          onChange={() => setSaved(false)}
        />
      </label>
      <div className="switch-row">
        <label htmlFor="digest">Weekly activity digest</label>
        <Switch id="digest" defaultChecked />
      </div>
      <Button type="submit" size="sm">
        {saved ? (
          <>
            <Check /> Preferences saved
          </>
        ) : (
          "Save preferences"
        )}
      </Button>
    </form>
  );
}

/** Render a mock desktop shell at real CSS-pixel measurements, with optional teaching overlays. */
export function MockWindow({
  pattern,
  columns,
  gutter,
  padding,
  grid,
  guides,
  compact,
}: MockProps) {
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [projectName, setProjectName] = useState("");
  const style: CSSProperties & Record<string, string> = {
    "--row-height": compact ? "36px" : "48px",
    "--control-height": compact ? "32px" : "36px",
  };
  return (
    <div className={`mock-window ${guides ? "with-guides" : ""}`} style={style}>
      <div className="mock-titlebar">
        <div className="traffic-lights">
          <i />
          <i />
          <i />
        </div>
        <span>Forma / Studio workspace</span>
        {guides && <span className="region-tag">TITLE BAR · 36</span>}
      </div>
      <div className="mock-body">
        <aside className="mock-sidebar">
          <div className="mock-brand">
            <span>f.</span> forma <ChevronDown size={12} />
          </div>
          <div className="mock-nav-label">WORKSPACE</div>
          <div className="mock-nav-item active">
            <LayoutGrid size={14} />
            Overview
          </div>
          <div className="mock-nav-item">
            <Folder size={14} />
            Projects <small>12</small>
          </div>
          <div className="mock-nav-item">
            <ListTodo size={14} />
            My tasks
          </div>
          <div className="mock-nav-item">
            <Users size={14} />
            Team
          </div>
          <div className="mock-sidebar-bottom">
            <div className="mock-nav-item">
              <Settings2 size={14} />
              Preferences
            </div>
            <div className="mock-profile">
              <span className="avatar peach">AK</span>
              <span>
                <b>Alex Kim</b>
                <small>Pro workspace</small>
              </span>
            </div>
          </div>
          {guides && <span className="sidebar-measure">← 160px →</span>}
        </aside>
        <div className="mock-main">
          <div className="mock-toolbar">
            <span>
              {pattern === "dashboard"
                ? "Overview"
                : pattern === "list"
                  ? "Projects"
                  : pattern === "editor"
                    ? "Creative studio"
                    : "Preferences"}
            </span>
            <div>
              <span className="mock-toolbar-icon">
                <Search size={15} />
              </span>
              <span className="mock-toolbar-icon">
                <Bell size={15} />
              </span>
              <Button size="sm" onClick={() => setAdding(!adding)}>
                <Plus /> New project
              </Button>
            </div>
          </div>
          <div className="mock-content" style={{ padding }}>
            {pattern === "dashboard" && (
              <Dashboard columns={columns} gutter={gutter} />
            )}
            {pattern === "list" && <ListDetail />}
            {pattern === "editor" && <Editor />}
            {pattern === "settings" && <MockSettings />}
            {grid && (
              <div
                className="grid-overlay"
                aria-label={`${columns}-column content grid`}
                style={{
                  inset: padding,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: gutter,
                }}
              >
                {Array.from({ length: columns }, (_, i) => (
                  <span key={i}>
                    <small>{i + 1}</small>
                  </span>
                ))}
              </div>
            )}
            {guides && (
              <span className="padding-measure">↔ {padding}px padding</span>
            )}
            {adding && (
              <form
                className="new-project-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setNotice(`Created “${projectName}” in this mock session`);
                  setAdding(false);
                  setProjectName("");
                }}
              >
                <div>
                  <b>Create a mock project</b>
                  <button
                    type="button"
                    aria-label="Close project form"
                    onClick={() => setAdding(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
                <label>
                  Project name
                  <Input
                    required
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    autoFocus
                  />
                </label>
                <Button type="submit">Create project</Button>
              </form>
            )}
          </div>
        </div>
      </div>
      <div className="mock-statusbar">
        <span>
          <span className="green-dot" />
          {notice || "All changes saved"}
        </span>
        <span>
          {guides ? "STATUS BAR · 28px" : "Forma Studio"}
          <CircleHelp size={11} />
        </span>
      </div>
    </div>
  );
}
