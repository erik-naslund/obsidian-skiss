# Skiss for Obsidian

Write a data model in a `skiss` code block and see it as a diagram while you type. Export it to LinkML when it becomes real.

[Skiss](https://github.com/erik-naslund/skiss) is a text notation for sketching data models. This plugin renders it inside Obsidian.

<!--
A screenshot of a rendered block belongs here, as `docs/screenshot.png`:
![A skiss block rendered as a class diagram](docs/screenshot.png)
The community listing shows an excerpt of this README, and the plugin's whole
point is a picture. The file is not in the repository yet.
-->

````markdown
```skiss
Character @Catalog          # a person or droid in the archive
  id*
  name
  homeworld: Planet
  films: Film[]

Planet @Catalog
  id*
  name
  climate: arid|temperate|frozen|unknown
```
````

In Reading view, and in Live Preview when the cursor is outside the block, that renders as a class diagram. A half-typed line shows up as a small note below the diagram; the rest of the diagram still renders.

## What it does

- **Renders `skiss` code blocks** as class diagrams, using the Mermaid that ships with Obsidian.
- **Shows diagnostics** below the diagram instead of failing: an unknown type, a class you referenced but have not written yet, a line it could not read. Each one names the line of the note it is about.
- **Lists the open questions and the comments** of the block below the diagram: the `?` questions under "Open questions" and the `#` descriptions under "Comments", each saying what carries it.
- **Exports the note**, with eight commands. Four write a file next to the note — **Skiss: Export LinkML to new file**, **Export Mermaid to new file**, **Export SVG to new file** and **Export PNG to new file** — and four put the same thing on the clipboard: **Export LinkML to clipboard**, **Export Mermaid to clipboard**, **Export SVG to clipboard** and **Export PNG to clipboard**. Every `skiss` block in the note is exported together, as one schema and one diagram; the SVG and the PNG are that diagram, drawn by the same Mermaid the block is rendered with.
- **Three settings**, all on by default, in Settings → Community plugins → Skiss: *Show warnings*, *Show open questions* and *Show comments*. They decide what is listed below the diagram when you want a quiet note to present from. Errors are not among them: a block that fails to compile must never look fine.

Nothing else. The language, the parser and the LinkML generator live in the [`skiss`](https://github.com/erik-naslund/skiss) package. This plugin is the thinnest possible layer over it.

### Rendering vs export

**A block is a diagram; a note is a schema.** Each block is rendered on its own, so a class you declared in an earlier block of the same note is not declared as far as the block you are looking at is concerned, and the diagram says so under it. The export commands read the whole note: every `skiss` block in it is compiled together, and a class declared anywhere in the note is declared for all of it. A warning under one diagram that the export does not report is this difference, not a disagreement.

### Where an export is written

The file commands always write to the note's own sibling: `<note>.linkml.yaml`, `<note>.mmd`, `<note>.svg` or `<note>.png`, in the note's folder. Running the command again refreshes that same file, so the export follows the note. **If you hand-edit an exported file, the next export overwrites your edit** — the notice says *Created* for a file that was not there and *Updated* for one that was. No other file is ever touched.

**An exported image is not put into the note.** Showing the picture in the note is yours to write, as an embed of the file the export wrote: `![[<note>.png]]`. The export never edits the note it was run from.

The PNG is the diagram at twice its own size, on a transparent background, so it reads as well in a dark theme as in a light one and survives being scaled up a little. On a device whose webview cannot put an image on the clipboard — some mobile ones cannot — **Export PNG to clipboard** says so and copies nothing; **Export PNG to new file** works there as everywhere else.

## Disclosures

Obsidian's developer policies ask a plugin to say what it reaches for beyond the note you are writing. This is all of it:

- **The clipboard is written to, never read.** The four *to clipboard* commands put what they exported on the system clipboard when you run one of them — the text, or the image itself for **Export PNG to clipboard** — and nothing else does. The plugin never reads the clipboard.
- **No network requests.** Nothing is fetched and nothing is sent: the language, the diagrams and the export all run on your machine, and the plugin has no account, no telemetry and no update channel of its own.
- **Files are written next to the note you export from, and nowhere else.** The four *to new file* commands write `<note>.linkml.yaml`, `<note>.mmd`, `<note>.svg` or `<note>.png` in the note's own folder, and no export inserts anything into the note itself. Nothing outside the vault is read or written, apart from the plugin's own settings, which Obsidian keeps with the plugin.

## Installing

**From the community plugin list**: **Settings → Community plugins → Browse**, search for **Skiss**, install it and enable it. Obsidian keeps it up to date from there.

**With [BRAT](https://github.com/TfTHacker/obsidian42-brat)**, only if you want to follow a pre-release build before it reaches the list:

1. **Settings → Community plugins → Browse**, find **BRAT** (*Obsidian42 - BRAT*), install it and enable it.
2. **Settings → BRAT → "Add beta plugin"**, and enter `erik-naslund/obsidian-skiss`.
3. **Settings → Community plugins**, enable **Skiss**.

BRAT keeps it up to date with later releases. [docs/RELEASING.md](docs/RELEASING.md) has the same steps and how a release is made.

## Where to look

| | |
|---|---|
| [Skiss](https://github.com/erik-naslund/skiss) | The language itself: what a block can say. |
| [CHANGELOG.md](CHANGELOG.md) | What changed, per release. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to build, test and send a change. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What comes next. |
| [docs/RELEASING.md](docs/RELEASING.md) | How a release is cut and installed. |

## Developing

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes how the plugin is built and
where its edges are, [docs/adr/](docs/adr/) holds the decisions behind it, and
[AGENTS.md](AGENTS.md) is how work in this repository is done.

## License

[MIT](LICENSE).
