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

In Reading view, and in Live Preview when the cursor is outside the block, that renders as a class diagram. A half-typed line shows up as a small note above the diagram; the rest of the diagram still renders.

## What it does

- **Renders `skiss` code blocks** as class diagrams, using the Mermaid that ships with Obsidian.
- **Shows diagnostics** above the diagram instead of failing: an unknown type, a class you referenced but have not written yet, a line it could not read.
- **Exports to LinkML.** One command writes a `.linkml.yaml` next to the note.

Nothing else. The language, the parser and the LinkML generator live in the [`skiss`](https://github.com/erik-naslund/skiss) package. This plugin is the thinnest possible layer over it.

## Installing

Not yet in the community plugin list. Until it is, install with [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `erik-naslund/obsidian-skiss` as a beta plugin.

## Where to look

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the plugin is built and where its edges are. |
| [docs/adr/](docs/adr/) | Decisions. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What comes next. |
| [AGENTS.md](AGENTS.md) | How this repository is built. |
| [Skiss](https://github.com/erik-naslund/skiss) | The language itself. |

## Status

Pre-release. Nothing is implemented yet.

## License

[MIT](LICENSE).
