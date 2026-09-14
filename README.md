# Skiss for Obsidian

Write a data model in a `skiss` code block and see it as a diagram while you type. Export it to LinkML when it becomes real.

[Skiss](https://github.com/erik-naslund/skiss) is a text notation for sketching data models. This plugin renders it inside Obsidian.

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
- **Shows diagnostics** below the diagram instead of failing: an unknown type, a class you referenced but have not written yet, a line it could not read.
- **Exports the note**, with four commands: **Skiss: Export LinkML to new file** and **Export Mermaid to new file** write a `.linkml.yaml` or a `.mmd` next to the note, and **Export LinkML to clipboard** and **Export Mermaid to clipboard** put the same text on the clipboard. Every `skiss` block in the note is exported together, as one schema and one diagram.

Nothing else. The language, the parser and the LinkML generator live in the [`skiss`](https://github.com/erik-naslund/skiss) package. This plugin is the thinnest possible layer over it.

## Installing

Not yet in the community plugin list. Until it is, install with [BRAT](https://github.com/TfTHacker/obsidian42-brat), which installs a plugin straight from its GitHub release.

1. **Settings → Community plugins → Browse**, find **BRAT** (*Obsidian42 - BRAT*), install it and enable it.
2. **Settings → BRAT → "Add beta plugin"**, and enter `erik-naslund/obsidian-skiss`.
3. **Settings → Community plugins**, enable **Skiss**.

BRAT keeps it up to date with later releases. [docs/RELEASING.md](docs/RELEASING.md) has the same steps and how a release is made.

## Where to look

| | |
|---|---|
| [Skiss](https://github.com/erik-naslund/skiss) | The language itself: what a block can say. |
| [CHANGELOG.md](CHANGELOG.md) | What changed, per release. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What comes next. |
| [docs/RELEASING.md](docs/RELEASING.md) | How a release is cut and installed. |

## Developing

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) describes how the plugin is built and
where its edges are, [docs/adr/](docs/adr/) holds the decisions behind it, and
[AGENTS.md](AGENTS.md) is how work in this repository is done.

## Status

`0.1.0`, the first release: blocks render, diagnostics, open questions and comments are listed below the diagram, and "Export to LinkML" writes a file next to the note. Install it with BRAT; it is not in the community plugin list yet. [CHANGELOG.md](CHANGELOG.md) has the detail.

## License

[MIT](LICENSE).
