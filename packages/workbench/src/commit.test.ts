import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { commitLook, previewCommit, valueDiff, commitMessage, type CommitEvent } from "./commit";

const folders: string[] = [];
const css = (body: string) => `:root {\n${body}}\n`;
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const pass = [[process.execPath, "-e", "process.exit(0)"]];

function repo(): { folder: string; file: string } {
  const folder = mkdtempSync(join(tmpdir(), "wb-commit-"));
  folders.push(folder);
  git(folder, "init", "-q");
  git(folder, "config", "user.name", "Test");
  git(folder, "config", "user.email", "test@example.com");
  const file = join(folder, "overrides.css");
  writeFileSync(file, css("  --window-radius: 12px;\n"));
  writeFileSync(join(folder, "other.txt"), "original");
  git(folder, "add", ".");
  git(folder, "commit", "-qm", "initial");
  writeFileSync(file, css("  --window-radius: 18px;\n"));
  return { folder, file };
}

function hook(folder: string, name: string, source: string): void {
  const hooks = join(folder, "hooks");
  mkdirSync(hooks, { recursive: true });
  git(folder, "config", "core.hooksPath", hooks);
  writeFileSync(join(hooks, name), `#!/bin/sh\n${source}\n`, { mode: 0o755 });
}

afterEach(() => folders.splice(0).forEach((f) => rmSync(f, { recursive: true, force: true })));

test("diff and message include additions, changes and removals, but not unchanged values", () => {
  const changes = valueDiff(
    css("  --window-radius: 12px;\n  --type-base: 16px;\n  --type-ratio: 1.2;\n"),
    css("  --window-radius: 18px;\n  --type-base: 16px;\n  --type-leading: 1.4;\n"),
  );
  expect(changes).toEqual([
    { selector: ":root", name: "--window-radius", before: "12px", after: "18px" },
    { selector: ":root", name: "--type-ratio", before: "1.2", after: null },
    { selector: ":root", name: "--type-leading", before: null, after: "1.4" },
  ]);
  const message = commitMessage(changes);
  expect(message).toContain("12px -> 18px");
  expect(message).toContain("1.2 -> removed");
  expect(message).toContain("added -> 1.4");
  expect(
    execFileSync("git", ["interpret-trailers"], { input: message, encoding: "utf8" }).trimEnd(),
  ).toBe(message.trimEnd());
  expect(
    execFileSync(
      "git",
      ["interpret-trailers", "--trailer", "Co-authored-by: Test <test@example.com>"],
      {
        input: message,
        encoding: "utf8",
      },
    ),
  ).toBe(`${message}\nCo-authored-by: Test <test@example.com>\n`);
  const long = commitMessage([
    { selector: "a".repeat(150), name: "gap", before: "2px", after: "8px" },
  ]);
  expect(long.split("\n")[0]?.length).toBeLessThanOrEqual(50);
  expect(long.split("\n").every((line) => line.length <= 72)).toBe(true);
});

test("commits only the reviewed override and preserves unrelated edits and index", async () => {
  const { folder, file } = repo();
  writeFileSync(join(folder, "other.txt"), "unsaved elsewhere");
  const preview = previewCommit(file);
  const events: CommitEvent[] = [];
  await commitLook(file, preview, (e) => events.push(e), new AbortController().signal, pass);
  expect(git(folder, "show", "--format=", "--name-only", "HEAD")).toBe("overrides.css");
  expect(readFileSync(join(folder, "other.txt"), "utf8")).toBe("unsaved elsewhere");
  expect(git(folder, "diff", "--cached", "--name-only")).toBe("");
  expect(events.at(-1)).toMatchObject({ kind: "success" });
});

test("reports a created commit as unsafe when a hook adds another file", async () => {
  const { folder, file } = repo();
  hook(folder, "pre-commit", "echo hooked > other.txt; git add other.txt");
  const events: CommitEvent[] = [];
  await commitLook(
    file,
    previewCommit(file),
    (e) => events.push(e),
    new AbortController().signal,
    pass,
  );
  expect(git(folder, "show", "--format=", "--name-only", "HEAD")).toContain("other.txt");
  expect(events.at(-1)).toMatchObject({ kind: "error" });
  expect(JSON.stringify(events.at(-1))).toContain("Commit was created but failed verification");
  expect(events.some((e) => e.kind === "success")).toBe(false);
});

test("detects an editor save after final validation but before Git reads the file", async () => {
  const { file } = repo();
  const events: CommitEvent[] = [];
  await commitLook(
    file,
    previewCommit(file),
    (e) => {
      events.push(e);
      if (e.kind === "committing") writeFileSync(file, css("  --window-radius: 22px;\n"));
    },
    new AbortController().signal,
    pass,
  );
  expect(events.at(-1)).toMatchObject({ kind: "error" });
  expect(JSON.stringify(events.at(-1))).toContain("Commit was created but failed verification");
  expect(events.some((e) => e.kind === "success")).toBe(false);
});

test("a hanging commit hook is bounded without blocking the event loop", async () => {
  const { folder, file } = repo();
  hook(folder, "pre-commit", "sleep 10");
  const events: CommitEvent[] = [];
  let responsive = false;
  const timer = setTimeout(() => {
    responsive = true;
  }, 10);
  try {
    await commitLook(
      file,
      previewCommit(file),
      (e) => events.push(e),
      new AbortController().signal,
      [],
      100,
    );
    expect(responsive).toBe(true);
    expect(events.at(-1)).toMatchObject({ kind: "error" });
    expect(JSON.stringify(events.at(-1))).toContain("Inspect git log and status");
    expect(git(folder, "log", "--oneline").split("\n")).toHaveLength(1);
  } finally {
    clearTimeout(timer);
  }
});

test("terminating the server also terminates its active check group", async () => {
  const { folder, file } = repo();
  const ready = join(folder, "check.pid");
  const command = `require('node:fs').writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 1000)`;
  const runner = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { commitLook, previewCommit } from ${JSON.stringify(new URL("./commit.ts", import.meta.url).href)};
    await commitLook(${JSON.stringify(file)}, previewCommit(${JSON.stringify(file)}),
      () => {}, new AbortController().signal, [[process.execPath, "-e", ${JSON.stringify(command)}]]);
  `,
    ],
    { stdio: "ignore" },
  );
  let pid: number | undefined;
  try {
    await expect.poll(() => existsSync(ready), { timeout: 10_000 }).toBe(true);
    pid = Number(readFileSync(ready, "utf8"));
    const exited = once(runner, "exit");
    runner.kill("SIGTERM");
    await exited;
    await expect
      .poll(() => {
        try {
          return execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" })
            .trim()
            .startsWith("Z");
        } catch {
          return true;
        }
      })
      .toBe(true);
    expect(git(folder, "log", "--oneline").split("\n")).toHaveLength(1);
  } finally {
    runner.kill("SIGTERM");
    if (pid !== undefined) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
  }
}, 15_000);

test("refuses other staged files before checks and preserves them", async () => {
  const { folder, file } = repo();
  const preview = previewCommit(file);
  writeFileSync(join(folder, "other.txt"), "staged");
  git(folder, "add", "other.txt");
  const events: CommitEvent[] = [];
  await commitLook(file, preview, (e) => events.push(e), new AbortController().signal, pass);
  expect(events).toEqual([{ kind: "error", message: "Unstage these files first:\nother.txt" }]);
  expect(git(folder, "diff", "--cached", "--name-only")).toBe("other.txt");
  expect(git(folder, "log", "--oneline").split("\n")).toHaveLength(1);
});

test("rechecks the snapshot and index after checks, not just before them", async () => {
  const { folder, file } = repo();
  const preview = previewCommit(file);
  const events: CommitEvent[] = [];
  await commitLook(
    file,
    preview,
    (e) => {
      events.push(e);
    },
    new AbortController().signal,
    [
      [
        process.execPath,
        "-e",
        "require('node:fs').appendFileSync('overrides.css', '/* external */\\n')",
      ],
    ],
  );
  expect(events.at(-1)?.kind).toBe("error");
  expect(JSON.stringify(events.at(-1))).toContain("changed");
  writeFileSync(file, preview.source);
  await commitLook(
    file,
    preview,
    (e) => {
      events.push(e);
    },
    new AbortController().signal,
    [
      [
        process.execPath,
        "-e",
        "require('node:fs').writeFileSync('other.txt', 'changed'); require('node:child_process').execFileSync('git', ['add', 'other.txt'])",
      ],
    ],
  );
  expect(events.at(-1)).toEqual({
    kind: "error",
    message: "Unstage these files first:\nother.txt",
  });
  expect(git(folder, "log", "--oneline").split("\n")).toHaveLength(1);
});

test("cancels an active process and refuses a second run while it is checking", async () => {
  const { folder, file } = repo();
  const preview = previewCommit(file);
  const controller = new AbortController();
  const events: CommitEvent[] = [];
  const pending = commitLook(
    file,
    preview,
    (e) => {
      events.push(e);
    },
    controller.signal,
    [[process.execPath, "-e", "setInterval(() => {}, 1000)"]],
  );
  const second: CommitEvent[] = [];
  await commitLook(
    file,
    preview,
    (e) => {
      second.push(e);
    },
    new AbortController().signal,
    pass,
  );
  expect(second).toEqual([{ kind: "error", message: "A commit is already running." }]);
  controller.abort();
  await pending;
  expect(events.at(-1)).toEqual({ kind: "cancelled" });
  expect(git(folder, "log", "--oneline").split("\n")).toHaveLength(1);
});

test("a failing check, cancellation and stale preview never commit", async () => {
  const { folder, file } = repo();
  const preview = previewCommit(file);
  const events: CommitEvent[] = [];
  await commitLook(file, preview, (e) => events.push(e), new AbortController().signal, [
    [process.execPath, "-e", "console.error('broken check'); process.exit(1)"],
  ]);
  expect(events.at(-1)?.kind).toBe("error");
  expect(JSON.stringify(events.at(-1))).toContain("broken check");
  const controller = new AbortController();
  await commitLook(
    file,
    preview,
    (e) => {
      events.push(e);
      if (e.kind === "checking") controller.abort();
    },
    controller.signal,
    pass,
  );
  expect(events.at(-1)).toEqual({ kind: "cancelled" });
  writeFileSync(file, css("  --window-radius: 22px;\n"));
  await commitLook(file, preview, (e) => events.push(e), new AbortController().signal, pass);
  expect(events.at(-1)?.kind).toBe("error");
  expect(JSON.stringify(events.at(-1))).toContain("changed");
  expect(git(folder, "log", "--oneline").split("\n")).toHaveLength(1);
});
