# ADR-0002 — Render with Obsidian's bundled Mermaid, never a bundled copy

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Erik

## Context

Obsidian ships Mermaid and exposes it to plugins through `loadMermaid()`. Bundling a second copy would add megabytes to `main.js`, risk two Mermaid versions with different rendering, and is discouraged in the community plugin review.

## Decision

The plugin calls `loadMermaid()` and renders with whatever Mermaid Obsidian provides. No Mermaid dependency in `package.json`.

## Consequences

- Diagram appearance follows Obsidian's Mermaid version. A rendering difference between Obsidian versions is not a plugin bug.
- `main.js` stays small.
- The Mermaid text the `skiss` package produces must stay within the class-diagram syntax Obsidian's Mermaid supports; the package's fixtures are checked against it.

## Alternatives considered

- **Bundle Mermaid.** Rejected for size and duplication.
- **Render to SVG in the `skiss` package.** Rejected: the package is a compiler, not a renderer, and would take on a rendering dependency for one host.
