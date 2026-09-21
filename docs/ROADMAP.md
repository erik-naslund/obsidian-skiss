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

## Milestone 3: Editing comfort — done, 0.3.0 to 0.4.0

What workshop use asked for. In order:

1. ~~**Export the diagram as SVG and PNG**, to a file next to the note or to the clipboard ([#45](https://github.com/erik-naslund/obsidian-skiss/issues/45)).~~
2. ~~**Syntax highlighting and gutter diagnostics in Live Preview**, as a CodeMirror 6 extension ([#46](https://github.com/erik-naslund/obsidian-skiss/issues/46)).~~
3. ~~**A calmer palette by default**, with *Vivid* and *Off* as a setting and your own colours through a CSS snippet ([#54](https://github.com/erik-naslund/obsidian-skiss/issues/54)).~~

## Next

- **Import the tokeniser from the package.** `@eriknaslund/skiss` 0.6.0 exports `tokenizeLine`; the plugin's own copy in `src/tokenize.ts` goes, so the plugin and the playground cannot drift apart on what a line is.

## Not in this repository

The [playground](https://erik-naslund.github.io/skiss-playground/) ([skiss-playground](https://github.com/erik-naslund/skiss-playground)) is the web editor: a live split pane with pan and zoom, share links, downloads and file import. A visual editor where boxes can be moved and the text follows belongs there too, on its roadmap in [skiss](https://github.com/erik-naslund/skiss/blob/main/docs/ROADMAP.md). This plugin renders; it does not edit.
