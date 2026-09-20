# Changelog

All notable changes to this plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **PNG export works again.** **Export PNG to new file** and **Export PNG to
  clipboard** ended in *Tainted canvases may not be exported* for every diagram
  with a label: Mermaid draws its labels as HTML inside a `<foreignObject>`, and
  a canvas an SVG carrying one was drawn on is one the browser will not read
  back. The export now asks Mermaid for plain SVG text labels, which also makes
  the exported SVG open correctly in tools that do not render `foreignObject` —
  Illustrator, Inkscape, Keynote. Only the export is drawn this way; the diagram
  in the note is unchanged. Where a canvas cannot be read back for some other
  reason, the notice now says the diagram could not be rasterised on this
  device, with the browser's own wording after it.

## [0.3.0] - 2026-09-20

The diagram as a picture, the block coloured as you type it with the
compiler's diagnostics in the gutter, and inheritance drawn. Built on
`@eriknaslund/skiss` 0.5.0.

### Added

- **Inheritance draws.** `Child < Parent` on a class line renders as the
  class-diagram arrow from the parent, and the child's box shows only its own
  fields (Skiss specification 0.3, via `@eriknaslund/skiss` 0.5.0).
- **Syntax highlighting and gutter diagnostics in Live Preview.** The lines of
  a `skiss` block are coloured as you type them — class and field names, types,
  the `@` systems, the enums, the operators and the `#` and `?` trailers —
  through Obsidian's own `--code-*` colours, so a theme that styles code styles
  these. Beside them, a gutter marks every line the compiler has something to
  say about, red for an error and yellow for a warning, with the diagnostic as
  the tooltip; *Show warnings* hides the warnings there as it does below the
  diagram, and errors are always marked. It is a CodeMirror 6 extension over
  Obsidian's own CodeMirror, so the block stays as editable as any other code
  block and nothing of CodeMirror is bundled. The list below the diagram in
  Reading view is unchanged.
- **The diagram exports as an image**, with four commands beside the four that
  were there: **Export SVG to new file**, **Export SVG to clipboard**,
  **Export PNG to new file** and **Export PNG to clipboard**. The whole note is
  one diagram, drawn by the Mermaid Obsidian ships with; the file commands write
  `<note>.svg` or `<note>.png` next to the note and refresh it on the next
  export, as the other two formats do. The PNG is the diagram at twice its own
  size on a transparent background. Putting the picture in the note is yours to
  write — `![[<note>.png]]` — and where a webview cannot put an image on the
  clipboard, **Export PNG to clipboard** says so and copies nothing.

### Changed

- **Listed in the community plugin directory.** Install from
  **Settings → Community plugins → Browse**; BRAT is now only for pre-release
  builds. The README and the release guide say so.

## [0.2.1] - 2026-09-16

What the community directory's scan of 0.2.0 asked for: settings that
Obsidian's settings search can find, signed release assets, and a README that
says what the plugin reaches for.

### Added

- **The three files a release carries are signed as they are built.** The
  release workflow records a build provenance attestation for `main.js`,
  `manifest.json` and `styles.css`, so anyone can check that the file they
  downloaded came from this repository — `gh attestation verify main.js --repo
  erik-naslund/obsidian-skiss`. [docs/RELEASING.md](docs/RELEASING.md) says what
  the attestation is and how to read one.
- **The README says what the plugin touches**, under "Disclosures": the two
  export-to-clipboard commands write to the system clipboard and nothing ever
  reads it, no request goes over the network, and a file is only ever written
  next to the note it was exported from.

### Changed

- **The settings turn up in Obsidian's own settings search.** Searching the
  settings for "warnings" now finds *Show warnings* without opening the plugin's
  tab first: the tab is described to Obsidian rather than drawn by the plugin,
  which is what puts it in the index. The three toggles, their wording, their
  defaults and what they do are unchanged.

## [0.2.0] - 2026-09-15

The block knows the note it sits in: line numbers, exports and commands all
follow the note, and the two deep-review rounds at 0.1.1 are in. Built on
`@eriknaslund/skiss` 0.4.0.

### Added

- **Numeric enum values.** `priority: 1|2|3` renders as an enum of three values
  and exports as such, where it used to be an error that lost the field
  (Skiss specification 0.2, via `@eriknaslund/skiss` 0.4.0).
- **A settings change on another device arrives without a reload.** With
  Obsidian Sync, turning the warnings, the questions or the comments off on one
  device now reaches the others as soon as the change lands, rather than at the
  next reload.

### Changed

- **A wide diagram shrinks to the width of the screen** instead of scrolling
  sideways on a phone. A diagram too tall to shrink into still scrolls.
- **"Nothing to draw yet" reads as the plugin talking**, in the register of the
  diagnostics below it, rather than as a line of the note.
- **The "Open questions" and "Comments" headings are in sentence case**, as the
  rest of Obsidian's interface is, instead of shouting in capitals.

### Fixed

- **An export whose path is taken by a folder says so.** Where the command used
  to report `Export failed: File already exists`, it now names the folder that
  is in the way and writes nothing.
- **A diagnostic under a diagram names the line of the note**, the same line the
  export notice names, instead of counting from the top of the code block. Where
  Obsidian will not say where a block sits, the block's own numbering is kept and
  the wording says so ("Block line 3:").
- **An export reads what you have typed**, not what was last written to disk. The
  commands take the note out of the editor, so a class written a second ago is in
  the schema.
- **An export to a file says whether it created or refreshed it.** The file is
  still the note's own sibling — re-exporting a note refreshes the file it wrote
  last time, and no other file is ever touched — but the notice now reads
  *Created …* or *Updated …*, and an existing file is written through Obsidian's
  own `process` rather than `modify`.
- **A `skiss` block inside a blockquote or a nested list is exported**, as it has
  always been rendered. Both were silently skipped, so the export could report
  "No skiss blocks in this note" for a note showing a diagram.
- **The export commands are offered only while a note is open.** Run from a graph
  view or a canvas, they used to export whichever note had been open before.
- **A compiler that throws no longer empties the block.** The failure is reported
  where the diagnostics are, which is what "never an empty block" has always
  promised.
- **A changed setting reaches Live Preview**, not only Reading view.

## [0.1.1] - 2026-09-14

Ready for the community list: the export commands the first vault test asked
for, and the plugin guideline pass.

### Added

- **Three more export commands.** Beside *Export LinkML to new file*, the
  palette carries *Export LinkML to clipboard*, *Export Mermaid to new file*
  and *Export Mermaid to clipboard*. The Mermaid ones export the diagram of the
  whole note, the same one the blocks draw, to `<note>.mmd` next to the note or
  to the clipboard. A clipboard command writes no file and a file command
  leaves the clipboard alone; both report anything the compiler objects to the
  way the LinkML export always has, at the note's own line numbers.

### Changed

- **The export command is now four, and the LinkML one to a file is named
  "Export LinkML to new file".** Obsidian puts the plugin name in front of
  every command itself, so the palette reads *Skiss: Export LinkML to new file*
  rather than repeating it. Its id is `export-linkml-file` (Obsidian prefixes
  the plugin id too), so a hotkey assigned to the `skiss-export-linkml` of
  0.1.0 has to be set again.

### Dependencies

- `@eriknaslund/skiss` 0.3.0.

## [0.1.0] - 2026-09-14

The first release. Enough to write a data model in a note and watch it take
shape.

### Added

- **`skiss` code blocks render as class diagrams.** Put a `skiss` block in a
  note and it shows as a diagram in Reading view, and in Live Preview when the
  cursor is outside the block. The diagram is drawn with the Mermaid that ships
  with Obsidian, so the plugin adds nothing to your vault's load.
- **A half-written line does not blank the block.** Anything the compiler has
  to say is listed below the diagram in plain words — a line it could not read,
  a type it does not know, a class you referenced but have not written yet —
  and the rest of the diagram still renders. Each note says which line it is
  about, counted inside the block. A block is never empty and never throws.
- **Open questions and comments are listed below the diagram.** The `?`
  questions of the block appear under an "Open questions" heading and the `#`
  descriptions under a "Comments" heading, each line saying what carries it,
  such as `Character.homeworld: which planet counts`. A list with nothing in it
  is left out. The diagram itself is unchanged by either.
- **The command "Skiss: Export to LinkML".** Run it on a note and every `skiss`
  block in it is compiled to LinkML and written to `<note>.linkml.yaml` next to
  the note. Anything the compiler objects to arrives as a notice naming the
  note's line.
- **Three settings**, all on by default, in Settings → Community plugins →
  Skiss: *Show warnings*, *Show open questions* and *Show comments*. They decide
  what is listed below the diagram when you want a quiet note to present from.
  Errors are not among them: a block that fails to compile must never look fine.
- **Installable with [BRAT](https://github.com/TfTHacker/obsidian42-brat)** from
  `erik-naslund/obsidian-skiss`. Not in the community plugin list yet.

[Unreleased]: https://github.com/erik-naslund/obsidian-skiss/compare/0.3.0...HEAD
[0.3.0]: https://github.com/erik-naslund/obsidian-skiss/compare/0.2.1...0.3.0
[0.2.1]: https://github.com/erik-naslund/obsidian-skiss/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/erik-naslund/obsidian-skiss/compare/0.1.1...0.2.0
[0.1.1]: https://github.com/erik-naslund/obsidian-skiss/releases/tag/0.1.1
[0.1.0]: https://github.com/erik-naslund/obsidian-skiss/releases/tag/0.1.0
