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
    diagnostics.ts       # how a diagnostic is worded, for the block and the notice alike
    settings.ts          # the three switches and the settings tab
    export.ts            # the four export commands
  styles.css             # the lists below the diagram, nothing else
  esbuild.config.mjs     # bundles src/ into main.js
  docs/
```

`main.js`, `manifest.json` and `styles.css` are what Obsidian installs. They are attached to each GitHub release; `main.js` is never committed.

## What the plugin does, in order

1. **`registerMarkdownCodeBlockProcessor('skiss', ...)`.** For each block: `parse`, `resolve`, `toMermaid` from the `skiss` package, once, then render. What is rendered is registered with `ctx.addChild(new MarkdownRenderChild(el))`, so Obsidian unloads it with the section that holds it, and `ctx.getSectionInfo(el)?.lineStart` says where the block sits in its note.
2. **Render the diagram first** by handing the Mermaid text to Obsidian's own Mermaid, obtained with `loadMermaid()`. The plugin bundles no copy of Mermaid ([ADR 0002](adr/0002-obsidian-bundled-mermaid.md)). A block with nothing to draw gets a placeholder in the diagram's place instead.
3. **Render the diagnostics after it.** Errors and warnings from the document are listed below the diagram as plain text, one per line, worded for a reader of the note rather than for a compiler: `Line 5: class \`Validator\` is not declared` for a warning and `Error, line 3: A colon needs a type after it` for an error. No column, no diagnostic code. The line is the note's own, `lineStart` away from the line the compiler reports; when Obsidian will not place the section it stays the block's own line and says "Block line 5" rather than pointing at a line that is not there. `src/diagnostics.ts` holds that wording, and the export notice uses it too, so one diagnostic reads the same wherever it appears. An empty block or a thrown exception is never the result: a compiler that throws is reported where its diagnostics would have been.
4. **Render the open questions and the comments after that.** The `?` doubts of the block are listed under an "Open questions" heading and the `#` descriptions under a "Comments" heading, each line prefixed with what carries it: `Character: is a droid a character` for a class, `Character.homeworld: which planet counts` for a field. Both lists come from the document `parse` and `resolve` return, never from the plugin reading the source; the Mermaid text keeps `notes` off, so the diagram is unchanged. A list with nothing in it is left out entirely.
5. **Three settings decide what is shown below the diagram.** *Show warnings*, *Show open questions* and *Show comments* are all on by default, live in `src/settings.ts`, are stored with `saveData` and read with `loadData`, and reach `render` as an argument; errors are not among them, because a block that fails to parse must never look fine.
6. **Four export commands**, each gated with `checkCallback` on `getActiveViewOfType(MarkdownView)`, so they are offered only while a note is open and not when a graph or a canvas has the focus: *Export LinkML to new file*, *Export LinkML to clipboard*, *Export Mermaid to new file* and *Export Mermaid to clipboard*. All four read the note out of that view's editor — Obsidian writes the file on a debounce, so the buffer is what the user has typed — and fall back to `Vault.read` when no view holds it. They find the `skiss` blocks in the note, in a blockquote and in a list as well as at the top level, and concatenate them into one source, so a note is one schema and one diagram; `compile` turns that into LinkML or Mermaid, with `notes` off as in the block. The file sink writes the note's own sibling `<note>.linkml.yaml` or `<note>.mmd` — `normalizePath` on the path it builds, `Vault.create` when nothing is there and `Vault.process` when something is, and the notice says *Created* or *Updated* — and never touches another path; the clipboard sink hands the text to `navigator.clipboard.writeText` and writes no file. Diagnostics go to a notice either way, at the note's own line numbers and in the block's own wording.

## Edges

- **No syntax highlighting through the code block processor.** It would make the block uneditable in Live Preview. Highlighting, when it comes, is a CodeMirror 6 extension and a separate milestone ([ADR 0003](adr/0003-no-highlighting-via-block-processor.md)).
- **No language logic here.** If rendering needs something the `skiss` package does not expose, the package gets the feature and this plugin gets a version bump. Never a local reimplementation.
- **A block is a diagram; a note is a schema.** The processor compiles each block alone, so a class declared in another block of the same note is undeclared as far as this diagram is concerned; the export compiles every block of the note together. The README says the same to a reader under "Rendering vs export". Making the processor resolve against the whole note is a real piece of work and would want its own ADR.
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
| Tests | vitest for `render.ts`, `export.ts` and `main.ts` against stubbed Obsidian doubles; what the user sees is verified in a real vault |
| CI | GitHub Actions: lint, typecheck, build. A release workflow attaches `main.js`, `manifest.json` and `styles.css` to a tagged release |

Obsidian's API cannot run headless, so a PR that changes what the user sees includes a screenshot from a vault ([AGENTS.md](../AGENTS.md) §7).
