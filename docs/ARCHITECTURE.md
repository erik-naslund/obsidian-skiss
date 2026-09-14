# Architecture

This plugin renders Skiss inside Obsidian. It contains no knowledge of the language. Parsing, diagnostics and generation come from the `skiss` package (on npm as `@eriknaslund/skiss`); the plugin wires them to Obsidian's APIs and stops there.

## Layout

```
obsidian-skiss/
  manifest.json          # at the root: Obsidian reads it from here
  versions.json          # plugin version -> minimum Obsidian version
  src/
    main.ts              # Plugin subclass: registers the processor and the command
    render.ts            # skiss Document -> DOM (Mermaid + diagnostics, questions, comments)
    export.ts            # the Export to LinkML command
  styles.css             # the lists below the diagram, nothing else
  esbuild.config.mjs     # bundles src/ into main.js
  docs/
```

`main.js`, `manifest.json` and `styles.css` are what Obsidian installs. They are attached to each GitHub release; `main.js` is never committed.

## What the plugin does, in order

1. **`registerMarkdownCodeBlockProcessor('skiss', ...)`.** For each block: `parse`, `resolve`, `toMermaid` from the `skiss` package, then render.
2. **Render the diagram first** by handing the Mermaid text to Obsidian's own Mermaid, obtained with `loadMermaid()`. The plugin bundles no copy of Mermaid ([ADR 0002](adr/0002-obsidian-bundled-mermaid.md)). A block with nothing to draw gets a placeholder in the diagram's place instead.
3. **Render the diagnostics after it.** Errors and warnings from the document are listed below the diagram as plain text, one per line, worded for a reader of the note rather than for a compiler: `Line 5: class \`Validator\` is not declared` for a warning and `Error, line 3: A colon needs a type after it` for an error. No column, no diagnostic code. An empty block or a thrown exception is never the result.
4. **Render the open questions and the comments after that.** The `?` doubts of the block are listed under an "Open questions" heading and the `#` descriptions under a "Comments" heading, each line prefixed with what carries it: `Character: is a droid a character` for a class, `Character.homeworld: which planet counts` for a field. Both lists come from the document `parse` and `resolve` return, never from the plugin reading the source; the Mermaid text keeps `notes` off, so the diagram is unchanged. A list with nothing in it is left out entirely.
5. **One command, "Export to LinkML".** Finds the `skiss` blocks in the active note, compiles them with `toLinkML` and `serialize`, and writes `<note>.linkml.yaml` next to the note via the vault API. Diagnostics go to a notice.

## Edges

- **No syntax highlighting through the code block processor.** It would make the block uneditable in Live Preview. Highlighting, when it comes, is a CodeMirror 6 extension and a separate milestone ([ADR 0003](adr/0003-no-highlighting-via-block-processor.md)).
- **No language logic here.** If rendering needs something the `skiss` package does not expose, the package gets the feature and this plugin gets a version bump. Never a local reimplementation.
- **No settings in the first release.** The one candidate, whether `?` doubts appear on the diagram, waits until someone asks.

## Dependency on `skiss`

The plugin pins a published version of `skiss`. During development it may use a local link to an unpublished build, but a release always pins a published version. See [ADR 0004](adr/0004-depend-on-published-skiss.md).

## Toolchain

| Area | Choice |
|---|---|
| Language | TypeScript, strict |
| Package manager | pnpm |
| Bundler | esbuild, as in Obsidian's sample plugin |
| Lint and format | Biome |
| Tests | vitest for `render.ts` and `export.ts` against a stubbed vault; the processor itself is verified in a real vault |
| CI | GitHub Actions: lint, typecheck, build. A release workflow attaches `main.js`, `manifest.json` and `styles.css` to a tagged release |

Obsidian's API cannot run headless, so a PR that changes what the user sees includes a screenshot from a vault ([AGENTS.md](../AGENTS.md) §7).
