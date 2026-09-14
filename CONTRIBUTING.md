# Contributing

Thank you for looking. This is a small plugin with a narrow job: it renders
[Skiss](https://github.com/erik-naslund/skiss) blocks inside Obsidian and
exports them. The language itself — the parser, the diagnostics, the LinkML
generator — lives in the `skiss` package, so a question about what a block may
say belongs in [that repository](https://github.com/erik-naslund/skiss), not
here.

## Build and test

Requires Node 22 and [pnpm](https://pnpm.io) (the version in `packageManager`).

```sh
pnpm install
pnpm verify        # lint, typecheck, tests, build — the same gate CI runs
```

The pieces, when you want one of them alone:

```sh
pnpm lint          # biome check
pnpm typecheck     # tsc --noEmit
pnpm test          # vitest run
pnpm build         # esbuild, writes main.js
pnpm dev           # esbuild in watch mode
```

`main.js` is a build artifact and is never committed; it is attached to a
release ([docs/RELEASING.md](docs/RELEASING.md)).

## Checking it in a vault

Obsidian's API cannot run headless, so no test can tell you whether a block
actually renders. Build the plugin and copy `main.js`, `manifest.json` and
`styles.css` into `<your vault>/.obsidian/plugins/skiss/`, then enable **Skiss**
under Settings → Community plugins and look at a note holding a `skiss` block —
in **both** Reading view and Live Preview. Anything that changes what the user
sees is checked this way, and the pull request carries a screenshot.

## Sending a change

1. **One issue, one branch, one pull request.** If there is no issue yet, open
   one first and say what you intend to do.
2. **Branch from a fresh `main`.** `main` is reached only through a pull
   request with green CI.
3. **`pnpm verify` green before you push.** Biome decides formatting; do not
   hand-format around it.
4. **Fill in the pull request template.** It asks which issue the change
   closes, which test covers what, a screenshot for anything visible, and the
   decisions you made along the way. That description is the review surface.

Strict TypeScript, no `any` and no non-null assertions. Obsidian API calls stay
in `main.ts` and `export.ts`; `render.ts` takes a document and a container and
knows nothing about vaults, which is what makes it testable. Comments explain
why, not what.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes the pieces and where the
edges are, [docs/adr/](docs/adr/) holds the decisions behind them, and
[AGENTS.md](AGENTS.md) is how work in this repository is organised.
