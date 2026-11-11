import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { Change } from "./history";
import { parseOverrides } from "./overrides.ts";

export type CommitPreview = {
  head: string;
  source: string;
  changes: Change[];
  message: string;
};
export type CommitEvent =
  | { kind: "checking"; command: string }
  | { kind: "committing" }
  | { kind: "success"; hash: string }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

const running = new Set<string>();
const CHECKS = [
  ["pnpm", "typecheck"],
  ["pnpm", "test"],
];
const git = (file: string, ...args: string[]) =>
  execFileSync("git", args, { cwd: dirname(file), encoding: "utf8" });
const interrupt = () => process.exit(130);
const terminate = () => process.exit(143);

/** Whether this file is being checked or committed, so other Workbench writes must wait. */
export const committing = (file: string): boolean => running.has(file);

/** Changed values in file order, with null representing an addition or removal.
 * @throws When either stylesheet is not a Workbench override file.
 */
export function valueDiff(before: string, after: string): Change[] {
  const old = parseOverrides(before);
  const now = parseOverrides(after);
  return [...new Set([...old.keys(), ...now.keys()])].flatMap((selector) =>
    [...new Set([...(old.get(selector)?.keys() ?? []), ...(now.get(selector)?.keys() ?? [])])]
      .map((name) => ({
        selector,
        name,
        before: old.get(selector)?.get(name) ?? null,
        after: now.get(selector)?.get(name) ?? null,
      }))
      .filter((c) => c.before !== c.after),
  );
}

function wrap(line: string): string {
  return (
    line
      .match(/.{1,70}(?:\s|$)|.{1,70}/g)
      ?.map((s, i) => `${i === 0 ? "- " : "  "}${s.trim()}`)
      .join("\n") ?? ""
  );
}

/** A short style subject and one 72-column bullet per reviewed value. */
export function commitMessage(changes: Change[]): string {
  const first = changes[0];
  const subject =
    changes.length === 1 && first !== undefined
      ? `style: tune ${first.name.replace(/^--/, "")} on ${first.selector}`
      : `style: tune ${changes.length} design values`;
  return `${subject.length <= 50 ? subject : `${subject.slice(0, 47)}...`}\n\n${changes
    .map((c) =>
      wrap(`${c.name} on ${c.selector}: ${c.before ?? "added"} -> ${c.after ?? "removed"}`),
    )
    .join("\n")}\n`;
}

/** Reads the HEAD and disk snapshot the designer will review.
 * @throws When Git or the override file cannot be read or parsed.
 */
export function previewCommit(file: string): CommitPreview {
  const head = git(file, "rev-parse", "HEAD").trim();
  const source = readFileSync(file, "utf8");
  const changes = valueDiff(git(file, "show", `${head}:./${basename(file)}`), source);
  return { head, source, changes, message: commitMessage(changes) };
}

function refuse(file: string, preview: Pick<CommitPreview, "head" | "source">): void {
  const path = git(file, "ls-files", "--full-name", "--", basename(file)).trim();
  const staged = git(file, "diff", "--cached", "--name-only", "-z")
    .split("\0")
    .filter((p) => p !== "" && p !== path);
  if (staged.length > 0) throw new Error(`Unstage these files first:\n${staged.join("\n")}`);
  if (
    git(file, "rev-parse", "HEAD").trim() !== preview.head ||
    readFileSync(file, "utf8") !== preview.source
  ) {
    throw new Error("The override file or last commit changed. Review the diff again.");
  }
}

// ponytail: POSIX groups cannot catch descendants that start their own session, or parent SIGKILL.
// Use a supervisor/cgroup if arbitrary checks need stronger process containment.
async function check(cwd: string, command: string[], signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const [executable, ...args] = command;
  if (executable === undefined) throw new Error("empty check command");
  await new Promise<void>((resolve, reject) => {
    let tail = "";
    const child = spawn(executable, args, {
      cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const abort = () => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          /* Already exited. */
        }
      }
    };
    process.once("exit", abort);
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    signal.addEventListener("abort", abort, { once: true });
    const collect = (chunk: Buffer) => {
      tail = `${tail}${String(chunk)}`.slice(-8000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code) => {
      process.removeListener("exit", abort);
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
      signal.removeEventListener("abort", abort);
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else reject(new Error(`${command.join(" ")} failed\n${tail}`));
    });
  });
}

function verifyCommit(file: string, reviewed: Pick<CommitPreview, "head" | "source">): void {
  const path = git(file, "ls-files", "--full-name", "--", basename(file)).trim();
  const changed = git(file, "diff", "--name-only", "-z", reviewed.head, "HEAD");
  if (
    changed !== `${path}\0` ||
    git(file, "rev-parse", "HEAD^").trim() !== reviewed.head ||
    git(file, "show", `HEAD:./${basename(file)}`) !== reviewed.source
  ) {
    throw new Error(
      "Commit was created but failed verification: its files, parent or override bytes differ. " +
        "Inspect git log and git status before continuing. Nothing was rolled back.",
    );
  }
}

/** Checks and commits only the reviewed override file, never pushes. Emits the final outcome.
 * Hooks run normally. Post-commit verification reports unexpected files or bytes as an error.
 * Cancellation terminates checks; once Git starts, its separate timeout bounds hooks and signing.
 */
export async function commitLook(
  file: string,
  reviewed: Pick<CommitPreview, "head" | "source">,
  emit: (event: CommitEvent) => void,
  signal: AbortSignal,
  checks = CHECKS,
  commitTimeout = 120_000,
): Promise<void> {
  if (running.has(file)) {
    emit({ kind: "error", message: "A commit is already running." });
    return;
  }
  running.add(file);
  let startedCommit = false;
  try {
    refuse(file, reviewed);
    const preview = previewCommit(file);
    if (preview.changes.length === 0) throw new Error("No design values changed.");
    const cwd = git(file, "rev-parse", "--show-toplevel").trim();
    for (const command of checks) {
      emit({ kind: "checking", command: command.join(" ") });
      // oxlint-disable-next-line no-await-in-loop -- stop at the first failed check
      await check(cwd, command, signal);
    }
    signal.throwIfAborted();
    refuse(file, reviewed);
    startedCommit = true;
    emit({ kind: "committing" });
    await check(
      dirname(file),
      ["git", "commit", "--only", "-m", preview.message, "--", basename(file)],
      AbortSignal.timeout(commitTimeout),
    );
    verifyCommit(file, reviewed);
    emit({ kind: "success", hash: git(file, "rev-parse", "--short", "HEAD").trim() });
  } catch (error) {
    emit(
      signal.aborted && !startedCommit
        ? { kind: "cancelled" }
        : {
            kind: "error",
            message: `${startedCommit ? "Git ran. Inspect git log and status before retrying. " : ""}${error instanceof Error ? error.message : String(error)}`,
          },
    );
  } finally {
    running.delete(file);
  }
}
