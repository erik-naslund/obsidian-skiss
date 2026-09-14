import { compile } from '@eriknaslund/skiss';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { describe as describeDiagnostic } from '../src/diagnostics';
import {
  concatenateBlocks,
  exportNote,
  type Format,
  noteLineOf,
  outputPathFor,
  type Sink,
  schemaNameFor,
  skissBlocks,
} from '../src/export';
import { asFile, asVault, asView, StubVault, StubView } from './stub-vault';

const { Notice, normalizePath, notices } = vi.hoisted(() => {
  const notices: string[] = [];
  return {
    notices,
    Notice: class {
      constructor(message: string) {
        notices.push(message);
      }
    },
    /**
     * `normalizePath` is Obsidian's own; the stand-in does what the export
     * relies on — one separator, no leading or trailing one, no non-breaking
     * space and NFC — so a path built from a decomposed note name lands where
     * the vault holds it.
     */
    normalizePath: (path: string): string =>
      path
        .replace(/[\\/]+/g, '/')
        .replace(/^\/+|\/+$/g, '')
        .replace(/\u00a0/g, ' ')
        .normalize('NFC'),
  };
});

vi.mock('obsidian', () => ({ Notice, normalizePath }));

// `navigator.clipboard` is a browser global inside Obsidian; a test run has to
// supply one.
const writeText = vi.fn((_text: string) => Promise.resolve());
vi.stubGlobal('navigator', { clipboard: { writeText } });

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

async function runExport(
  vault: StubVault,
  path: string,
  text: string,
  format: Format = 'linkml',
  sink: Sink = 'file',
): Promise<void> {
  await exportNote(asVault(vault), asFile(vault.add(path, text)), format, sink);
}

/** What the clipboard sink was handed, for the tests that check the text. */
function copied(): string | undefined {
  return writeText.mock.calls[0]?.[0];
}

beforeEach(() => {
  notices.length = 0;
  writeText.mockClear();
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

  it('reads a fence inside a blockquote, markers and all', () => {
    const note = '> A quote:\n>\n> ```skiss\n> Character\n>   id*\n> ```\n';

    expect(bodiesOf(note)).toEqual(['Character\n  id*']);
  });

  it('reads a fence inside a nested blockquote', () => {
    const note = '> > ```skiss\n> > Character\n> > ```\n';

    expect(bodiesOf(note)).toEqual(['Character']);
  });

  it('leaves a > the block itself carries where it is', () => {
    // The fence is not quoted, so nothing on its body lines is a quote marker.
    expect(bodiesOf('```skiss\n> Character\n```\n')).toEqual(['> Character']);
  });

  it('reads a fence indented past three spaces inside a nested list', () => {
    const note =
      '- A list item:\n  - Nested:\n\n      ```skiss\n      Character\n        id*\n      ```\n';

    expect(bodiesOf(note)).toEqual(['Character\n  id*']);
  });

  it('counts the note lines of a quoted block from the note', () => {
    const note = '# Title\n\n> ```skiss\n> Character\n> ```\n';

    expect(skissBlocks(note)).toEqual([{ body: 'Character', line: 4 }]);
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

    await runExport(vault, 'Sketches/My Notes.md', NOTE);

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
    ['Sketches/My Notes.md', 'My Notes', 'Sketches/My Notes.linkml.yaml', 'Sketches/My Notes.mmd'],
    ['Note.md', 'Note', 'Note.linkml.yaml', 'Note.mmd'],
    [
      'A folder/Star Wars v2.md',
      'Star Wars v2',
      'A folder/Star Wars v2.linkml.yaml',
      'A folder/Star Wars v2.mmd',
    ],
  ])('derives them from %s', (path, schemaName, linkmlPath, mermaidPath) => {
    expect(schemaNameFor(path)).toBe(schemaName);
    expect(outputPathFor(path, 'linkml')).toBe(linkmlPath);
    expect(outputPathFor(path, 'mermaid')).toBe(mermaidPath);
  });

  it.each([
    ['a doubled separator', 'Sketches//Note.md', 'Sketches/Note.linkml.yaml'],
    ['a leading separator', '/Sketches/Note.md', 'Sketches/Note.linkml.yaml'],
    // A non-breaking space is what a note title pasted from elsewhere carries.
    ['a non-breaking space', 'A\u00a0folder/Note.md', 'A folder/Note.linkml.yaml'],
    // The same name, decomposed: NFC is what the vault holds it under.
    ['a decomposed accent', 'Sketches/A\u0301rkiv.md', 'Sketches/\u00c1rkiv.linkml.yaml'],
  ])('normalizes the path it builds: %s', (_name, notePath, expected) => {
    expect(outputPathFor(notePath, 'linkml')).toBe(expected);
  });
});

describe('the file sink', () => {
  it('writes the schema next to the note and says where', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Sketches/My Notes.md', noteWith(CHARACTER));

    expect(vault.created).toEqual(['Sketches/My Notes.linkml.yaml']);
    expect(vault.contentOf('Sketches/My Notes.linkml.yaml')).toContain('name: my_notes');
    expect(notices[0]).toBe('Created Sketches/My Notes.linkml.yaml');
  });

  it('refreshes an export that is already there, through process, and says so', async () => {
    const vault = new StubVault();
    vault.add('Note.linkml.yaml', 'stale\n');

    await runExport(vault, 'Note.md', noteWith(CHARACTER));

    expect(vault.created).toEqual([]);
    expect(vault.processed).toEqual(['Note.linkml.yaml']);
    expect(vault.contentOf('Note.linkml.yaml')).not.toContain('stale');
    expect(notices[0]).toBe('Updated Note.linkml.yaml');
  });

  it("writes to the note's own sibling path and nothing else", async () => {
    const vault = new StubVault();
    const bystander = vault.add('Sketches/Other.linkml.yaml', 'not mine\n');

    await runExport(vault, 'Sketches/Note.md', noteWith(CHARACTER));

    expect(vault.created).toEqual(['Sketches/Note.linkml.yaml']);
    expect(bystander.content).toBe('not mine\n');
  });

  it('writes nothing for a note without a skiss block', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', '# Title\n\nProse only.\n');

    expect(vault.created).toEqual([]);
    expect(vault.processed).toEqual([]);
    expect(vault.getFileByPath('Note.linkml.yaml')).toBeNull();
    expect(notices).toEqual(['No skiss blocks in this note']);
  });

  it('follows the path notice with a count and the first three diagnostics', async () => {
    const vault = new StubVault();
    // Four undeclared classes: one warning each, so the notice has to cut the list.
    const block = 'Character\n  a: Alpha\n  b: Beta\n  c: Gamma\n  d: Delta\n';

    await runExport(vault, 'Note.md', noteWith(block));

    const diagnostics = compile(sourceOf([block.trimEnd()]), {
      target: 'linkml',
      schemaName: 'Note',
    }).diagnostics;
    expect(diagnostics.length).toBe(4);
    expect(notices[0]).toBe('Created Note.linkml.yaml');
    // The only block's body starts on line 2 of the note, so every line shifts by one.
    expect(notices[1]).toBe(
      [
        '4 diagnostics',
        ...diagnostics.slice(0, 3).map((d) => describeDiagnostic(d, d.line + 1, 'note')),
      ].join('\n'),
    );
  });

  it('names the note line of a diagnostic in the second block, not the compiler line', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', TWO_BLOCKS);

    const { diagnostics } = compile(sourceOf(['Character\n  id*', 'Planet\n  ruler: Ruler']), {
      target: 'linkml',
      schemaName: 'Note',
    });
    // `ruler: Ruler` is line 5 of the concatenated source and line 14 of the note.
    expect(diagnostics.map((d) => d.line)).toEqual([5]);
    expect(notices[1]).toBe(
      ['1 diagnostic', ...diagnostics.map((d) => describeDiagnostic(d, 14, 'note'))].join('\n'),
    );
    // The wording the block itself uses, at the note's own line, not `14:13:`.
    expect(notices[1]).toContain('Line 14: ');
  });

  it('shows no diagnostics notice when the note is clean', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', noteWith(`${CHARACTER}\n${PLANET}`));

    expect(notices).toEqual(['Created Note.linkml.yaml']);
  });

  it('reports a failed write instead of throwing', async () => {
    const vault = new StubVault();
    vault.create = () => Promise.reject(new Error('Folder is read-only'));

    await runExport(vault, 'Note.md', noteWith(CHARACTER));

    expect(notices).toEqual(['Export failed: Folder is read-only']);
  });

  it('writes the diagram of the whole note as .mmd and says where', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Sketches/My Notes.md', NOTE, 'mermaid', 'file');

    const expected = compile(sourceOf([CHARACTER.trimEnd(), PLANET.trimEnd()]), {
      target: 'mermaid',
    }).output;
    expect(vault.created).toEqual(['Sketches/My Notes.mmd']);
    expect(vault.contentOf('Sketches/My Notes.mmd')).toBe(expected);
    // One diagram for the note, not one per block.
    expect(expected).toContain('Character');
    expect(expected).toContain('Planet');
    expect(notices[0]).toBe('Created Sketches/My Notes.mmd');
  });

  it('refreshes a diagram that is already there', async () => {
    const vault = new StubVault();
    vault.add('Note.mmd', 'stale\n');

    await runExport(vault, 'Note.md', noteWith(CHARACTER), 'mermaid', 'file');

    expect(vault.created).toEqual([]);
    expect(vault.processed).toEqual(['Note.mmd']);
    expect(vault.contentOf('Note.mmd')).not.toContain('stale');
    expect(notices[0]).toBe('Updated Note.mmd');
  });

  it('leaves the clipboard alone', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', noteWith(CHARACTER));

    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('what the export reads', () => {
  it('reads the editor buffer of the active view, not the file on disk', async () => {
    const vault = new StubVault();
    const file = vault.add('Note.md', noteWith('Character\n  id*\n'));
    // What the user has typed since Obsidian last wrote the file.
    const view = new StubView(file, noteWith('Character\n  id*\n  name\n'));

    await exportNote(asVault(vault), asFile(file), 'linkml', 'file', asView(view));

    expect(vault.contentOf('Note.linkml.yaml')).toContain('name');
  });

  it('reads the file when the active view holds another note', async () => {
    const vault = new StubVault();
    const file = vault.add('Note.md', noteWith('Character\n  id*\n'));
    const other = vault.add('Other.md', noteWith('Planet\n  id*\n'));

    await exportNote(asVault(vault), asFile(file), 'linkml', 'file', asView(new StubView(other)));

    expect(vault.contentOf('Note.linkml.yaml')).toContain('Character');
    expect(vault.contentOf('Note.linkml.yaml')).not.toContain('Planet');
  });

  it('reads the file when no view is handed in', async () => {
    const vault = new StubVault();
    const file = vault.add('Note.md', noteWith('Character\n  id*\n'));

    await exportNote(asVault(vault), asFile(file), 'linkml', 'file');

    expect(vault.contentOf('Note.linkml.yaml')).toContain('Character');
  });
});

describe('the clipboard sink', () => {
  it('copies the schema and says which format it copied', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Sketches/My Notes.md', NOTE, 'linkml', 'clipboard');

    expect(copied()).toBe(
      compile(sourceOf([CHARACTER.trimEnd(), PLANET.trimEnd()]), {
        target: 'linkml',
        schemaName: 'My Notes',
      }).output,
    );
    expect(notices).toEqual(['Copied LinkML to clipboard']);
  });

  it('copies the diagram and says which format it copied', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Sketches/My Notes.md', NOTE, 'mermaid', 'clipboard');

    expect(copied()).toBe(
      compile(sourceOf([CHARACTER.trimEnd(), PLANET.trimEnd()]), { target: 'mermaid' }).output,
    );
    expect(notices).toEqual(['Copied Mermaid to clipboard']);
  });

  it.each([
    ['linkml', 'Note.linkml.yaml'],
    ['mermaid', 'Note.mmd'],
  ] as const)('writes no %s file', async (format, path) => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', noteWith(CHARACTER), format, 'clipboard');

    expect(vault.created).toEqual([]);
    expect(vault.processed).toEqual([]);
    expect(vault.getFileByPath(path)).toBeNull();
  });

  it('reports a clipboard the browser refused instead of throwing', async () => {
    const vault = new StubVault();
    writeText.mockRejectedValueOnce(new Error('Document is not focused'));

    await runExport(vault, 'Note.md', noteWith(CHARACTER), 'linkml', 'clipboard');

    expect(notices).toEqual(['Export failed: Document is not focused']);
  });
});

describe('what both sinks and both formats do', () => {
  const combinations = [
    ['linkml', 'file'],
    ['linkml', 'clipboard'],
    ['mermaid', 'file'],
    ['mermaid', 'clipboard'],
  ] as const;

  it.each(combinations)(
    'says nothing else for a note without a block (%s, %s)',
    async (format, sink) => {
      const vault = new StubVault();

      await runExport(vault, 'Note.md', '# Title\n\nProse only.\n', format, sink);

      expect(vault.created).toEqual([]);
      expect(writeText).not.toHaveBeenCalled();
      expect(notices).toEqual(['No skiss blocks in this note']);
    },
  );

  it.each(combinations)(
    'follows its own notice with the diagnostics at their note lines (%s, %s)',
    async (format, sink) => {
      const vault = new StubVault();

      await runExport(vault, 'Note.md', TWO_BLOCKS, format, sink);

      const { diagnostics } = compile(sourceOf(['Character\n  id*', 'Planet\n  ruler: Ruler']), {
        target: 'linkml',
        schemaName: 'Note',
      });
      // `ruler: Ruler` is line 5 of the concatenated source and line 14 of the note,
      // whichever format the note was compiled to.
      expect(diagnostics.map((d) => d.line)).toEqual([5]);
      expect(notices[1]).toBe(
        ['1 diagnostic', ...diagnostics.map((d) => describeDiagnostic(d, 14, 'note'))].join('\n'),
      );
    },
  );
});
