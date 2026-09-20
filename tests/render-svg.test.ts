// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../src/render';
import type { SkissSettings } from '../src/settings';

/**
 * The one file in the suite that runs against a real DOM. Everything else uses
 * the doubles in `stub-dom.ts`, which read the first tag name with a regex and
 * so cannot fail the way a browser's `DOMParser` does: HTML foreign content,
 * the SVG attribute-adjustment table (`viewBox`, `preserveAspectRatio`), entity
 * decoding, and the cross-document adoption that appending the parsed root
 * performs are all invisible to a regex. Those are where a real "Mermaid
 * returned an SVG that could not be parsed" would come from, so the SVG path —
 * and only the SVG path — is exercised against jsdom here.
 */

const { loadMermaid, mermaidRender } = vi.hoisted(() => {
  const mermaidRender = vi.fn(async (_id: string, _text: string) => ({ svg: '<svg/>' }));
  return { loadMermaid: vi.fn(async () => ({ render: mermaidRender })), mermaidRender };
});

vi.mock('obsidian', () => ({ loadMermaid }));

/**
 * Obsidian adds its element helpers to the DOM prototypes when it starts; jsdom
 * has no such thing, so the one helper the renderer uses is installed here.
 * This stands in for Obsidian's `createDiv` the way `stub-dom.ts` does for the
 * rest of the suite: it creates the div, applies `cls` and `text`, appends it
 * and hands it back. Only the object form is covered, which is the only form
 * the renderer uses.
 */
HTMLElement.prototype.createDiv = function createDiv(
  this: HTMLElement,
  info?: DomElementInfo | string,
): HTMLDivElement {
  const div = this.ownerDocument.createElement('div');
  if (typeof info === 'object') {
    if (typeof info.cls === 'string') {
      div.className = info.cls;
    }
    if (typeof info.text === 'string') {
      div.textContent = info.text;
    }
  }
  this.append(div);
  return div;
};

const ALL_ON: SkissSettings = {
  showWarnings: true,
  showQuestions: true,
  showComments: true,
  highlightColours: 'calm',
};

/** One class, so there is a diagram to draw and Mermaid is reached. */
const SOURCE = 'Character\n  id*\n  name\n';

/** Renders one block into a real element, with Mermaid handing back `svg`. */
async function renderWithSvg(svg: string): Promise<HTMLElement> {
  mermaidRender.mockResolvedValueOnce({ svg });
  const el = document.createElement('div');
  document.body.append(el);
  await render(SOURCE, el, ALL_ON);
  return el;
}

function diagramOf(el: HTMLElement): HTMLElement {
  const diagramEl = el.querySelector<HTMLElement>('.skiss-diagram');
  if (diagramEl === null) {
    throw new Error('the block rendered no diagram container');
  }
  return diagramEl;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe('the SVG Mermaid returns, parsed by a real DOMParser', () => {
  it('appends the SVG element itself, in the SVG namespace', async () => {
    const el = await renderWithSvg('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>');

    const svg = diagramOf(el).firstElementChild;
    expect(svg?.tagName.toLowerCase()).toBe('svg');
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    // Appending moves the node out of the parsed document and into this one.
    expect(svg?.ownerDocument).toBe(document);
    expect(svg?.isConnected).toBe(true);
  });

  it('finds the SVG behind a leading comment and whitespace', async () => {
    // Mermaid serialises its SVG from a document of its own; what precedes the
    // root element is not something this plugin gets to decide.
    const el = await renderWithSvg(
      '\n  <!-- rendered by mermaid -->\n<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>\n',
    );

    expect(diagramOf(el).firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(diagramOf(el).textContent).not.toContain('rendered by mermaid');
  });

  it('keeps the casing of the attributes that decide how a diagram scales', async () => {
    // The HTML parser lowercases attribute names and puts these two back
    // through the SVG adjustment table. An SVG whose `viewBox` came out as
    // `viewbox` would be a diagram that does not scale.
    const el = await renderWithSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet" width="100"><g/></svg>',
    );

    const svg = diagramOf(el).firstElementChild;
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 50');
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
  });

  it('decodes an HTML entity in a label rather than showing its source', async () => {
    const el = await renderWithSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>Caf&eacute; &amp; Bar</text></svg>',
    );

    expect(diagramOf(el).textContent).toBe('Café & Bar');
  });

  it('reports a first element that is not an SVG as a diagram that failed', async () => {
    // What a Mermaid error page, or anything else HTML, comes back as.
    const el = await renderWithSvg('<div class="error">Syntax error in text</div>');

    expect(Array.from(diagramOf(el).children, (child) => child.textContent)).toEqual([
      'Diagram could not be rendered',
      'Mermaid returned an SVG that could not be parsed',
    ]);
    expect(diagramOf(el).querySelector('svg')).toBeNull();
  });

  it('reports source with no element at all the same way', async () => {
    const el = await renderWithSvg('not markup at all');

    expect(Array.from(diagramOf(el).children, (child) => child.textContent)).toEqual([
      'Diagram could not be rendered',
      'Mermaid returned an SVG that could not be parsed',
    ]);
  });
});
