# Story: a component's design conversation is still there when Ethan comes back to it

Status: planned Nov 12 2026 at commit `d49c989`. Ethan: go. Roadmap: PRD section 10, block 12;
requirement R19.

**As** a designer working on one component at a time,
**I want** its chat to stay with it,
**so that** I can pick up where I left off without re-explaining the change.

## Decisions

- One chat per component, keyed by its `data-wb` name. Several chats per component and a thread
  picker are deferred (Ethan, Nov 12 2026).
- Stored in the browser's localStorage. PRD section 16 lets the Workbench write only the override
  file and themes into a host's `.workbench/`, so a chat file there would need Ethan's decision.
- Live mode keeps today's unsaved chat; R19 names Component mode only.

## Plan

Each ticket is one commit, verified and pushed before the next starts.

1. **One chat per component** (ETH-154). In Component mode the chat's messages belong to the open
   component, swap when another opens, and survive a reload. A restored reference resolves by its
   selector, else shows as unresolved.
2. **Docked at the canvas's right** (ETH-155). In Component mode the panel sits full height at
   the canvas's right edge, open and titled with the component; Live mode keeps the bottom-right
   panel.

## Completion checklist

- [ ] A message sent on one component is back after opening another and returning, and after a
      reload (ETH-154).
- [ ] Component mode shows the docked panel named for its component; Live mode does not
      (ETH-155).
- [ ] Gates pass at each commit; each ticket is Done in Linear with its commit linked.
