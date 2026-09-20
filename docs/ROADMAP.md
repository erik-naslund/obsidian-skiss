# Roadmap

## Milestone 1: See it — done, 0.1.0 and 0.1.1

A `skiss` code block renders as a class diagram in Reading view and Live
Preview, a broken line shows as a note rather than a blank block, and the note
exports to LinkML and to Mermaid, to a file next to it or to the clipboard.

1. ~~Plugin skeleton: manifest, esbuild, CI, a release workflow that attaches the assets.~~
2. ~~Code block processor rendering diagnostics and the Mermaid diagram.~~
3. ~~Export commands: LinkML and Mermaid, to a new file or to the clipboard.~~
4. ~~First tagged release, installable via BRAT.~~

## Milestone 2: In the list — done, 0.2.1

Submitted through the community directory on 2026-09-16; its scan asked for
four things (#41), 0.2.1 carried them, and the review completed on 2026-09-17.

## Milestone 3: Editing comfort — in progress

What workshop use asked for. In order:

1. **Export the diagram as SVG and PNG**, to a file next to the note or to the clipboard ([#45](https://github.com/erik-naslund/obsidian-skiss/issues/45)).
2. **Syntax highlighting and gutter diagnostics in Live Preview**, as a CodeMirror 6 extension ([#46](https://github.com/erik-naslund/obsidian-skiss/issues/46)).

## Not in this repository

A web editor with a live split pane, pan and zoom, is scoped in [skiss #65](https://github.com/erik-naslund/skiss/issues/65) and gets its own repository. A visual editor where boxes can be moved and the text follows belongs there too. This plugin renders; it does not edit.
