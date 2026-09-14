# Architecture

This plugin renders Skiss inside Obsidian. It contains no knowledge of the language. Parsing, diagnostics and generation come from the `skiss` package (on npm as `@eriknaslund/skiss`); the plugin wires them to Obsidian's APIs and stops there.

## Layout

```
obsidian-skiss/
  manifest.json          # at the root: Obsidian reads it from here
  versions.json          # plugin version -> minimum Obsidian version
  src/
    main.ts              # Plugin subclass: registers the processor and the commands
    render.ts            # skiss Document -> DOM (Mermaid + diagnostics, questions, comments)
    settings.ts          # the three switches and the settings tab
    export.ts            # the four export commands
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
5. **Three settings decide what is shown below the diagram.** *Show warnings*, *Show open questions* and *Show comments* are all on by default, live in `src/settings.ts`, are stored with `saveData` and read with `loadData`, and reach `render` as an argument; errors are not among them, because a block that fails to parse must never look fine.
6. **Four export commands**, each gated on a markdown note being active: *Export LinkML to new file*, *Export LinkML to clipboard*, *Export Mermaid to new file* and *Export Mermaid to clipboard*. All four find the `skiss` blocks in the active note and concatenate them into one source, so a note is one schema and one diagram; `compile` turns that into LinkML or Mermaid, with `notes` off as in the block. The file sink writes `<note>.linkml.yaml` or `<note>.mmd` next to the note via the vault API, overwriting what is there; the clipboard sink hands the text to `navigator.clipboard.writeText` and writes no file. Diagnostics go to a notice either way, at the note's own line numbers.

## Edges

- **No syntax highlighting through the code block processor.** It would make the block uneditable in Live Preview. Highlighting, when it comes, is a CodeMirror 6 extension and a separate milestone ([ADR 0003](adr/0003-no-highlighting-via-block-processor.md)).
- **No language logic here.** If rendering needs something the `skiss` package does not expose, the package gets the feature and this plugin gets a version bump. Never a local reimplementation.
- **Settings decide what is shown, never what is compiled.** The three switches hide sections of what is rendered; the Mermaid text is the same either way. Whether `?` doubts appear *on* the diagram is still not a setting, and waits until someone asks.

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
