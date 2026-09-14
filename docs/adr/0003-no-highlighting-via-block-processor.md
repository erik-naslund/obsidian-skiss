# ADR-0003 — Syntax highlighting is never done through the code block processor

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Erik

## Context

The obvious way to colour a `skiss` block is to have the code block processor replace it with highlighted markup. In Live Preview that replaces the editable block with rendered HTML, so the user can no longer type in it. The whole point of Skiss is typing while someone talks.

## Decision

The code block processor renders only the diagram and the diagnostics. Syntax highlighting, if and when it is added, is a CodeMirror 6 extension that decorates the editor text in place. It is a separate milestone.

## Consequences

- Milestone 1 ships with no highlighting.
- The `skiss` package's AST carries column ranges for every token, which is what a CodeMirror decoration needs. Nothing here has to re-parse.

## Alternatives considered

- **Highlight in the processor.** Rejected: breaks editing in Live Preview.
- **A CodeMirror language mode written from scratch.** Deferred, not rejected. It duplicates the parser unless it consumes the package's AST, which is the plan when the milestone arrives.
