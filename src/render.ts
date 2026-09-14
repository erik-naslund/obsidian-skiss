import {
  type ClassNode,
  type Diagnostic,
  type Document,
  type FieldNode,
  parse,
  resolve,
  toMermaid,
} from '@eriknaslund/skiss';
import { loadMermaid } from 'obsidian';
import { describe, type LineScope } from './diagnostics';
import type { SkissSettings } from './settings';

/** `loadMermaid()` is untyped; this is the one call the plugin makes into it. */
interface Mermaid {
  render(id: string, text: string): Promise<{ svg: string }>;
}

const PLACEHOLDER = 'Nothing to draw yet';
const RENDER_FAILED = 'Diagram could not be rendered';
const COMPILE_FAILED = 'Block could not be compiled';
const SVG_UNPARSEABLE = 'Mermaid returned an SVG that could not be parsed';

const QUESTIONS_HEADING = 'Open questions';
const COMMENTS_HEADING = 'Comments';

// Mermaid keys the SVG it renders by id and collides when two blocks in one
// note share one, so every block gets its own.
let blocksRendered = 0;

/** How the lines of a block's diagnostics are turned into the lines a reader sees. */
interface Numbering {
  /** Added to a line the compiler reports. */
  offset: number;
  scope: LineScope;
}

/**
 * Compiles one `skiss` block and fills `el` with its diagram, its diagnostics,
 * its open questions and its comments, in that order, leaving out what
 * `settings` hides. Whatever the source, it renders something and throws
 * nothing.
 *
 * A block is a diagram; a note is a schema. The block is compiled on its own,
 * so a class declared in another block of the same note is undeclared here and
 * says so, while the export commands compile every block of the note together.
 * README, "Rendering vs export", says the same to a reader.
 *
 * `lineStart` is the note's own line, 0-based, that the opening fence sits on,
 * which is what `MarkdownPostProcessorContext.getSectionInfo` hands back. With
 * it, a diagnostic names the line of the note; without it — Obsidian returns
 * `null` in several circumstances — the block's own numbering is kept and the
 * wording says so.
 */
export async function render(
  source: string,
  el: HTMLElement,
  settings: SkissSettings,
  lineStart?: number,
): Promise<void> {
  let doc: Document;
  let output: string;
  try {
    // One pass: the diagram, the diagnostics, the doubts and the descriptions
    // all come from the document this resolves, so they cannot disagree.
    doc = resolve(parse(source));
    output = toMermaid(doc);
  } catch (error) {
    // "Never an empty block or a thrown exception" cannot rest on the package
    // never throwing, so a failure is reported where diagnostics are.
    appendDiv(el, 'skiss-placeholder').textContent = PLACEHOLDER;
    appendDiv(appendDiv(el, 'skiss-diagnostics')).textContent =
      `${COMPILE_FAILED}: ${messageOf(error)}`;
    return;
  }

  const numbering = numberingFrom(lineStart);

  // A document with no class has nothing to draw, which is the question being
  // asked — not what the empty diagram happens to be spelled as.
  if (doc.classes.length === 0) {
    appendDiv(el, 'skiss-placeholder').textContent = PLACEHOLDER;
    appendBelowDiagram(el, doc, settings, numbering);
    return;
  }

  // Everything below the diagram is appended before Mermaid is awaited, so it
  // settles under the diagram instead of sitting above it until it is drawn.
  const diagramEl = appendDiv(el, 'skiss-diagram');
  appendBelowDiagram(el, doc, settings, numbering);
  await draw(diagramEl, output);
}

/** The first line of a block body is the line after its opening fence. */
function numberingFrom(lineStart: number | undefined): Numbering {
  return lineStart === undefined
    ? { offset: 0, scope: 'block' }
    : { offset: lineStart + 1, scope: 'note' };
}

function appendBelowDiagram(
  el: HTMLElement,
  doc: Document,
  settings: SkissSettings,
  numbering: Numbering,
): void {
  const diagnostics = doc.diagnostics;
  // An error is never hidden, so hiding the warnings leaves the errors behind
  // rather than dropping the list.
  appendDiagnostics(
    el,
    settings.showWarnings ? diagnostics : diagnostics.filter(isError),
    numbering,
  );
  appendList(
    el,
    'skiss-questions',
    QUESTIONS_HEADING,
    settings.showQuestions ? label(doc, (node) => node.note) : [],
  );
  appendList(
    el,
    'skiss-comments',
    COMMENTS_HEADING,
    settings.showComments ? label(doc, (node) => node.description) : [],
  );
}

function isError(diagnostic: Diagnostic): boolean {
  return diagnostic.severity === 'error';
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

function appendDiagnostics(
  el: HTMLElement,
  diagnostics: readonly Diagnostic[],
  { offset, scope }: Numbering,
): void {
  const diagnosticsEl = appendDiv(el, 'skiss-diagnostics');
  for (const diagnostic of diagnostics) {
    appendDiv(diagnosticsEl).textContent = describe(diagnostic, diagnostic.line + offset, scope);
  }
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
 * Mermaid returns reaches the container as parsed nodes. That is what this
 * protects against: assigning markup runs a script the moment it is inserted,
 * and the guideline checker looks for the assignment, not for the markup.
 *
 * It is not a sanitizer. Nodes parsed here carry their attributes into the live
 * document, so an `onload` or an `onerror` among them would fire on insertion
 * exactly as it would through `innerHTML`. The SVG is trusted because of where
 * it comes from: Obsidian's own Mermaid, drawing text this plugin generated
 * locally from the note, and Mermaid runs its own DOMPurify pass over it.
 *
 * It is parsed as HTML, which is the parser `innerHTML` used: Mermaid
 * serialises its SVG from an HTML document, so it may carry HTML entities and
 * unclosed tags that a strict XML parse would reject. The HTML parser never
 * throws; a document whose first element is not an `<svg>` is a failed diagram
 * like any other.
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
