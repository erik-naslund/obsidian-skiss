# AGENTS.md — Skiss for Obsidian

Instructions for AI agents (Claude Code and others) working in this
repository. Read this file in full before making any change. It is the
contract between the product owner and the agents that implement the work.

The product owner reviews **ADRs, PR descriptions and screenshots from a
vault**, not implementation files line by line. Your job is to make that
mode of working safe: produce code that is mechanically verified, stays
inside its issue, and surfaces anything a human must decide.

---

## 1. Project overview

An Obsidian plugin that renders [Skiss](https://github.com/erik-naslund/skiss)
code blocks as diagrams and exports them to LinkML. It is a thin layer
over the `skiss` package (on npm as `@eriknaslund/skiss`) and contains no language logic.

Stack (frozen unless an ADR changes it):

| Area | Choice |
| --- | --- |
| Language | **TypeScript**, strict |
| Package manager | **pnpm** |
| Bundler | **esbuild**, as in Obsidian's sample plugin |
| Lint and format | **Biome**, enforced in CI |
| Tests | **vitest** against a stubbed vault; the processor is verified in a real vault |
| Language | the **`skiss`** package, pinned to a published version |
| Diagram rendering | **Obsidian's bundled Mermaid** via `loadMermaid()` |
| CI | **GitHub Actions**: lint, typecheck, build; a release workflow attaches the assets |

---

## 2. Boundaries

- **No language logic here.** No parsing, no diagnostics, no generation.
  If you need something the `skiss` package does not expose, stop and
  surface it; the package gets the feature first (ADR-0004).
- **No bundled Mermaid** (ADR-0002).
- **No highlighting through the code block processor** (ADR-0003).
- **Never an empty block or a thrown exception.** Whatever the input, the
  processor renders something: diagnostics, a diagram, or both.
- **`main.js` is never committed.** It is built in CI and attached to
  releases.

`docs/ARCHITECTURE.md` describes the pieces.

---

## 3. Issue-driven workflow

Work items are GitHub issues. Every issue that reaches a worker carries a
goal, numbered acceptance criteria, an explicit *Out of scope*, and
working defaults the tech lead has already decided. A worker may veto a
working default by stopping and saying why, never by silently doing
something else.

- **Do not exceed the acceptance criteria.**
- **Stop and ask if anything is ambiguous** (Section 9).
- One issue = one branch = one PR.

---

## 4. Verification loop

`pnpm verify` runs the quality gate. **A task is complete only when it
exits green.** Never report success on a red gate or red CI.

1. `biome check`
2. `tsc --noEmit`
3. `vitest run`
4. `pnpm build` (esbuild produces `main.js` without errors)

What no script can verify: that the block renders in a real vault. Every
PR that changes rendering or the export command is checked by hand in a
vault and the PR carries a screenshot (Section 7).

> **Bootstrap note:** `pnpm verify`, the Biome config, the esbuild config,
> the CI workflow and the release workflow are created during repository
> bootstrap. Until a gate's tooling exists, a PR states which gates are not
> yet active instead of being blocked by them.

---

## 5. Architecture decisions (ADRs)

`docs/adr/`, **MADR** format, numbered, append-only. Check existing ADRs
before proposing a change. To change an accepted decision, draft a new
ADR first and surface it; never change the architecture and document it
afterwards.

---

## 6. Release mechanics

Obsidian installs from a GitHub release tagged with the bare version in
`manifest.json`, carrying `main.js`, `manifest.json` and `styles.css`.

- **Bumping the version** means updating `manifest.json`, `versions.json`
  and `package.json` together, in one PR.
- **The release workflow does the release.** Nothing is uploaded by hand.
- **Agents never publish.** Tagging a release and submitting to the
  community list are the product owner's. If a task appears to require
  it, stop and surface it.

---

## 7. PR descriptions

The PR description is the primary review surface. It is **mandatory** and
follows `.github/pull_request_template.md`:

- **Issue** it closes.
- **Acceptance criteria implemented**, by number.
- **Tests added** and, for anything visible, a **screenshot from a vault**
  showing the criterion met. For behaviour a screenshot cannot show, a
  short screen recording.
- **Non-obvious decisions** and **assumptions made**.
- **`skiss` version** the PR depends on, and whether it is published.

---

## 8. Code style

- Strict TypeScript. No `any`, no non-null assertions.
- Obsidian API calls stay in `main.ts` and `export.ts`. `render.ts` takes
  a `Document` and a container element and knows nothing about vaults or
  commands, so it can be tested.
- Small files named for what they contain.
- Biome decides formatting.
- Comments explain why, not what.

---

## 9. When unsure

Do **not** invent, and do **not** stop to ask: nobody watches a worker
session, and a turn that ends on a question shows up as a question to the
product owner. Pick the reading closest to the issue text, record it on
the PR under **Assumptions made** as a vetoable working default (what you
chose, the alternative, why), and continue. Stop only when no default
could make the work useful, and say exactly that in the PR description.
A question about the language goes to the `skiss` repository, not here.

A worker never subscribes to its own PR, never schedules check-ins for
itself, and never wakes itself up later. The tech lead watches the PR.
When the PR is open and CI is green, the worker's job is finished.

---

## 10. Working alongside other agents

- **Claim before you code.** Comment on the issue with your branch name.
  Creating issues is the tech lead's job.
- **Branch from fresh `main`; reach `main` only via PR with green CI.**
  Never push to `main`, never force-push a shared branch.
- **Check for overlap before branching.**
- **`docs/` belongs to the product owner.** Never overwrite documentation
  you did not author.
- **Fetch before every push; rebase your own branch on its remote.**

---

## 11. Session discipline and orchestration

Same model as the `skiss` repository:

1. **One issue, one session.** Recommend a fresh session for a new issue.
2. **Every implementation PR gets a reviewer that is not its author.**
3. **Facts over recall.** Read the workflow file before describing how CI
   or releases behave.
4. **The tech lead plans; workers execute.** Workers get one
   self-contained issue, never ask the product owner directly, and never
   spawn workers. They report through their PR.
