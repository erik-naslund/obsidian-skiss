import { compile } from '@eriknaslund/skiss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describe as describeDiagnostic, type LineScope } from '../src/diagnostics';
import { exportNote, type Format, outputPathFor, type Sink } from '../src/export';
import { StubCanvas, StubClipboardItem, StubImage } from './stub-canvas';
import { asFile, asVault, StubVault } from './stub-vault';

/**
 * The SVG and the PNG exports: the Mermaid the note compiles to is drawn by a
 * stubbed `loadMermaid`, and the rasterisation runs against the canvas doubles
 * in `stub-canvas.ts`. What the tests can hold the code to is the pipeline and
 * the decisions in it — the size drawn at, the transparent background, the path
 * written, the notice said — and not that the PNG looks right, which is a vault
 * check.
 */

const { loadMermaid, mermaidRender, Notice, normalizePath, notices } = vi.hoisted(() => {
  const notices: string[] = [];
  const mermaidRender = vi.fn((_id: string, _text: string) =>
    Promise.resolve({
      // What Mermaid's own render hands back: the diagram's size in the
      // `viewBox` and a width that asks for the container it is drawn into.
      svg: '<svg aria-roledescription="classDiagram" viewBox="0 0 320 180" width="100%"><g/></svg>',
    }),
  );
  return {
    notices,
    mermaidRender,
    loadMermaid: vi.fn(() => Promise.resolve({ render: mermaidRender })),
    Notice: class {
      constructor(message: string) {
        notices.push(message);
      }
    },
    normalizePath: (path: string): string => path.replace(/[\\/]+/g, '/').normalize('NFC'),
  };
});

// `StubFile` stands in as `TFile`, so the `instanceof` narrowing `export.ts`
// does over what a path holds is the one it does in a vault.
vi.mock('obsidian', async () => {
  const { StubFile } = await import('./stub-vault');
  return { Notice, loadMermaid, normalizePath, TFile: StubFile };
});

/** Every canvas the run created; the export creates exactly one per PNG. */
const canvases: StubCanvas[] = [];
/** What a canvas is like before the export draws on it: one it cannot use. */
let prepareCanvas: (canvas: StubCanvas) => void = () => {};
const writeText = vi.fn((_text: string) => Promise.resolve());
const write = vi.fn((_items: unknown[]) => Promise.resolve());

/**
 * `document`, `Image`, `ClipboardItem` and `navigator` are browser globals
 * inside Obsidian; a test run has to supply them, fresh for each test so that
 * one that takes a global away leaves the next one alone. `Blob` and
 * `URL.createObjectURL` are Node's own, so the blobs the export passes around
 * are real ones and `arrayBuffer()` is theirs.
 */
function stubBrowser(): void {
  vi.stubGlobal('document', {
    createElement: (_tag: string): StubCanvas => {
      const canvas = new StubCanvas();
      prepareCanvas(canvas);
      canvases.push(canvas);
      return canvas;
    },
  });
  vi.stubGlobal('Image', StubImage);
  vi.stubGlobal('ClipboardItem', StubClipboardItem);
  vi.stubGlobal('navigator', { clipboard: { writeText, write } });
}

const CHARACTER = 'Character @Catalog\n  id*\n  name\n  homeworld: Planet\n';
const PLANET = 'Planet @Catalog\n  id*\n  name\n';

/** A note with two blocks, so the export is visibly the whole note's diagram. */
const NOTE = `# The archive

\`\`\`skiss
${CHARACTER}\`\`\`

More prose.

\`\`\`skiss
${PLANET}\`\`\`
`;

/** A note whose second block references a class nobody declared: one warning. */
const WITH_WARNING = '```skiss\nCharacter\n  id*\n```\n\n```skiss\nPlanet\n  ruler: Ruler\n```\n';

/** The diagram size in the SVG's `viewBox`, and the PNG that follows from it. */
const DIAGRAM = { width: 320, height: 180 };
const PIXEL_RATIO = 2;

let objectUrls: string[] = [];
let revoked: string[] = [];

beforeEach(() => {
  notices.length = 0;
  canvases.length = 0;
  objectUrls = [];
  revoked = [];
  writeText.mockClear();
  write.mockClear();
  mermaidRender.mockClear();
  // The image the browser gives the SVG: no intrinsic size, which is what an
  // SVG asking for the width of its container has.
  StubImage.reset();
  prepareCanvas = () => {};
  stubBrowser();

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource): string => {
    const url = `blob:skiss/${objectUrls.length}`;
    objectUrls.push(blob instanceof Blob ? blob.type : '');
    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string): void => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function runExport(
  vault: StubVault,
  path: string,
  text: string,
  format: Format,
  sink: Sink,
): Promise<void> {
  await exportNote(asVault(vault), asFile(vault.add(path, text)), format, sink);
}

/** The whole note's diagram as Mermaid text, which is what the export draws. */
function mermaidOf(bodies: string[]): string {
  return compile(`${bodies.join('\n\n')}\n`, { target: 'mermaid' }).output;
}

/** The single canvas the PNG was drawn on. */
function canvas(): StubCanvas {
  const only = canvases[0];
  if (only === undefined) {
    throw new Error('the export drew on no canvas');
  }
  return only;
}

/** The bytes of a blob, as the string they were made from. */
async function textOf(blob: Blob | null): Promise<string> {
  return blob === null ? '' : new TextDecoder().decode(await blob.arrayBuffer());
}

describe('what the image exports draw', () => {
  it('draws the Mermaid of the whole note, off-screen', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', NOTE, 'svg', 'file');

    const drawn = mermaidRender.mock.calls[0]?.[1];
    expect(drawn).toBe(mermaidOf([CHARACTER.trimEnd(), PLANET.trimEnd()]));
    // Both blocks reached one diagram, as the Mermaid export compiles them.
    expect(drawn).toContain('Character');
    expect(drawn).toContain('Planet');
    expect(loadMermaid).toHaveBeenCalled();
  });

  it('renders every export under an id of its own', async () => {
    const vault = new StubVault();

    await runExport(vault, 'One.md', NOTE, 'svg', 'file');
    await runExport(vault, 'Two.md', NOTE, 'svg', 'file');

    const ids = mermaidRender.mock.calls.map((call) => call[0]);
    expect(ids[0]).toMatch(/^skiss-export-\d+$/);
    expect(ids[1]).toMatch(/^skiss-export-\d+$/);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('reports a diagram Mermaid could not draw and writes nothing', async () => {
    const vault = new StubVault();
    mermaidRender.mockRejectedValueOnce(new Error('Parse error on line 1'));

    await runExport(vault, 'Note.md', NOTE, 'svg', 'file');

    expect(notices).toEqual(['Export failed: Parse error on line 1']);
    expect(vault.created).toEqual([]);
  });
});

describe('the SVG export', () => {
  it('writes the markup Mermaid returned, as is, next to the note', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Sketches/My Notes.md', NOTE, 'svg', 'file');

    const svg = (await mermaidRender.mock.results[0]?.value)?.svg;
    expect(vault.created).toEqual(['Sketches/My Notes.svg']);
    expect(vault.contentOf('Sketches/My Notes.svg')).toBe(svg);
    expect(notices).toEqual(['Created Sketches/My Notes.svg']);
  });

  it('refreshes an SVG that is already there, through process', async () => {
    const vault = new StubVault();
    vault.add('Note.svg', '<svg>stale</svg>');

    await runExport(vault, 'Note.md', NOTE, 'svg', 'file');

    expect(vault.created).toEqual([]);
    expect(vault.processed).toEqual(['Note.svg']);
    expect(vault.contentOf('Note.svg')).not.toContain('stale');
    expect(notices).toEqual(['Updated Note.svg']);
  });

  it('copies the markup as text and says which format it copied', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', NOTE, 'svg', 'clipboard');

    expect(writeText.mock.calls[0]?.[0]).toContain('<svg');
    expect(notices).toEqual(['Copied SVG to clipboard']);
    expect(vault.created).toEqual([]);
    // No image is needed to copy markup: nothing is rasterised.
    expect(canvases).toEqual([]);
  });

  it('names the folder in the way instead of failing to create a file', async () => {
    const vault = new StubVault();
    vault.addFolder('Note.svg');

    await runExport(vault, 'Note.md', NOTE, 'svg', 'file');

    expect(vault.created).toEqual([]);
    expect(notices).toEqual(['A folder is in the way of the export: Note.svg']);
  });
});

describe('the PNG export', () => {
  it('rasterises the SVG through a blob URL it revokes again', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    expect(objectUrls).toEqual(['image/svg+xml']);
    expect(revoked).toEqual(['blob:skiss/0']);
    expect(StubImage.created[0]?.src).toBe('blob:skiss/0');
  });

  it('draws at twice the size of the diagram, on a canvas nothing painted', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    const drawnOn = canvas();
    expect([drawnOn.width, drawnOn.height]).toEqual([
      DIAGRAM.width * PIXEL_RATIO,
      DIAGRAM.height * PIXEL_RATIO,
    ]);
    expect(drawnOn.requestedContext).toBe('2d');
    expect(drawnOn.context.scaled).toEqual([[PIXEL_RATIO, PIXEL_RATIO]]);
    // The whole canvas is cleared and nothing is filled, so the PNG carries no
    // background of its own: the diagram sits on transparency.
    expect(drawnOn.context.cleared).toEqual([[0, 0, drawnOn.width, drawnOn.height]]);
    expect(drawnOn.context.filled).toEqual([]);
    // The diagram's own size, not the size the browser gave the image.
    expect(drawnOn.context.drawn).toEqual([
      { image: StubImage.created[0], args: [0, 0, DIAGRAM.width, DIAGRAM.height] },
    ]);
    expect(drawnOn.requestedType).toBe('image/png');
  });

  it('falls back to the size the browser gave the image when the SVG has no viewBox', async () => {
    const vault = new StubVault();
    mermaidRender.mockResolvedValueOnce({ svg: '<svg width="100%"><g/></svg>' });
    StubImage.reset({ naturalWidth: 120, naturalHeight: 60 });

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    expect([canvas().width, canvas().height]).toEqual([240, 120]);
    expect(canvas().context.drawn[0]?.args).toEqual([0, 0, 120, 60]);
  });

  it('reports a diagram with no size at all instead of writing an empty PNG', async () => {
    const vault = new StubVault();
    mermaidRender.mockResolvedValueOnce({ svg: '<svg width="100%"><g/></svg>' });

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    expect(notices).toEqual(['Export failed: the diagram has no size to rasterise']);
    expect(vault.createdBinary).toEqual([]);
  });

  it('writes the bytes next to the note with createBinary and says where', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Sketches/My Notes.md', NOTE, 'png', 'file');

    expect(vault.createdBinary).toEqual(['Sketches/My Notes.png']);
    expect(vault.created).toEqual([]);
    expect(await textOf(canvas().blob)).toBe('png');
    expect(new TextDecoder().decode(vault.bytesOf('Sketches/My Notes.png') ?? undefined)).toBe(
      'png',
    );
    expect(notices).toEqual(['Created Sketches/My Notes.png']);
  });

  it('refreshes a PNG that is already there with modifyBinary', async () => {
    const vault = new StubVault();
    vault.add('Note.png', '');

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    expect(vault.createdBinary).toEqual([]);
    expect(vault.modifiedBinary).toEqual(['Note.png']);
    expect(vault.processed).toEqual([]);
    expect(notices).toEqual(['Updated Note.png']);
  });

  it('puts the PNG on the clipboard as an image and writes no file', async () => {
    const vault = new StubVault();

    await runExport(vault, 'Note.md', NOTE, 'png', 'clipboard');

    const items = write.mock.calls[0]?.[0];
    expect(items).toHaveLength(1);
    const item = items?.[0];
    if (!(item instanceof StubClipboardItem)) {
      throw new Error('the clipboard was handed something that is not a ClipboardItem');
    }
    expect(Object.keys(item.items)).toEqual(['image/png']);
    expect(await textOf(item.items['image/png'] ?? null)).toBe('png');
    expect(writeText).not.toHaveBeenCalled();
    expect(vault.created).toEqual([]);
    expect(vault.createdBinary).toEqual([]);
    expect(notices).toEqual(['Copied PNG to clipboard']);
  });

  it('says so and writes nothing where the clipboard takes no image', async () => {
    const vault = new StubVault();
    // Some mobile webviews carry no `ClipboardItem`.
    vi.stubGlobal('ClipboardItem', undefined);

    await runExport(vault, 'Note.md', NOTE, 'png', 'clipboard');

    expect(notices).toEqual(['This device cannot put an image on the clipboard']);
    expect(write).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(vault.created).toEqual([]);
    expect(vault.createdBinary).toEqual([]);
    // Nothing was drawn either: the diagram is not rasterised to be thrown away.
    expect(canvases).toEqual([]);
    expect(StubImage.created).toEqual([]);
  });

  it('reports a clipboard the browser refused instead of throwing', async () => {
    const vault = new StubVault();
    write.mockRejectedValueOnce(new Error('Document is not focused'));

    await runExport(vault, 'Note.md', NOTE, 'png', 'clipboard');

    expect(notices).toEqual(['Export failed: Document is not focused']);
  });

  it('reports an SVG the browser could not load as an image', async () => {
    const vault = new StubVault();
    StubImage.reset({ fails: true });

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    expect(notices).toEqual(['Export failed: the diagram could not be loaded as an image']);
    expect(vault.createdBinary).toEqual([]);
  });

  it('reports a canvas that gave no context', async () => {
    const vault = new StubVault();
    prepareCanvas = (canvas) => {
      canvas.hasContext = false;
    };

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    expect(notices).toEqual(['Export failed: this device gave no canvas to draw the PNG on']);
    expect(vault.createdBinary).toEqual([]);
  });

  it('reports a canvas that produced no PNG', async () => {
    const vault = new StubVault();
    prepareCanvas = (canvas) => {
      canvas.blob = null;
    };

    await runExport(vault, 'Note.md', NOTE, 'png', 'file');

    expect(notices).toEqual(['Export failed: the canvas produced no PNG']);
    expect(vault.createdBinary).toEqual([]);
  });
});

describe('what both image formats and both sinks do', () => {
  const combinations = [
    ['svg', 'file'],
    ['svg', 'clipboard'],
    ['png', 'file'],
    ['png', 'clipboard'],
  ] as const;

  it.each(combinations)('names the file it writes after the note (%s, %s)', (format) => {
    expect(outputPathFor('Sketches/My Notes.md', format)).toBe(`Sketches/My Notes.${format}`);
    expect(outputPathFor('Note.md', format)).toBe(`Note.${format}`);
  });

  it.each(combinations)(
    'says nothing else for a note without a block (%s, %s)',
    async (format, sink) => {
      const vault = new StubVault();

      await runExport(vault, 'Note.md', '# Title\n\nProse only.\n', format, sink);

      expect(notices).toEqual(['No skiss blocks in this note']);
      expect(vault.created).toEqual([]);
      expect(vault.createdBinary).toEqual([]);
      expect(mermaidRender).not.toHaveBeenCalled();
    },
  );

  it.each(combinations)(
    'follows its own notice with the diagnostics at their note lines (%s, %s)',
    async (format, sink) => {
      const vault = new StubVault();

      await runExport(vault, 'Note.md', WITH_WARNING, format, sink);

      const { diagnostics } = compile('Character\n  id*\n\nPlanet\n  ruler: Ruler\n', {
        target: 'mermaid',
      });
      // `ruler: Ruler` is line 5 of the concatenated source and line 8 of the note.
      expect(diagnostics.map((d) => d.line)).toEqual([5]);
      expect(notices[1]).toBe(
        [
          '1 diagnostic',
          ...diagnostics.map((d) => describeDiagnostic(d, 8, 'note' satisfies LineScope)),
        ].join('\n'),
      );
    },
  );
});
