# Roadmap

## Milestone 1: See it — done, 0.1.0 and 0.1.1

A `skiss` code block renders as a class diagram in Reading view and Live
Preview, a broken line shows as a note rather than a blank block, and the note
exports to LinkML and to Mermaid, to a file next to it or to the clipboard.

1. ~~Plugin skeleton: manifest, esbuild, CI, a release workflow that attaches the assets.~~
2. ~~Code block processor rendering diagnostics and the Mermaid diagram.~~
3. ~~Export commands: LinkML and Mermaid, to a new file or to the clipboard.~~
4. ~~First tagged release, installable via BRAT.~~

## Milestone 2: In the list — in progress

Community plugin submission and whatever the review asks for. The guideline
pass and the post-review fixes are done; the submission is with the reviewers.

## Milestone 3: Editing comfort

Syntax highlighting as a CodeMirror 6 extension. Diagnostics as gutter markers instead of a list. Both wait until milestone 1 has been used for a while.

## Not in this repository

A visual editor where boxes can be moved and the text follows is a separate project. This plugin renders; it does not edit.
