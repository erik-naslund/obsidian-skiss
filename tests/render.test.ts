import { compile } from '@eriknaslund/skiss';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../src/render';
import { asContainer, StubDOMParser, StubElement } from './stub-dom';

const { loadMermaid, mermaidRender } = vi.hoisted(() => {
  const mermaidRender = vi.fn(async (id: string, _text: string) => ({ svg: `<svg id="${id}"/>` }));
  return { loadMermaid: vi.fn(async () => ({ render: mermaidRender })), mermaidRender };
});

vi.mock('obsidian', () => ({ loadMermaid }));

// `DOMParser` is a browser global inside Obsidian; a test run has to supply one.
vi.stubGlobal('DOMParser', StubDOMParser);

// The one-page example from the skiss README: the shape a reviewer checks in a vault.
const EXAMPLE = `Character @Catalog                      # a person or droid in the archive
  id*
  name
  homeworld: Planet
  films: Film[]
  popularityRank: int @Community

Planet @Catalog
  id*
  name
  climate: arid|temperate|frozen|unknown

CharacterPage @Community ~ Character    # the community wiki's version
  slug*
  characterId = Character.id
  summary                               # free text, written by editors
`;

// `Ferson` is not `Person`: an undeclared class, which resolve reports as a warning.
const WITH_TYPO = 'Character\n  name\n  homeworld: Ferson\n  x: frobnicate\n';

// A warning on line 3 and an error on line 4, with enough left to draw a diagram.
const WITH_WARNING_AND_ERROR = 'Character\n  name\n  homeworld: Ferson\n!!!\n';

async function renderInto(source: string): Promise<StubElement> {
  const el = new StubElement();
  await render(source, asContainer(el));
  return el;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('render', () => {
  it('hands Mermaid exactly the text compile produced', async () => {
    const el = await renderInto(EXAMPLE);

    const [, text] = mermaidRender.mock.calls[0] ?? [];
    expect(text).toBe(compile(EXAMPLE, { target: 'mermaid' }).output);
    expect(el.find('skiss-diagram')?.children.map((child) => child.tagName)).toEqual(['svg']);
  });

  it('words each diagnostic for a note, with no column and no code', async () => {
    const el = await renderInto(WITH_WARNING_AND_ERROR);

    expect(el.find('skiss-diagnostics')?.lines()).toEqual([
      'Line 3: class `Ferson` is not declared',
      'Error, line 4: A line at column 0 must start with a class name or `#` for a comment',
    ]);
  });

  it('lists every diagnostic the compiler reported, one per line', async () => {
    const el = await renderInto(WITH_TYPO);

    const { diagnostics } = compile(WITH_TYPO, { target: 'mermaid' });
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(el.find('skiss-diagnostics')?.lines()).toHaveLength(diagnostics.length);
    // The line number a reader counts inside the block, never `line:col`.
    for (const line of el.find('skiss-diagnostics')?.lines() ?? []) {
      expect(line).toMatch(/^(Error, line|Line) \d+: /);
    }
  });

  it('draws the diagram even when the source has diagnostics', async () => {
    const el = await renderInto(WITH_TYPO);

    expect(el.find('skiss-diagram')).toBeDefined();
    expect(mermaidRender).toHaveBeenCalledTimes(1);
  });

  it('puts the diagram before the diagnostics', async () => {
    const el = await renderInto(WITH_TYPO);

    expect(el.children.map((child) => child.className)).toEqual([
      'skiss-diagram',
      'skiss-diagnostics',
    ]);
  });

  it.each([
    ['an empty block', ''],
    ['a comment-only block', '# nothing yet\n\n   \n'],
  ])('shows a placeholder for %s and never calls Mermaid', async (_name, source) => {
    const el = await renderInto(source);

    expect(el.children.map((child) => child.className)).toEqual([
      'skiss-placeholder',
      'skiss-diagnostics',
    ]);
    expect(el.find('skiss-diagnostics')?.children).toEqual([]);
    expect(el.find('skiss-placeholder')?.textContent).toBe('Nothing to draw yet');
    expect(el.find('skiss-diagram')).toBeUndefined();
    expect(mermaidRender).not.toHaveBeenCalled();
  });

  it('shows the diagnostics and the placeholder when nothing in the block parses', async () => {
    // Bare `classDiagram` again, but this time with something to report.
    const el = await renderInto('!!!\n');

    expect(el.find('skiss-diagnostics')?.lines()).toEqual([
      'Error, line 1: A line at column 0 must start with a class name or `#` for a comment',
    ]);
    expect(el.find('skiss-placeholder')?.textContent).toBe('Nothing to draw yet');
    expect(mermaidRender).not.toHaveBeenCalled();
  });

  it('reports a Mermaid failure instead of throwing', async () => {
    mermaidRender.mockRejectedValueOnce(new Error('Parse error on line 3'));

    const el = await renderInto(WITH_TYPO);

    expect(el.find('skiss-diagram')?.lines()).toEqual([
      'Diagram could not be rendered',
      'Parse error on line 3',
    ]);
    expect(el.find('skiss-diagnostics')?.lines().length).toBeGreaterThan(0);
  });

  it('survives a Mermaid failure that is not an Error', async () => {
    mermaidRender.mockRejectedValueOnce('mermaid exploded');

    const el = await renderInto(EXAMPLE);

    expect(el.find('skiss-diagram')?.lines()).toEqual([
      'Diagram could not be rendered',
      'mermaid exploded',
    ]);
  });

  it('reports an SVG it cannot parse as a failed diagram', async () => {
    mermaidRender.mockResolvedValueOnce({ svg: 'not markup at all' });

    const el = await renderInto(EXAMPLE);

    expect(el.find('skiss-diagram')?.lines()).toEqual([
      'Diagram could not be rendered',
      'Mermaid returned an SVG that could not be parsed',
    ]);
  });

  it('gives every block its own Mermaid id', async () => {
    await renderInto(EXAMPLE);
    await renderInto(EXAMPLE);

    const [first, second] = mermaidRender.mock.calls;
    expect(first?.[0]).toBeDefined();
    expect(first?.[0]).not.toBe(second?.[0]);
  });
});
