import {
  type ClassNode,
  compile,
  type Diagnostic,
  type Document,
  type FieldNode,
  parse,
  resolve,
} from '@eriknaslund/skiss';
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

const QUESTIONS_HEADING = 'Open questions';
const COMMENTS_HEADING = 'Comments';

// Mermaid keys the SVG it renders by id and collides when two blocks in one
// note share one, so every block gets its own.
let blocksRendered = 0;

/**
 * Compiles one `skiss` block and fills `el` with its diagram, its diagnostics,
 * its open questions and its comments, in that order. Whatever the source, it
 * renders something and throws nothing.
 */
export async function render(source: string, el: HTMLElement): Promise<void> {
  const { output, diagnostics } = compile(source, { target: 'mermaid' });
  // `compile` hands back text, not a document, so the doubts and the
  // descriptions are read off a second pass. The diagram keeps coming from
  // `compile` with `notes` off, which is what leaves it unchanged.
  const doc = resolve(parse(source));

  if (output.trim() === EMPTY_DIAGRAM) {
    appendDiv(el, 'skiss-placeholder').textContent = PLACEHOLDER;
    appendBelowDiagram(el, diagnostics, doc);
    return;
  }

  // Everything below the diagram is appended before Mermaid is awaited, so it
  // settles under the diagram instead of sitting above it until it is drawn.
  const diagramEl = appendDiv(el, 'skiss-diagram');
  appendBelowDiagram(el, diagnostics, doc);
  await draw(diagramEl, output);
}

function appendBelowDiagram(
  el: HTMLElement,
  diagnostics: readonly Diagnostic[],
  doc: Document,
): void {
  appendDiagnostics(el, diagnostics);
  appendList(
    el,
    'skiss-questions',
    QUESTIONS_HEADING,
    label(doc, (node) => node.note),
  );
  appendList(
    el,
    'skiss-comments',
    COMMENTS_HEADING,
    label(doc, (node) => node.description),
  );
}

/**
 * The `?` doubts or the `#` descriptions of a document, in source order, each
 * prefixed with what carries it. The prefix is separated by a colon, as a
 * diagnostic separates its line number from its message.
 */
function label(doc: Document, pick: (node: ClassNode | FieldNode) => string | undefined): string[] {
  const lines: string[] = [];
  for (const classNode of doc.classes) {
    const onClass = pick(classNode);
    if (onClass !== undefined) {
      lines.push(`${classNode.name.text}: ${onClass}`);
    }
    for (const field of classNode.fields) {
      const onField = pick(field);
      if (onField !== undefined) {
        lines.push(`${classNode.name.text}.${field.name.text}: ${onField}`);
      }
    }
  }
  return lines;
}

/** A headed list, or nothing at all when the document carries no such line. */
function appendList(
  el: HTMLElement,
  className: string,
  heading: string,
  lines: readonly string[],
): void {
  if (lines.length === 0) {
    return;
  }
  const listEl = appendDiv(el, className);
  appendDiv(listEl, 'skiss-list-heading').textContent = heading;
  for (const line of lines) {
    appendDiv(listEl).textContent = line;
  }
}

function appendDiagnostics(el: HTMLElement, diagnostics: readonly Diagnostic[]): void {
  const diagnosticsEl = appendDiv(el, 'skiss-diagnostics');
  for (const diagnostic of diagnostics) {
    appendDiv(diagnosticsEl).textContent = describe(diagnostic);
  }
}

/**
 * A note is read, not compiled: `5:13: warning W_UNDECLARED_CLASS …` tells a
 * reader neither that `5` is a line nor what the code means. The column and the
 * code are dropped, the line is spelled out, and an error says so, which is
 * what sets it apart from a warning in a list of plain text.
 */
function describe({ severity, line, message }: Diagnostic): string {
  return severity === 'error' ? `Error, line ${line}: ${message}` : `Line ${line}: ${message}`;
}

async function draw(diagramEl: HTMLElement, output: string): Promise<void> {
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
