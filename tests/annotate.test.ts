import { describe, expect, it } from 'vitest';
import { blockDiagnostics, highlightSpans } from '../src/annotate';

const NOTE = [
  '# Title', // 1
  '', // 2
  'Prose around the block.', // 3
  '', // 4
  '```skiss', // 5
  'Character @Catalog', // 6
  '  id*', // 7
  '  homeworld: Ferson', // 8
  '```', // 9
  '', // 10
  'More prose.', // 11
  '', // 12
].join('\n');

/** A span as `line:from-to className`, which is what the editor turns into a mark. */
function shown(text: string, wanted?: (line: number) => boolean): string[] {
  return highlightSpans(text, wanted).map(
    (span) => `${span.line}:${span.from}-${span.to} ${span.className}`,
  );
}

/** What each span covers, which is what a reader sees coloured. */
function covered(text: string): string[] {
  const lines = text.split('\n');
  return highlightSpans(text).map(
    (span) => `${(lines[span.line - 1] ?? '').slice(span.from, span.to)} ${span.className}`,
  );
}

describe('highlightSpans', () => {
  it('decorates the lines between the fences and nothing else', () => {
    expect(shown(NOTE)).toEqual([
      '6:0-9 cm-skiss-class',
      '6:10-11 cm-skiss-operator',
      '6:11-18 cm-skiss-system',
      '7:2-4 cm-skiss-field',
      '7:4-5 cm-skiss-marker',
      '8:2-11 cm-skiss-field',
      '8:11-12 cm-skiss-operator',
      '8:13-19 cm-skiss-class',
    ]);
  });

  it('leaves the note around the block alone, and the fence lines with it', () => {
    // Line 1 is a Markdown heading, not a Skiss comment; line 5 is the fence.
    expect(highlightSpans(NOTE).every((span) => span.line >= 6 && span.line <= 8)).toBe(true);
  });

  it('has nothing to say about a note with no skiss block in it', () => {
    expect(highlightSpans('# Title\n\n```mermaid\nflowchart\n```\n')).toEqual([]);
  });

  it('counts past the blockquote markers, so a span lands on the word', () => {
    const note = '> ```skiss\n> Character @Catalog\n> ```\n';

    expect(covered(note)).toEqual([
      'Character cm-skiss-class',
      '@ cm-skiss-operator',
      'Catalog cm-skiss-system',
    ]);
    expect(shown(note)).toEqual([
      '2:2-11 cm-skiss-class',
      '2:12-13 cm-skiss-operator',
      '2:13-20 cm-skiss-system',
    ]);
  });

  it('counts past the indentation of a block inside a list', () => {
    const note = '- A list item:\n\n  ```skiss\n  Character\n    id*\n  ```\n';

    expect(shown(note)).toEqual([
      '4:2-11 cm-skiss-class',
      '5:4-6 cm-skiss-field',
      '5:6-7 cm-skiss-marker',
    ]);
  });

  it('tokenizes only the lines the editor asks for', () => {
    // What the extension passes is the viewport: a note scrolled away is a
    // note not tokenized.
    expect(shown(NOTE, (line) => line === 7)).toEqual([
      '7:2-4 cm-skiss-field',
      '7:4-5 cm-skiss-marker',
    ]);
  });

  it('reads every block of a note', () => {
    const note = '```skiss\nCharacter\n```\n\n```skiss\nPlanet\n```\n';

    expect(shown(note)).toEqual(['2:0-9 cm-skiss-class', '6:0-6 cm-skiss-class']);
  });

  it('hands the spans over in the order the editor adds them', () => {
    // A range set is built in one pass, so a span that came out of order would
    // be one the editor could not add.
    const spans = highlightSpans(NOTE);

    expect(spans).toEqual([...spans].sort((a, b) => a.line - b.line || a.from - b.from));
  });
});

const WARNING_AND_ERROR = [
  '```skiss', // 1
  'Character', // 2
  '  homeworld: Ferson', // 3 — a class nobody declared: a warning
  '  crewSize:', // 4 — a colon with no type: an error
  '```', // 5
].join('\n');

describe('blockDiagnostics', () => {
  it('puts a diagnostic on the note line its block line sits on', () => {
    expect(blockDiagnostics(WARNING_AND_ERROR, true)).toEqual([
      { line: 3, severity: 'warning', message: 'class `Ferson` is not declared' },
      {
        line: 4,
        severity: 'error',
        message: 'A colon needs a type after it, e.g. `crewSize: int`',
      },
    ]);
  });

  it('hides the warnings when the reader has turned them off, and never the errors', () => {
    expect(blockDiagnostics(WARNING_AND_ERROR, false)).toEqual([
      {
        line: 4,
        severity: 'error',
        message: 'A colon needs a type after it, e.g. `crewSize: int`',
      },
    ]);
  });

  it('compiles each block on its own, as the block processor does', () => {
    // `Planet` is declared in the second block, so the reference in the first
    // is undeclared as far as that block is concerned.
    const note = '```skiss\nCharacter\n  homeworld: Planet\n```\n\n```skiss\nPlanet\n  id*\n```\n';

    expect(blockDiagnostics(note, true)).toEqual([
      { line: 3, severity: 'warning', message: 'class `Planet` is not declared' },
    ]);
  });

  it('counts the note lines of a quoted block from the note', () => {
    const note = '> ```skiss\n> Character\n>   homeworld: Ferson\n> ```\n';

    expect(blockDiagnostics(note, true).map((diagnostic) => diagnostic.line)).toEqual([3]);
  });

  it('has nothing to say about a note with no skiss block in it', () => {
    expect(blockDiagnostics('# Title\n\nProse.\n', true)).toEqual([]);
  });

  it('says nothing about a block that is empty', () => {
    expect(blockDiagnostics('```skiss\n```\n', true)).toEqual([]);
  });
});
