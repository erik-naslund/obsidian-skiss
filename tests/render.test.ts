import { compile } from '@eriknaslund/skiss';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../src/render';
import type { SkissSettings } from '../src/settings';
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

// A doubt and a description on a class and on a field, and a second class whose
// field carries both at once, so source order is more than declaration order.
const WITH_DOUBTS = `Character   # a person or droid in the archive   ? is a droid a character
  name
  homeworld: Planet                                 ? which planet counts, birth or home

Planet   ? do moons get their own class
  id*
  climate   # as the archive records it   ? whose classification
`;

// The settings a reader starts with: everything the block carries is shown.
const ALL_ON: SkissSettings = { showWarnings: true, showQuestions: true, showComments: true };

async function renderInto(source: string, settings: SkissSettings = ALL_ON): Promise<StubElement> {
  const el = new StubElement();
  await render(source, asContainer(el), settings);
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

  it('lists the doubts and the descriptions under the diagnostics, in source order', async () => {
    const el = await renderInto(WITH_DOUBTS);

    expect(el.children.map((child) => child.className)).toEqual([
      'skiss-diagram',
      'skiss-diagnostics',
      'skiss-questions',
      'skiss-comments',
    ]);
    expect(el.find('skiss-questions')?.lines()).toEqual([
      'Open questions',
      'Character: is a droid a character',
      'Character.homeworld: which planet counts, birth or home',
      'Planet: do moons get their own class',
      'Planet.climate: whose classification',
    ]);
    expect(el.find('skiss-comments')?.lines()).toEqual([
      'Comments',
      'Character: a person or droid in the archive',
      'Planet.climate: as the archive records it',
    ]);
  });

  it('leaves out a list the block has nothing for', async () => {
    // Descriptions but no doubts: the questions container is not rendered at all.
    const el = await renderInto(EXAMPLE);

    expect(el.find('skiss-questions')).toBeUndefined();
    expect(el.find('skiss-comments')?.lines()).toEqual([
      'Comments',
      'Character: a person or droid in the archive',
      "CharacterPage: the community wiki's version",
      'CharacterPage.summary: free text, written by editors',
    ]);
  });

  it('renders neither container for a block with no doubts and no descriptions', async () => {
    const el = await renderInto(WITH_TYPO);

    expect(el.find('skiss-questions')).toBeUndefined();
    expect(el.find('skiss-comments')).toBeUndefined();
  });

  it('leaves the diagram unchanged by the doubts it lists', async () => {
    await renderInto(WITH_DOUBTS);

    const [, text] = mermaidRender.mock.calls[0] ?? [];
    expect(text).toBe(compile(WITH_DOUBTS, { target: 'mermaid' }).output);
    expect(text).not.toContain('note');
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

describe('what the settings hide', () => {
  function without(key: keyof SkissSettings): SkissSettings {
    return { ...ALL_ON, [key]: false };
  }

  it('leaves out the warnings but keeps the errors when warnings are off', async () => {
    const el = await renderInto(WITH_WARNING_AND_ERROR, without('showWarnings'));

    expect(el.find('skiss-diagnostics')?.lines()).toEqual([
      'Error, line 4: A line at column 0 must start with a class name or `#` for a comment',
    ]);
  });

  it('renders an empty diagnostics list when warnings are off and none is an error', async () => {
    const el = await renderInto(WITH_TYPO, without('showWarnings'));

    expect(compile(WITH_TYPO, { target: 'mermaid' }).diagnostics.length).toBeGreaterThan(0);
    expect(el.find('skiss-diagnostics')?.lines()).toEqual([]);
  });

  it('leaves the questions and the comments alone when warnings are off', async () => {
    const el = await renderInto(WITH_DOUBTS, without('showWarnings'));

    expect(el.find('skiss-questions')?.lines()).toHaveLength(5);
    expect(el.find('skiss-comments')?.lines()).toHaveLength(3);
  });

  it('leaves out the questions, and nothing else, when questions are off', async () => {
    const el = await renderInto(WITH_DOUBTS, without('showQuestions'));

    expect(el.children.map((child) => child.className)).toEqual([
      'skiss-diagram',
      'skiss-diagnostics',
      'skiss-comments',
    ]);
    expect(el.find('skiss-comments')?.lines()).toEqual([
      'Comments',
      'Character: a person or droid in the archive',
      'Planet.climate: as the archive records it',
    ]);
  });

  it('leaves out the comments, and nothing else, when comments are off', async () => {
    const el = await renderInto(WITH_DOUBTS, without('showComments'));

    expect(el.children.map((child) => child.className)).toEqual([
      'skiss-diagram',
      'skiss-diagnostics',
      'skiss-questions',
    ]);
    expect(el.find('skiss-questions')?.lines()).toEqual([
      'Open questions',
      'Character: is a droid a character',
      'Character.homeworld: which planet counts, birth or home',
      'Planet: do moons get their own class',
      'Planet.climate: whose classification',
    ]);
  });

  it('still draws the diagram with every switch off', async () => {
    const el = await renderInto(WITH_DOUBTS, {
      showWarnings: false,
      showQuestions: false,
      showComments: false,
    });

    expect(el.children.map((child) => child.className)).toEqual([
      'skiss-diagram',
      'skiss-diagnostics',
    ]);
    expect(mermaidRender).toHaveBeenCalledTimes(1);
  });
});
