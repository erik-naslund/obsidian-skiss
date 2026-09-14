# ADR-0001 — Distributed through Obsidian's community plugin list from this repository

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Erik

## Context

Users should find the plugin in Obsidian's community plugin browser. Obsidian reads `manifest.json` and `README.md` from the repository root, and installs `main.js`, `manifest.json` and `styles.css` from a GitHub release whose tag equals the version in the manifest. Plugin ids must be unique in the community list and must not contain "obsidian".

## Decision

- This repository holds only the plugin, with `manifest.json` and `versions.json` at the root and a README written for plugin users.
- Plugin id `skiss`, display name "Skiss".
- Releases are tagged with the bare version (`0.1.0`, not `v0.1.0`) and a GitHub Actions workflow builds and attaches the three assets.
- BRAT is the install path until the community submission is accepted.

## Consequences

- The plugin's version is independent of the `skiss` package's version.
- The README here is what Obsidian shows users. It describes the plugin, and links to the language.
- The release workflow is the release process. Nothing is uploaded by hand.

## Alternatives considered

- **Living inside the `skiss` repository.** Rejected: the root manifest, the root README and the bare version tags would all have to belong to the plugin, and the library could not have releases of its own.
- **BRAT only.** Rejected as an end state: fine for testing, invisible to most users.
