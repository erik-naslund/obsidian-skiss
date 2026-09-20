import { describe, expect, it } from 'vitest';
import { skissFences } from '../src/fences';

/**
 * Which fences a note holds is covered by `export.test.ts`, through
 * `skissBlocks`. What is checked here is what the editor needs and the export
 * does not: the note's own line each body line sits on, and how many
 * characters come before the body text on it.
 */
function placedAs(text: string): string[] {
  return skissFences(text).flatMap((fence) =>
    fence.lines.map((line) => `${line.line}+${line.offset}:${line.text}`),
  );
}

describe('skissFences', () => {
  it('numbers the body lines of a note from the note, not from the block', () => {
    const note = '# Title\n\nProse.\n\n```skiss\nCharacter\n  id*\n```\n';

    expect(placedAs(note)).toEqual(['6+0:Character', '7+0:  id*']);
  });

  it('reports the line the body starts on, and no line for an empty block', () => {
    expect(skissFences('```skiss\n```\n')).toEqual([{ line: 2, lines: [] }]);
  });

  it('counts the blockquote markers it stripped as the offset', () => {
    const note = '> ```skiss\n> Character\n>   id*\n> ```\n';

    expect(placedAs(note)).toEqual(['2+2:Character', '3+2:  id*']);
  });

  it('counts the indentation of a fence inside a list as the offset', () => {
    const note = '- A list item:\n\n  ```skiss\n  Character\n    id*\n  ```\n';

    expect(placedAs(note)).toEqual(['4+2:Character', '5+2:  id*']);
  });

  it('leaves a `>` the user wrote inside a block where it is', () => {
    // The block was not opened inside a quote, so nothing of the line is one.
    const note = '```skiss\n> Character\n```\n';

    expect(placedAs(note)).toEqual(['2+0:> Character']);
  });

  it('finds every block of a note, in order', () => {
    const note =
      '```skiss\nCharacter\n```\n\n```mermaid\nflowchart\n```\n\n```skiss\nPlanet\n```\n';

    expect(placedAs(note)).toEqual(['2+0:Character', '10+0:Planet']);
  });

  it('runs an unterminated fence to the end of the note', () => {
    expect(placedAs('```skiss\nCharacter\n  id*')).toEqual(['2+0:Character', '3+0:  id*']);
  });
});
