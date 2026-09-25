import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Code2,
  Columns3,
  Copy,
  Frame,
  Layers,
  LayoutDashboard,
  Monitor,
  MousePointer2,
  PanelLeft,
  RotateCcw,
  Ruler,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { anatomy, lessons, patterns, spacing, type Pattern } from "./content";
import { MockWindow } from "./MockWindow";
import { ComponentGallery, LearningPath } from "./Lessons";
import { LiveMode } from "./LiveMode";

type Page =
  "Layouts" | "Live mode" | "Components" | "Spacing system" | "Learning path";
const pages = [
  { name: "Layouts", icon: LayoutDashboard },
  { name: "Live mode", icon: MousePointer2 },
  { name: "Components", icon: Layers },
  { name: "Spacing system", icon: Ruler },
  { name: "Learning path", icon: BookOpen },
] satisfies { name: Page; icon: typeof Layers }[];

function SpacingSystem() {
  const [selected, setSelected] = useState(24);
  return (
    <section className="spacing-page">
      <div className="section-label">THE FOUNDATION / 01</div>
      <h2>A small scale. An entire visual language.</h2>
      <p className="intro-copy">
        Start with a 4px base and an 8px rhythm. Use tighter spacing for related
        items, larger spacing for distinct groups. These are example tokens, not
        universal requirements.
      </p>
      <div className="spacing-ramp">
        {spacing.map((token) => (
          <button
            key={token.value}
            aria-pressed={selected === token.value}
            onClick={() => setSelected(token.value)}
          >
            <span
              className="space-block"
              style={{ height: token.value, width: token.value }}
            />
            <strong>
              {token.value}
              <small>px</small>
            </strong>
            <span>{token.label}</span>
          </button>
        ))}
      </div>
      <div className="two-up">
        <article className="paper-card">
          <div className="section-label">TRY IT / GAP {selected}px</div>
          <h3>Proximity is a signal.</h3>
          <div className="gap-demo" style={{ gap: selected }}>
            <Button>Save project</Button>
            <Button variant="outline">Cancel</Button>
          </div>
          <p>
            Notice when these two actions stop reading as a group. 8px is a
            useful starting point between related buttons.
          </p>
        </article>
        <article className="paper-card">
          <div className="section-label">PADDING ≠ MARGIN ≠ GAP</div>
          <h3>Three different jobs.</h3>
          <div className="box-model">
            <span>margin: outside the box</span>
            <div>
              <span>padding: inside the box</span>
              <b>Content</b>
            </div>
          </div>
          <p>
            Gap is space between siblings in a flex or grid container. Don’t add
            margins to every child and accidentally double the spacing.
          </p>
        </article>
      </div>
      <div className="reference-table">
        {spacing.map((token) => (
          <div key={token.value}>
            <code>space-{token.value / 4}</code>
            <b>{token.value}px</b>
            <span>{token.usage}</span>
          </div>
        ))}
      </div>
      <div className="rule-note">
        <Ruler />
        <p>
          <b>Typography has its own rhythm.</b> Try 12/16px for metadata,
          14/20px for UI labels, 16/24px for body copy, and 24/32px for section
          titles. The second number is line height. Keep longer prose around
          45–75 characters per line.
        </p>
      </div>
    </section>
  );
}

function LayoutLab() {
  const [pattern, setPattern] = useState<Pattern>("dashboard");
  const [columns, setColumns] = useState(12);
  const [gutter, setGutter] = useState(16);
  const [padding, setPadding] = useState(24);
  const [grid, setGrid] = useState(false);
  const [guides, setGuides] = useState(true);
  const [compact, setCompact] = useState(false);
  const [selectedAnatomy, setSelectedAnatomy] = useState(0);
  const [copied, setCopied] = useState(false);
  const active = patterns.find((item) => item.id === pattern) ?? patterns[0];
  const region = anatomy[selectedAnatomy];
  const code = `/* Shell regions are independent of the content grid. */\n.window { display: grid; grid-template-rows: 36px 1fr 28px; }\n.workspace { display: grid; grid-template-columns: 160px minmax(0, 1fr); }\n.content { padding: ${padding}px; min-width: 0; }\n.cards {\n  display: grid;\n  grid-template-columns: repeat(${columns}, minmax(0, 1fr));\n  gap: ${gutter}px;\n}\n.card { grid-column: span ${Math.floor(columns / 3)}; }\n.card:last-child { grid-column: span ${columns - 2 * Math.floor(columns / 3)}; }\n.row { min-height: ${compact ? 36 : 48}px; }\n/* At narrow widths, recompose panels rather than shrinking text. */`;
  function reset() {
    setColumns(12);
    setGutter(16);
    setPadding(24);
    setGrid(false);
    setGuides(true);
    setCompact(false);
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="section-label">THE LAYOUT LAB</span>
          <h2>Every window has a blueprint.</h2>
        </div>
        <span className="muted desktop-note">
          <MousePointer2 size={14} /> Explore. Adjust. Understand.
        </span>
      </div>
      <div className="pattern-picker">
        {patterns.map((item, i) => (
          <button
            key={item.id}
            aria-label={item.name}
            aria-pressed={pattern === item.id}
            onClick={() => setPattern(item.id)}
          >
            <div className={`mini-layout mini-${item.id}`}>
              <i />
              <div>
                {Array.from({ length: i === 0 ? 6 : 3 }, (_, j) => (
                  <span key={j} />
                ))}
              </div>
            </div>
            <div>
              <b>{item.name}</b>
              <small>{item.short}</small>
            </div>
            {pattern === item.id && <span className="selected-dot" />}
          </button>
        ))}
      </div>
      <div className="lab">
        <div className="canvas-column">
          <Tabs defaultValue="preview">
            <div className="canvas-toolbar">
              <TabsList>
                <TabsTrigger value="preview">
                  <Monitor /> Preview
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Code2 /> CSS recipe
                </TabsTrigger>
              </TabsList>
              <span className="mono muted">
                LIVE SPECIMEN <span className="green-dot" />
              </span>
            </div>
            <TabsContent value="preview">
              <div className="canvas-surface">
                <div className="canvas-caption">
                  <span>
                    <Monitor size={13} /> DESKTOP APPLICATION
                  </span>
                  <span>Mock data · CSS pixels</span>
                </div>
                <div
                  className="mock-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Scrollable desktop layout example"
                >
                  <MockWindow
                    pattern={pattern}
                    columns={columns}
                    gutter={gutter}
                    padding={padding}
                    grid={grid}
                    guides={guides}
                    compact={compact}
                  />
                </div>
                <div className="canvas-legend">
                  <span>
                    <i className="legend-line" /> Shell regions
                  </span>
                  <span>
                    <i className="legend-square" /> Content grid
                  </span>
                  <span>Fixed shell · fluid workspace</span>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="code">
              <div className="code-panel">
                <div>
                  <p>
                    This recipe reproduces the shell and dashboard grid. Use the
                    selected pattern’s composition inside it.
                  </p>
                  <Button size="sm" variant="outline" onClick={copyCode}>
                    <Copy />
                    {copied ? "Copied" : "Copy CSS"}
                  </Button>
                </div>
                <pre>
                  <code>{code}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="inspector" aria-label="Layout controls">
          <div className="inspector-title">
            <span>
              <SlidersIcon /> Inspector
            </span>
            <button
              aria-label="Reset controls"
              title="Reset controls"
              onClick={reset}
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <section>
            <div className="section-label">MAKE THE INVISIBLE VISIBLE</div>
            <label className="switch-row" htmlFor="grid-switch">
              <span>
                <Columns3 size={15} /> Column grid
              </span>
              <Switch
                id="grid-switch"
                checked={grid}
                onCheckedChange={setGrid}
              />
            </label>
            <label className="switch-row" htmlFor="guides-switch">
              <span>
                <Frame size={15} /> Region labels
              </span>
              <Switch
                id="guides-switch"
                checked={guides}
                onCheckedChange={setGuides}
              />
            </label>
          </section>
          <section>
            <div className="section-label">CONTENT GRID</div>
            <label className="select-row">
              Columns
              <select
                aria-label="Columns"
                value={columns}
                onChange={(event) => setColumns(Number(event.target.value))}
              >
                {[12, 10, 8, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="select-row">
              Gutter
              <select
                aria-label="Gutter"
                value={gutter}
                onChange={(event) => setGutter(Number(event.target.value))}
              >
                {[8, 16, 24, 32].map((n) => (
                  <option key={n} value={n}>
                    {n}px
                  </option>
                ))}
              </select>
            </label>
            <label className="select-row">
              Content padding
              <select
                aria-label="Content padding"
                value={padding}
                onChange={(event) => setPadding(Number(event.target.value))}
              >
                {[16, 24, 32, 48].map((n) => (
                  <option key={n} value={n}>
                    {n}px
                  </option>
                ))}
              </select>
            </label>
            <div
              className="grid-mini"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {Array.from({ length: columns }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <p className="tiny">
              {columns} columns · {gutter}px gutters
              <br />
              The grid lives inside the workspace.
            </p>
          </section>
          <section>
            <div className="section-label">DENSITY</div>
            <div className="segmented">
              <button aria-pressed={!compact} onClick={() => setCompact(false)}>
                Comfortable
              </button>
              <button aria-pressed={compact} onClick={() => setCompact(true)}>
                Compact
              </button>
            </div>
            <p className="tiny">
              {compact
                ? "36px rows · 32px controls"
                : "48px rows · 36px controls"}
              <br />
              Text stays the same size.
            </p>
          </section>
          <div className="inspector-tip">
            <Sparkles size={16} />
            <p>
              Change one value at a time.
              <br />
              <b>Look for the relationship.</b>
            </p>
          </div>
        </aside>
      </div>
      <div className="pattern-explanation">
        <div className="number-stamp">01</div>
        <div>
          <h3>{active.rule}</h3>
          <p>{active.use}</p>
        </div>
        <Badge variant="outline">Pattern, not prescription</Badge>
      </div>
      <div className="anatomy-section">
        <div className="section-heading">
          <div>
            <span className="section-label">READ THE RELATIONSHIPS</span>
            <h2>The anatomy of a window.</h2>
          </div>
          <span className="tiny">Select a region to unpack the rule</span>
        </div>
        <div className="anatomy-tabs">
          {anatomy.map((item, i) => (
            <button
              key={item.name}
              aria-pressed={selectedAnatomy === i}
              onClick={() => setSelectedAnatomy(i)}
            >
              <span className="mono">0{i + 1}</span>
              <b>{item.name}</b>
              <code>{i === 3 ? `${padding}px` : item.value}</code>
            </button>
          ))}
        </div>
        <div className="anatomy-detail">
          <PanelLeft size={20} />
          <p>
            <b>{region.name}.</b> {region.detail}
          </p>
        </div>
      </div>
      <div className="two-up">
        <article className="paper-card grid-lesson">
          <div className="section-label">FROM PRINT TO PIXELS</div>
          <h3>Yes, desktop apps have grids.</h3>
          <p>
            But the entire window is rarely one 12-column page. Think of the
            shell as the frame, then compose the content inside it.
          </p>
          <div className="grid-equation">
            <span>Navigation</span>
            <b>+</b>
            <span>Flexible content grid</span>
            <b>+</b>
            <span>Inspector</span>
          </div>
          <p>
            <b>12 columns:</b> halves, thirds, quarters, sixths.
            <br />
            <b>10 columns:</b> halves and fifths. Choose for your content.
          </p>
        </article>
        <article className="paper-card">
          <div className="section-label">A RULE WORTH KEEPING</div>
          <h3>Closer means connected.</h3>
          <div className="relationship-demo">
            <div>
              <span />
              <span />
              <small>8px within</small>
            </div>
            <ArrowRight size={18} />
            <div>
              <span />
              <span />
              <small>24px between</small>
            </div>
          </div>
          <p>
            Button icon to label: 8px. Related buttons: 8px. Separate action
            groups: 24px. The relationship matters more than any single number.
          </p>
        </article>
      </div>
    </>
  );
}

function SlidersIcon() {
  return <Ruler size={16} />;
}

/** Interactive UI workbook with local mock examples and a progressive curriculum. */
export default function App() {
  const [page, setPage] = useState<Page>("Layouts");
  const [lesson, setLesson] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  function openLesson(index: number) {
    setLesson(index);
    setPage("Learning path");
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="main-sidebar">
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            setPage("Layouts");
          }}
        >
          <span className="brand-mark">
            <Frame size={21} />
          </span>
          <span>
            interface<span className="brand-light"> / atlas</span>
          </span>
        </a>
        <div className="sidebar-subtitle">A field guide to thoughtful UI.</div>
        <div className="sidebar-label">YOUR WORKBENCH</div>
        <nav aria-label="Workbook">
          {pages.map((item) => (
            <button
              key={item.name}
              aria-current={page === item.name ? "page" : undefined}
              onClick={() => setPage(item.name)}
            >
              <item.icon size={17} />
              {item.name}
              {item.name === "Layouts" && <span className="nav-count">04</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-label curriculum-label">
          LEARN THE LANGUAGE <span>08</span>
        </div>
        <div className="curriculum-list">
          {["Beginner", "Intermediate", "Advanced", "Senior"].map(
            (level, i) => (
              <button key={level} onClick={() => openLesson(i * 2)}>
                <span className={`level-dot level-${i}`} />
                <div>
                  <b>{level}</b>
                  <small>
                    {
                      [
                        "Build your eye",
                        "Compose with intention",
                        "Design for real use",
                        "Think in systems",
                      ][i]
                    }
                  </small>
                </div>
                <ChevronRight size={13} />
              </button>
            ),
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="progress-caption">
            <span>Your field notes</span>
            <span>
              {completed.length} / {lessons.length}
            </span>
          </div>
          <div className="progress-track">
            <div
              style={{ width: `${(completed.length / lessons.length) * 100}%` }}
            />
          </div>
          <p>
            Small observations.
            <br />
            Better design decisions.
          </p>
          <div className="sidebar-footer">
            <span className="little-logo">ia</span>
            <span>
              Made for curious minds.
              <br />
              <small>Explore at your own pace.</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workbench</span>
            <ChevronRight size={13} />
            <b>{page}</b>
          </div>
          <div className="topbar-right">
            <span className="stack-label">
              BUN · REACT · TAILWIND · SHADCN/UI
            </span>
            <span className="edition">EDITION 001</span>
          </div>
        </header>
        <main id="main">
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span /> AN INTERACTIVE DESIGN FIELD GUIDE
              </div>
              <h1>
                A little structure.
                <br />
                <span>A lot of clarity.</span>
              </h1>
              <p>
                Learn the rules behind interfaces that feel right.
                <br className="desktop-break" /> Explore real layouts, reveal
                the spacing, and make it your own.
              </p>
              <button className="text-link" onClick={() => openLesson(0)}>
                Start with the fundamentals <ArrowUpRight size={16} />
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="art-ruler">
                8 <span>16</span> 24 <span>32</span> 48
              </div>
              <div className="art-window">
                <div />
                <section>
                  <aside />
                  <article>
                    <b />
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                    <p />
                    <p />
                    <p />
                  </article>
                </section>
              </div>
              <span className="art-callout">Everything has a place.</span>
              <div className="art-cross">+</div>
            </div>
          </section>
          <div className="page-tabs" aria-label="Sections">
            {pages.map((item) => (
              <button
                key={item.name}
                aria-label={`Open ${item.name}`}
                aria-current={page === item.name ? "page" : undefined}
                onClick={() => setPage(item.name)}
              >
                <item.icon size={16} />
                {item.name}
                {item.name === "Layouts" && <small>04</small>}
              </button>
            ))}
            <span className="page-tabs-note">
              LESS GUESSWORK. MORE INTENTION.
            </span>
          </div>
          {page === "Layouts" && <LayoutLab />}
          {page === "Live mode" && <LiveMode />}
          {page === "Spacing system" && <SpacingSystem />}
          {page === "Components" && <ComponentGallery />}
          {page === "Learning path" && (
            <LearningPath
              lessonIndex={lesson}
              setLessonIndex={setLesson}
              completed={completed}
              onComplete={(index) =>
                setCompleted((previous) =>
                  previous.includes(index) ? previous : [...previous, index],
                )
              }
            />
          )}
          <footer className="main-footer">
            <div>
              <span className="little-logo">ia</span>
              <span>Learn the rules. Then make them yours.</span>
            </div>
            <a
              href="https://fluent2.microsoft.design/layout"
              target="_blank"
              rel="noreferrer"
            >
              Fluent layout reference <ArrowUpRight size={13} />
            </a>
            <a
              href="https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html"
              target="_blank"
              rel="noreferrer"
            >
              WCAG target sizes <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
