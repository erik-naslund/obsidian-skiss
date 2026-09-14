# Changelog

All notable changes to this plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  and the rest of the diagram still renders. Each note says which line of the
  note it is about. A block is never empty and never throws.
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

[Unreleased]: https://github.com/erik-naslund/obsidian-skiss/compare/0.1.0...HEAD
[0.1.0]: https://github.com/erik-naslund/obsidian-skiss/releases/tag/0.1.0
