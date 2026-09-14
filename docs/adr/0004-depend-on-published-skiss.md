# ADR-0004 — Depend on the published `skiss` package; no language logic here

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Erik

## Context

The plugin needs to parse Skiss, produce diagnostics, generate Mermaid and generate LinkML. All of that exists in the `skiss` npm package. Copying any of it here would create a second implementation of the language that drifts from the first.

## Decision

- The plugin depends on `skiss` as a normal npm dependency and pins a published version in every release.
- No parsing, diagnostics, or generation code lives in this repository. If rendering needs something the package does not expose, the package gets the feature first.
- During development a local link to an unpublished `skiss` build is allowed, but a release never ships one.

## Consequences

- A language change reaches users in two steps: publish the package, bump the plugin.
- This repository stays small enough to read in one sitting.
- Bugs in what is rendered are triaged by asking "is the Mermaid text right?" first. If it is, the bug is here; if not, it is in the package.

## Alternatives considered

- **Vendor the package source.** Rejected: drift, and two places to fix every bug.
- **A git submodule.** Rejected: a submodule of a library that is on npm anyway buys nothing and complicates the build.
