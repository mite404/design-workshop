# Story: tests that let the look change and keep the shell working

Status: draft, Nov 11 2026, not yet confirmed by Ethan. Tickets: none yet. One is planned,
listed at the end.

**As** a designer tuning a mockup an agent has already built,
**I want** the tests to pass whatever look I save, and to fail when the shell stops working,
**so that** "Check and commit" (PRD R9) never blocks a design choice and still catches a break.

Ethan's request: "lets start rewriting the test suite. we can keep anything that's relevant to
the app shell being stable, but we need to start modifying tests to fit our more dynamic
purposes."

## What I found

Measured at `11084b2`. The suite is 120 test files and 13 story files, about 1180 tests as the
runner counts them: catalog 314, runtime 314, web 279, storybook 138 (the stories and the
catalog's browser tests), gateway 112, workbench 22, ui 5.

The look can change in two ways, and each can break different tests.

**1. Ethan saves a value in the Workbench.** The value goes into the override file
(`packages/catalog/src/overrides.css`) and nowhere else. Three things read that file:

- The app.
- The stories, through `apps/storybook/.storybook/preview.ts`. Each story's test renders it,
  runs its steps and checks accessibility, so a saved value takes part in 138 tests.
- `packages/workbench/src/overrides.test.ts`, which uses the live file as its example of an
  empty one. This is a bug. I put one value in the file and ran the package's tests: 1 of 22
  failed. The first value Ethan saves would block his own commit.

No other test reads the file. The node tests and the catalog's browser tests load the
Template's own stylesheets directly, so a saved value cannot reach them.

**2. An agent changes the Template's source in a preparation ticket** (ETH-101, ETH-104). This
breaks a test that writes a design number down. I searched every test file for pixel numbers,
colours and measured sizes. 15 files matched. Judged from the matching lines and the test
names, not a full read of each file, two tests pin a look:

- `packages/catalog/src/tokens.test.ts`, "the button radius ... is one token, 4px".
- `packages/catalog/src/WorkDetails.browser.test.tsx`, which expects 13px text on 20px lines
  under a 15px outcome.

The other 13 files use numbers for something else, and stay:

- Sums worked on the test's own numbers: `threadReveal.test.ts`, `gripZone.test.ts`,
  `sidebar-width.test.ts`, `lane-separator.test.ts`.
- Tests that bring their own styles to measure against: `carryGhost`, `carry`, `ComposeBox`
  and `grabbable`.
- Drawings that must land on whole pixels: `AgentTree`, `AgentWorking`.
- Numbers in comments only: `Turns`, `CardHeader`, `threadReveal.browser`.

The rest of `tokens.test.ts` checks contrast ratios and the shadow's direction. Those compare
two values, so they survive a change of either, and they guard readability.

So the rewrite is small. The suite already tests behaviour almost everywhere.

## Acceptance criteria

1. With values saved in the override file, every test that passed before still passes, unless
   a saved value makes text unreadable or a control unusable in a story. That failure is
   wanted: it is what "Check and commit" is for.
2. No test writes down a design number that the Workbench or a preparation ticket can change.
   A test compares two values, or checks that a rule uses its named value.
3. No test reads the live override file. A test of the file's reader and writer brings its own
   text.
4. Every test of what the shell does stays: the mocked agent loop, the gateway, routing,
   dragging, scrolling, the sidebar and the composer.
5. Each Workbench ticket brings the tests for its own code, as ETH-100 did.

## Keep, change, drop

- Keep: everything except the three tests below. About 1180 tests.
- Change: three tests.
  - `overrides.test.ts` brings its own empty file.
  - The button radius test checks that every button takes its corners from the one named
    value, and no longer says the value is 4px.
  - The `WorkDetails` test checks that the lines are smaller than the outcome, and no longer
    says 13px and 15px.
- Drop: nothing more. The drift tool's 109 tests and the seal's test went with the drift tool
  (ADR-020). The onboarding flow has no tests of its own.

## Not in this story

- The tests that time out when the whole suite runs on 2 CPUs, and running the tests on every
  push. A build thread is doing both.
- Comparing screenshots against approved ones. Dropped, ADR-020.
- A warning inside the Workbench when a saved colour is hard to read. Today that would show
  only as a failed story test at "Check and commit". Add it with the colour story.

## Decisions that are mine, for Ethan to confirm

- The stories keep running on the saved values. Rejected: running them on the Template's
  untouched values, which would make every test blind to what Ethan saved, and "Check and
  commit" would check nothing.
- No new kind of test and no new tool. Rejected: a full rewrite, because I found three tests
  that need it.

## Effect on other tickets

- ETH-104 changes the two sizes in the `WorkDetails` test to 12px and 14px. If this story's
  ticket lands first, ETH-104 leaves that test alone. I will amend ETH-104 either way.
- ETH-101 is being built now and may touch the button radius test. The ticket here is written
  after ETH-101 lands, against what it left.

## Planned ticket

1. Fix the three tests (small). Needs nothing. Best built before ETH-104.
