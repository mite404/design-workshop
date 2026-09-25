import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Folder,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { lessons } from "./content";

/** Demonstrate real control states, field validation, menu spacing, and action hierarchy. */
export function ComponentGallery() {
  const [name, setName] = useState("Brand refresh");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const [menu, setMenu] = useState(false);
  const [menuMessage, setMenuMessage] = useState("");
  const [empty, setEmpty] = useState(true);
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="section-label">THE COMPONENT SHELF</span>
          <h2>Small pieces. Consistent decisions.</h2>
        </div>
        <Badge variant="outline">Built with shadcn/ui</Badge>
      </div>
      <p className="intro-copy">
        Try the controls. Tab through focus states. Each example names the
        spacing decisions you can carry into another interface.
      </p>
      <div className="component-grid">
        <article className="paper-card">
          <div className="section-label">01 / ACTIONS</div>
          <h3>Give one action the spotlight.</h3>
          <div className="component-stage">
            <Button
              onClick={() =>
                setFeedback("Primary action selected. Use one per task region.")
              }
            >
              <Plus /> New project
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setFeedback(
                  "Secondary action selected. Lower emphasis preserves hierarchy.",
                )
              }
            >
              Import
            </Button>
            <Button disabled>Unavailable</Button>
          </div>
          <div className="dimension-line">
            36px height · 12px inset with icon · 8px gap
          </div>
          <p>
            Primary, secondary, and disabled states. A disabled action should
            have an explanation nearby. This example is intentionally
            unavailable.
          </p>
          <div className="destructive-example">
            <Button
              variant="ghost"
              className="text-red-700"
              onClick={() =>
                setFeedback(
                  "Destructive action preview. A real irreversible delete needs a confirmation or undo.",
                )
              }
            >
              <Trash2 /> Delete project
            </Button>
            <span>Separate destructive actions.</span>
          </div>
        </article>
        <article className="paper-card">
          <div className="section-label">02 / FORMS + FEEDBACK</div>
          <h3>Keep the label with the field.</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const invalid = !name.trim();
              setError(invalid);
              setFeedback(
                invalid
                  ? "Enter a project name before saving."
                  : "Saved. Your mock project name has been updated.",
              );
            }}
          >
            <label className="field-label" htmlFor="project-name">
              Project name
            </label>
            <Input
              id="project-name"
              value={name}
              aria-invalid={error}
              aria-describedby="name-help"
              onChange={(event) => {
                setName(event.target.value);
                setError(false);
              }}
            />
            <p
              id="name-help"
              className={`field-help ${error ? "field-error" : ""}`}
            >
              {error
                ? "Enter a project name before saving."
                : "Use a name your team will recognize."}
            </p>
            <div className="form-actions">
              <Button type="submit">Save changes</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName("Brand refresh");
                  setError(false);
                  setFeedback("Form reset to the mock project.");
                }}
              >
                Reset
              </Button>
            </div>
          </form>
          <div className="dimension-line">
            8px label → field · 8px help · 24px → actions
          </div>
        </article>
        <article className="paper-card">
          <div className="section-label">03 / MENUS</div>
          <h3>Align the content, not just the boxes.</h3>
          <div className="menu-demo">
            <Button
              variant="outline"
              aria-expanded={menu}
              aria-controls="example-menu"
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal /> Project actions
            </Button>
            {menu && (
              <div id="example-menu" className="example-menu">
                {[
                  { name: "Open project", icon: Folder },
                  { name: "Duplicate project", icon: Copy },
                  { name: "Delete project", icon: Trash2 },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      setMenuMessage(
                        `${item.name} selected in this mock menu.`,
                      );
                      setMenu(false);
                    }}
                  >
                    <item.icon size={16} />
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            <p>{menuMessage || "Open the menu to inspect 36px rows."}</p>
          </div>
          <div className="dimension-line">
            4px container inset · 12px row inset · 8px icon gap
          </div>
          <p>
            This is a disclosure of ordinary buttons. Tab reaches every item.
            Use an ARIA menu with arrow-key behavior only when you implement
            that full interaction pattern.
          </p>
        </article>
        <article className="paper-card">
          <div className="section-label">04 / STATUS + EMPTY STATES</div>
          <h3>Say it with more than color.</h3>
          <div className="component-stage">
            <Badge className="bg-emerald-50 text-emerald-800">
              <CheckCircle2 /> Complete
            </Badge>
            <Badge className="bg-amber-50 text-amber-800">
              <Circle /> In review
            </Badge>
          </div>
          <div className="switch-row">
            <label htmlFor="empty-state">Show empty state</label>
            <Switch
              id="empty-state"
              checked={empty}
              onCheckedChange={setEmpty}
            />
          </div>
          <div className="empty-example">
            {empty ? (
              <>
                <Folder size={24} />
                <b>No assets yet</b>
                <p>Add the first file to start this collection.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmpty(false)}
                >
                  <Plus /> Add mock asset
                </Button>
              </>
            ) : (
              <>
                <CheckCircle2 size={24} />
                <b>brand-guidelines.pdf</b>
                <p>1 mock asset · ready for review</p>
              </>
            )}
          </div>
        </article>
      </div>
      <div role="status" className="feedback-bar">
        {feedback ||
          "Interactive examples use local state only. Nothing is sent to a server."}
      </div>
    </section>
  );
}

type LearningProps = {
  lessonIndex: number;
  setLessonIndex: (index: number) => void;
  completed: number[];
  onComplete: (index: number) => void;
};

function LessonBody({
  lessonIndex,
  setLessonIndex,
  completed,
  onComplete,
}: LearningProps) {
  const [answer, setAnswer] = useState<number | null>(null);
  const lesson = lessons[lessonIndex];
  const correct = answer === lesson.answer;
  return (
    <article className="lesson-body">
      <div className="lesson-kicker">
        <span className="section-label">{lesson.kicker}</span>
        <Badge variant="outline">{lesson.level}</Badge>
      </div>
      <h2>{lesson.title}</h2>
      <p className="lesson-prose">{lesson.body}</p>
      <blockquote>{lesson.rule}</blockquote>
      {lessonIndex === 0 && (
        <div
          className="lesson-diagram"
          aria-label="Related elements have small gaps; different groups have larger gaps"
        >
          <div>
            <span />
            <span />
            <small>RELATED</small>
          </div>
          <span className="diagram-arrow">← more space →</span>
          <div>
            <span />
            <span />
            <small>ANOTHER GROUP</small>
          </div>
        </div>
      )}
      <h3>Check your understanding.</h3>
      <p>{lesson.exercise}</p>
      <div className="quiz-options">
        {lesson.options.map((option, i) => (
          <button
            key={option}
            aria-label={option}
            aria-pressed={answer === i}
            className={answer === i ? (correct ? "correct" : "incorrect") : ""}
            onClick={() => {
              setAnswer(i);
              if (i === lesson.answer) onComplete(lessonIndex);
            }}
          >
            <span>
              {answer === i && correct ? (
                <Check size={14} />
              ) : (
                String.fromCharCode(65 + i)
              )}
            </span>
            {option}
          </button>
        ))}
      </div>
      {answer !== null && (
        <div
          role="status"
          className={`quiz-feedback ${correct ? "correct" : ""}`}
        >
          <b>{correct ? "Exactly." : "Try again."}</b>{" "}
          {correct
            ? lesson.explanation
            : "Consider the relationship, task, and constraints rather than treating a number as a universal rule."}
        </div>
      )}
      <div className="practice">
        <span className="section-label">NOW TRY IT</span>
        <p>{lesson.practice}</p>
      </div>
      <div className="lesson-navigation">
        <Button
          variant="outline"
          disabled={lessonIndex === 0}
          onClick={() => setLessonIndex(lessonIndex - 1)}
        >
          <ArrowLeft /> Previous
        </Button>
        <span>
          {completed.includes(lessonIndex)
            ? "Knowledge check complete"
            : "Choose an answer above"}
        </span>
        <Button
          disabled={lessonIndex === lessons.length - 1}
          onClick={() => setLessonIndex(lessonIndex + 1)}
        >
          Next lesson <ArrowRight />
        </Button>
      </div>
    </article>
  );
}

/** Present eight progressive lessons; successful knowledge checks update session progress once. */
export function LearningPath(props: LearningProps) {
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="section-label">YOUR LEARNING PATH</span>
          <h2>Build your eye. Then your judgment.</h2>
        </div>
        <span className="muted">
          {props.completed.length} of 8 checks complete · session only
        </span>
      </div>
      <div className="learning-layout">
        <nav aria-label="Lessons">
          {lessons.map((lesson, i) => (
            <button
              key={lesson.title}
              aria-current={props.lessonIndex === i ? "step" : undefined}
              onClick={() => props.setLessonIndex(i)}
            >
              <span>
                {props.completed.includes(i) ? (
                  <Check size={14} />
                ) : (
                  `0${i + 1}`
                )}
              </span>
              <div>
                <small>{lesson.level}</small>
                <b>{lesson.title}</b>
              </div>
            </button>
          ))}
        </nav>
        <LessonBody key={props.lessonIndex} {...props} />
      </div>
      <div className="rule-note">
        <p>
          <b>A starting course, not a shortcut to seniority.</b> Senior design
          judgment comes from observing people use your work, measuring
          outcomes, and revising the system. Use these lessons as a vocabulary
          and practice plan.
        </p>
      </div>
    </section>
  );
}
