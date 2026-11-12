# Story: save, export and load a project's look

Status: drafted Nov 12 2026 from PRD section 11 (start the next project in minutes from a
previous project's look) and the [portability plan](../../research/project-portability-plan.md).
Needs the project contract (phase 2) built first.

**Boundary.** Loading runs only the contract's validator. No agent, LLM or network call takes
part in checking or accepting a project file.

## 1. Export a project file

**As** a designer finishing a look,
**I want** to export it as one file,
**so that** another copy of the Template can start from it.

1. Export writes one JSON file: the format and its version, the manifest (Storybook version,
   index format, shell kind, components with their stories, surfaces) and the override file's
   values.
2. The export passes the validator in this repo.
3. Export is available from the Workbench and the command line, and writes nothing in the repo.

## 2. Check a project file before loading it

**As** a designer opening someone's look,
**I want** a checklist of what the file has and lacks before anything changes,
**so that** I never load a project that does not fit this Template.

1. Choosing a file shows each contract item as passed or failed, with the failure's code and
   path, without writing anything.
2. A file pinned to any Storybook version but 10.6.0 is refused, naming both versions.
3. A file missing a required slot, component or story is refused, naming each item.
4. The same file always gives the same checklist, in the Workbench and on the command line.

## 3. Load a checked project file

**As** a designer starting a new project from an old look,
**I want** to load a valid project file into the override file,
**so that** the running app takes on that look at once.

1. Load is only possible after the check passes.
2. Loading replaces the override file's values with the file's, through the normal save path,
   as one step of undo. Discard still restores the committed file.
3. Values whose selectors match nothing are listed as today (ADR-012), not dropped.
4. Nothing but the override file is written.
