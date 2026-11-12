---
name: verifying-workbench
description: >-
  Verifies Design Workshop changes with its existing CLI, browser checks and stories.
  Use after changing the Template, Workbench, design values or their persistence.
---

# Verify the Workbench

Use the existing checks, not a new driver. Read [the feature map](features/README.md), select the
affected journeys, and report each as passed, failed or not exercised. Shared changes in
`packages/workbench`, `packages/ui`, catalog tokens or the browser harness need the full browser
suite. This map covers current scripted journeys, not every screen or possible design.

## Gate

From the repository root, run these sequentially before launching Chromium:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm fallow
pnpm test
```

These run in `.github/workflows/ci.yml`, along with `pnpm test:browser`, `pnpm build` and
`pnpm build-storybook`. Build changes need both build commands. OXC owns lint and formatting;
type-aware lint uses `oxlint-tsgolint`, but does not replace `pnpm typecheck`.
`pnpm fallow` checks configured complexity thresholds. Optional `pnpm fallow:audit --base HEAD`
asks about uncommitted changes relative to HEAD; it is not the CI command or a branch-wide audit.
The repo installs no hooks (ADR-016). Machine-global hooks may exist; do not assume they enforce
these tiers. Do not rerun a tier solely to duplicate a recorded pass on the same source snapshot.

## Launch

Use Node 26 and pnpm 10.33.0. `.agents/setup` installs locked dependencies and Playwright Chromium.
No credentials, gateway or live model are needed for the normal mocked design session.

Browser scripts write real files. Use a disposable snapshot containing the change under test,
including unstaged changes and untracked source. From the working repository root:

```sh
SOURCE="$PWD"
RUN=$(mktemp -d /tmp/workbench-verify.XXXXXX)
OUT="$SOURCE/.amp/in/artifacts/verify-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
git status --porcelain=v1 > "$OUT/source-status.txt"
git clone --quiet --shared "$SOURCE" "$RUN"
git diff HEAD --binary | git -C "$RUN" apply --allow-empty
git ls-files --others --exclude-standard -z | tar --null -T - -cf - | tar -xf - -C "$RUN"
git rev-parse HEAD > "$OUT/source-head.txt"
git diff HEAD --binary > "$OUT/source.patch"
cp "$RUN/.workbench/overrides.css" "$OUT/candidate-overrides.css"
pnpm --dir "$RUN" install --offline --frozen-lockfile
```

If the offline install lacks a package, use `pnpm --dir "$RUN" install --frozen-lockfile`.
Keep `SOURCE`, `RUN` and `OUT` for this run. Separate shell calls must recover their actual values,
not create a second snapshot. Secrets and ignored local configuration are intentionally not copied.

In an Amp orb, start a supervised service with the shell tool's working directory set to `$RUN`:

```sh
amp orb service start verify-workbench \
  --command 'pnpm --filter web exec react-router dev --host 0.0.0.0 --port 5173 --strictPort' \
  --port 5173 --portal
```

Run one verification session at a time. If that service or port is already in use, do not stop or
reuse it unless this run owns it. Outside an orb, run the same dev command in a dedicated foreground
terminal and stop that process after testing. Share only the portal URL printed by Amp, not
localhost.

## Doctor

In an orb, `amp orb service status verify-workbench` must show an active process whose command
and home directory identify this snapshot. Then run:

```sh
curl -fsS http://localhost:5173/__workbench/ | grep -F '<title>Workbench</title>'
pnpm --dir "$RUN" workbench check
```

Require the title and `Override file is valid.`. A 200 response alone is not readiness. The first
browser journey must also reach the framed app. If it fails, keep the error and service log rather
than treating a healthy HTML response as a successful app check.

## Drive

Run mapped scripts from `$RUN`, sequentially, with their normal production code paths. They use
the repo's Playwright browser in `apps/web/scripts/harness.mjs`; no new browser package is needed.
The Workbench opens at `/__workbench/`; its app is in an iframe. Interactive follow-up uses the
`using-agent-browser` skill and stable roles or the selectors in the matching script.

Inspect the candidate design before changing its fixtures. Preserve its overrides in `$OUT`.
For the baseline browser suite only, initialize the **disposable copy's** override file:

```sh
printf '%s\n' '/* Written by the Workbench. One design value per line. Do not edit by hand. */' \
  ':root {' '}' \
  > "$RUN/.workbench/overrides.css"
```

For a radius change, for example, run from `$RUN`:

```sh
node apps/web/scripts/corner-radius-check.mjs --base http://localhost:5173 --out "$OUT/radius"
```

Require `7 of 7 steps passed`, exit 0, and inspect the screenshots. For full coverage, run
`pnpm test:browser` from `$RUN`; capture its output and copy `.artifacts/` into `$OUT` even on
failure. Its final git-diff guard assumes the committed override file is the empty fixture. If HEAD
contains a saved design, report that unmet precondition separately; do not change HEAD to pass it.

Baseline fixtures do not verify the candidate's saved design. Restore `candidate-overrides.css`
only in `$RUN`, then inspect the affected screens, states and component stories with those values.
Use the feature story under `docs/feature/`, or `docs/done/` once built, as the expected behavior.
A layout that intentionally changed is not a failure just because it differs from an old
screenshot (ADR-020).

## Evidence

Save commands, stdout/stderr, exit codes, the source revision and tested changes in `$OUT`.
Capture the user action and its result, computed styles or accessibility state, and the
corresponding file change. A successful CLI write does not prove the app rendered it.
`workbench check` validates only the override file, not types, tests or layout. Preserve
refusal/error cases as well as success.

Inspect screenshots before citing them. For changed pointer or keyboard behavior, record and inspect
the interaction; spacing and reference scripts accept `--video`, or use agent-browser recording.
State which browser was used. Chromium does not establish Safari font rendering; type changes need
the Safari check required by the PRD, or an explicit report that it remains unverified.

When adding or changing a verification assertion, break its covered behavior in the disposable
snapshot, observe the check fail, restore that scratch change and observe it pass. Do not weaken an
expectation to hide a product failure. Current commands establish their stated cases, not formal
verification or a guarantee that all screens remain correct.

## Cleanup

Run `amp orb service stop verify-workbench` with the shell tool's working directory set to `$RUN`.
Amp scopes service commands to their originating directory; a stop from `$SOURCE` does not stop this
service. Require a successful stop before deleting the snapshot. Copy any remaining `.artifacts/`
evidence into `$OUT`, restore no files in `$SOURCE`, and remove only the disposable `$RUN` directory
from a shell whose working directory is `$SOURCE`. Confirm `$OUT` still contains logs and
screenshots after cleanup. Compare the source's status with its starting status; retain all
pre-existing edits.

## Maintenance

Update the map when user paths, scripts or expected behavior change. Use
`/maintain-verification-skill` for a broader refresh. Do not mark a script's other entry points
verified merely because one convenient path passed.
