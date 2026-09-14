import { compile, formatDiagnostic } from '@eriknaslund/skiss';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  concatenateBlocks,
  exportToLinkML,
  noteLineOf,
  outputPathFor,
  schemaNameFor,
  skissBlocks,
} from '../src/export';
import { asFile, asVault, StubVault } from './stub-vault';

const { Notice, notices } = vi.hoisted(() => {
  const notices: string[] = [];
  return {
    notices,
    Notice: class {
      constructor(message: string) {
        notices.push(message);
      }
    },
  };
});

vi.mock('obsidian', () => ({ Notice }));

const CHARACTER = 'Character @Catalog\n  id*\n  name\n  homeworld: Planet\n';
const PLANET = 'Planet @Catalog\n  id*\n  name\n';

const NOTE = `# The archive

Some prose.

\`\`\`skiss
${CHARACTER}\`\`\`

\`\`\`mermaid
classDiagram
\`\`\`

More prose.

\`\`\`skiss
${PLANET}\`\`\`
`;

/** Two blocks separated by prose; the warning in the second is what issue #12 is about. */
const TWO_BLOCKS = `# The archive

Some prose.

\`\`\`skiss
Character
  id*
\`\`\`

More prose, long enough that the two line numberings cannot coincide.

\`\`\`skiss
Planet
  ruler: Ruler
\`\`\`
`;

/** A note holding one block, the shape most of the write tests need. */
function noteWith(block: string): string {
  return `\`\`\`skiss\n${block}\`\`\`\n`;
}

/** The block bodies alone, for the tests that do not care where they sit. */
function bodiesOf(text: string): string[] {
  return skissBlocks(text).map((block) => block.body);
}

/** The source the command hands the compiler, for the tests that compile it again. */
function sourceOf(bodies: string[]): string {
  // `concatenateBlocks` reads the bodies only, so any line does here.
  return concatenateBlocks(bodies.map((body, index) => ({ body, line: index + 1 })));
}

async function exportNote(vault: StubVault, path: string, text: string): Promise<void> {
  await exportToLinkML(asVault(vault), asFile(vault.add(path, text)));
}

beforeEach(() => {
  notices.length = 0;
});

describe('skissBlocks', () => {
  it('finds every skiss block in order and leaves other fences alone', () => {
    expect(bodiesOf(NOTE)).toEqual([CHARACTER.trimEnd(), PLANET.trimEnd()]);
  });

  it('exports a block whose info string carries more than the language', () => {
    const note = '```skiss title="The archive"\nCharacter\n  id*\n```\n';

    expect(bodiesOf(note)).toEqual(['Character\n  id*']);
  });

  it('ignores a fence whose first word merely starts with skiss', () => {
    expect(skissBlocks('```skisser\nCharacter\n```\n')).toEqual([]);
  });

  it('reads a tilde fence', () => {
    expect(bodiesOf('~~~skiss\nCharacter\n~~~\n')).toEqual(['Character']);
  });

  it('reads an indented fence and strips the fence indentation from the body', () => {
    const note = '- A list item:\n\n  ```skiss\n  Character\n    id*\n  ```\n';

    expect(bodiesOf(note)).toEqual(['Character\n  id*']);
  });

  it('runs an unterminated fence to the end of the note', () => {
    expect(bodiesOf('```skiss\nCharacter\n  id*\n')).toEqual(['Character\n  id*\n']);
  });

  it('finds nothing in a note without a skiss block', () => {
    expect(skissBlocks('# Title\n\nProse and `inline code`.\n')).toEqual([]);
  });

  it('reports the note line each block body starts on', () => {
    // Each body starts one line past its opening fence.
    expect(skissBlocks(NOTE).map((block) => block.line)).toEqual([6, 19]);
  });

  it('counts the note lines of an indented block from the note, not the block', () => {
    const note = '- A list item:\n\n  ```skiss\n  Character\n  ```\n';

    expect(skissBlocks(note)).toEqual([{ body: 'Character', line: 4 }]);
  });
});

describe('noteLineOf', () => {
  const blocks = [
    { body: 'Character\n  id*', line: 6 },
    { body: 'Planet\n  id*', line: 18 },
  ];

  it.each([
    [1, 6],
    [2, 7],
    [4, 18],
    [5, 19],
  ])('maps concatenated line %i to note line %i', (line, noteLine) => {
    expect(noteLineOf(blocks, line)).toBe(noteLine);
  });

  it('puts the blank line between two blocks just past the first block', () => {
    expect(noteLineOf(blocks, 3)).toBe(8);
  });

  it('leaves a line without a block alone', () => {
    expect(noteLineOf([], 3)).toBe(3);
  });
});

describe('the source handed to the compiler', () => {
  it('separates the blocks with a blank line', () => {
    expect(
      concatenateBlocks([
        { body: 'Character', line: 2 },
        { body: 'Planet', line: 8 },
      ]),
    ).toBe('Character\n\nPlanet\n');
  });

  it('compiles the blocks of a note as one schema', async () => {
    const vault = new StubVault();

    await exportNote(vault, 'Sketches/My Notes.md', NOTE);

    const expected = compile(sourceOf([CHARACTER.trimEnd(), PLANET.trimEnd()]), {
      target: 'linkml',
      schemaName: 'My Notes',
    }).output;
    expect(vault.contentOf('Sketches/My Notes.linkml.yaml')).toBe(expected);
    // Both blocks reached the schema, not just the first.
    expect(expected).toContain('Character');
    expect(expected).toContain('Planet');
  });
});

describe('the schema name and the file name', () => {
  it.each([
    ['Sketches/My Notes.md', 'My Notes', 'Sketches/My Notes.linkml.yaml'],
    ['Note.md', 'Note', 'Note.linkml.yaml'],
    ['A folder/Star Wars v2.md', 'Star Wars v2', 'A folder/Star Wars v2.linkml.yaml'],
  ])('derives them from %s', (path, schemaName, outputPath) => {
    expect(schemaNameFor(path)).toBe(schemaName);
    expect(outputPathFor(path)).toBe(outputPath);
  });
});

describe('exportToLinkML', () => {
  it('writes the schema next to the note and says where', async () => {
    const vault = new StubVault();

    await exportNote(vault, 'Sketches/My Notes.md', noteWith(CHARACTER));

    expect(vault.created).toEqual(['Sketches/My Notes.linkml.yaml']);
    expect(vault.contentOf('Sketches/My Notes.linkml.yaml')).toContain('name: my_notes');
    expect(notices[0]).toBe('Exported to Sketches/My Notes.linkml.yaml');
  });

  it('overwrites an export that is already there', async () => {
    const vault = new StubVault();
    vault.add('Note.linkml.yaml', 'stale\n');

    await exportNote(vault, 'Note.md', noteWith(CHARACTER));

    expect(vault.created).toEqual([]);
    expect(vault.modified).toEqual(['Note.linkml.yaml']);
    expect(vault.contentOf('Note.linkml.yaml')).not.toContain('stale');
  });

  it('writes nothing for a note without a skiss block', async () => {
    const vault = new StubVault();

    await exportNote(vault, 'Note.md', '# Title\n\nProse only.\n');

    expect(vault.created).toEqual([]);
    expect(vault.modified).toEqual([]);
    expect(vault.getFileByPath('Note.linkml.yaml')).toBeNull();
    expect(notices).toEqual(['No skiss blocks in this note']);
  });

  it('follows the path notice with a count and the first three diagnostics', async () => {
    const vault = new StubVault();
    // Four undeclared classes: one warning each, so the notice has to cut the list.
    const block = 'Character\n  a: Alpha\n  b: Beta\n  c: Gamma\n  d: Delta\n';

    await exportNote(vault, 'Note.md', noteWith(block));

    const diagnostics = compile(sourceOf([block.trimEnd()]), {
      target: 'linkml',
      schemaName: 'Note',
    }).diagnostics;
    expect(diagnostics.length).toBe(4);
    expect(notices[0]).toBe('Exported to Note.linkml.yaml');
    // The only block's body starts on line 2 of the note, so every line shifts by one.
    expect(notices[1]).toBe(
      [
        '4 diagnostics',
        ...diagnostics.slice(0, 3).map((d) => formatDiagnostic({ ...d, line: d.line + 1 })),
      ].join('\n'),
    );
  });

  it('names the note line of a diagnostic in the second block, not the compiler line', async () => {
    const vault = new StubVault();

    await exportNote(vault, 'Note.md', TWO_BLOCKS);

    const { diagnostics } = compile(sourceOf(['Character\n  id*', 'Planet\n  ruler: Ruler']), {
      target: 'linkml',
      schemaName: 'Note',
    });
    // `ruler: Ruler` is line 5 of the concatenated source and line 14 of the note.
    expect(diagnostics.map((d) => d.line)).toEqual([5]);
    expect(notices[1]).toBe(
      ['1 diagnostic', ...diagnostics.map((d) => formatDiagnostic({ ...d, line: 14 }))].join('\n'),
    );
    expect(notices[1]).toContain('14:');
  });

  it('shows no diagnostics notice when the note is clean', async () => {
    const vault = new StubVault();

    await exportNote(vault, 'Note.md', noteWith(`${CHARACTER}\n${PLANET}`));

    expect(notices).toEqual(['Exported to Note.linkml.yaml']);
  });

  it('reports a failed write instead of throwing', async () => {
    const vault = new StubVault();
    vault.create = () => Promise.reject(new Error('Folder is read-only'));

    await exportNote(vault, 'Note.md', noteWith(CHARACTER));

    expect(notices).toEqual(['Export failed: Folder is read-only']);
  });
});
