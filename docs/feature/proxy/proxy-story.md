# Story: `design-workshop dev` serves the Workbench in front of any dev server

Status: planned Nov 12 2026 at commit `0931795`. Ethan: go (PRD section 13). Roadmap: PRD
section 10, block 11; portability plan Phase 5, item 1. Architecture: ADR-043.

**Boundary.** The proxy forwards the host's own dev server untouched, apart from one `<link>` to
the override stylesheet in HTML responses. It needs no plugin, import or config change in the
host. It writes only the files the Vite plugin writes today.

## Plan

Each ticket is one commit, verified and pushed before the next starts.

1. **The proxy serves the Workbench** (ETH-147). `design-workshop dev --target <url>` starts one
   server: the Workbench's own Vite, in middleware mode under the base `/__workbench/`, the same
   endpoints the plugin answers, and every other request and websocket forwarded to the target.
   The plugin itself runs inside that Vite, so both paths share its code.
2. **The override stylesheet without an import** (ETH-148). HTML responses get a `<link>` to
   `/__workbench/overrides.css`; the Workbench refreshes it in the frame when the file changes.
3. **A host's own files** (ETH-149). The override file and themes come from the host's
   `.workbench/`; values a host has no baseline for are handled as ADR-043 records then.
4. **One path** (ETH-150). The browser suites pass through the proxy; this repo's dev command
   uses it and the Vite plugin is removed (PRD section 16, decided).

## Completion checklist

- [ ] `corner-radius-check` and `history-check` pass with `--base` at the proxy (ETH-147).
- [ ] A scratch Vite app with no override import shows a saved value through the proxy, and
      again after a reload (ETH-148).
- [ ] The scratch app's edits land in its `.workbench/overrides.css`, nothing else (ETH-149).
- [ ] `pnpm test:browser` passes against the proxy; the plugin is gone (ETH-150).
- [ ] Gates pass at each commit; each ticket is Done in Linear with its commit linked.
