import { compile, formatDiagnostic } from '@eriknaslund/skiss';
import { loadMermaid } from 'obsidian';

/** `loadMermaid()` is untyped; this is the one call the plugin makes into it. */
interface Mermaid {
  render(id: string, text: string): Promise<{ svg: string }>;
}

/**
 * What an empty or comment-only document compiles to. Mermaid rejects a
 * diagram with no body, so this text never reaches it.
 */
const EMPTY_DIAGRAM = 'classDiagram';

const PLACEHOLDER = 'Nothing to draw yet';
const RENDER_FAILED = 'Diagram could not be rendered';
const SVG_UNPARSEABLE = 'Mermaid returned an SVG that could not be parsed';

// Mermaid keys the SVG it renders by id and collides when two blocks in one
// note share one, so every block gets its own.
let blocksRendered = 0;

/**
 * Compiles one `skiss` block and fills `el` with its diagnostics and its
 * diagram. Whatever the source, it renders something and throws nothing.
 */
export async function render(source: string, el: HTMLElement): Promise<void> {
  const { output, diagnostics } = compile(source, { target: 'mermaid' });

  const diagnosticsEl = appendDiv(el, 'skiss-diagnostics');
  for (const diagnostic of diagnostics) {
    appendDiv(diagnosticsEl).textContent = formatDiagnostic(diagnostic);
  }

  if (output.trim() === EMPTY_DIAGRAM) {
    appendDiv(el, 'skiss-placeholder').textContent = PLACEHOLDER;
    return;
  }

  const diagramEl = appendDiv(el, 'skiss-diagram');
  blocksRendered += 1;
  const id = `skiss-diagram-${blocksRendered}`;

  try {
    const mermaid = (await loadMermaid()) as Mermaid;
    const { svg } = await mermaid.render(id, output);
    diagramEl.append(parseSvg(svg));
  } catch (error) {
    appendDiv(diagramEl).textContent = RENDER_FAILED;
    appendDiv(diagramEl).textContent = messageOf(error);
  }
}

/**
 * Obsidian's guidelines rule out assigning markup as a string, so the SVG
 * Mermaid returns reaches the container as parsed nodes. It is parsed as HTML,
 * which is the parser `innerHTML` used: Mermaid serialises its SVG from an HTML
 * document, so it may carry HTML entities and unclosed tags that a strict XML
 * parse would reject. The HTML parser never throws; a document whose first
 * element is not an `<svg>` is a failed diagram like any other.
 */
function parseSvg(svg: string): Element {
  const parsed = new DOMParser().parseFromString(svg, 'text/html');
  const root = parsed.body.firstElementChild;
  if (root === null || root.tagName.toLowerCase() !== 'svg') {
    throw new Error(SVG_UNPARSEABLE);
  }
  return root;
}

function appendDiv(parent: HTMLElement, className?: string): HTMLElement {
  const div = parent.ownerDocument.createElement('div');
  if (className !== undefined) {
    div.className = className;
  }
  parent.append(div);
  return div;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
