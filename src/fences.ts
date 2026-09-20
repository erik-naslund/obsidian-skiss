/**
 * Where the `skiss` blocks of a note are. Markdown fences only: nothing here
 * reads the language, and what a body line says is the compiler's business.
 *
 * The export commands want the body of a block as one string; the editor
 * extension wants the note's own line each body line sits on, and how many
 * characters of blockquote marker and fence indentation come before it, so a
 * decoration lands on the word the user sees rather than on the quote. One
 * scan answers both, so the two cannot disagree about what a fence is.
 */

/** The info string of a block, and the fence it opens. */
const LANGUAGE = 'skiss';

interface Fence {
  /** The run of backticks or tildes that opened the block. */
  marker: string;
  /** Blockquote markers the opening fence carried, stripped from every line. */
  quotes: number;
  /** Indentation of the opening fence inside the quote, stripped from every body line. */
  indent: number;
  skiss: boolean;
}

/** One line of a block's body, and where it sits in the note. */
export interface BodyLine {
  /** The note's own line, 1-based. */
  line: number;
  /** Characters before the body text: the blockquote markers and the indentation. */
  offset: number;
  /** The line as the compiler sees it, with those characters off. */
  text: string;
}

/** A `skiss` block of a note, line by line. */
export interface SkissFence {
  /** The note's own line, 1-based, that the body's first line is on. */
  line: number;
  lines: BodyLine[];
}

/**
 * Every fenced `skiss` block in `text`, in the order they appear. A fence that
 * is never closed runs to the end of the note, as Obsidian's own renderer
 * treats it.
 */
export function skissFences(text: string): SkissFence[] {
  const lines = text.split(/\r?\n/);
  const fences: SkissFence[] = [];

  let index = 0;
  while (index < lines.length) {
    const fence = openingFence(lines[index] ?? '');
    index += 1;
    if (fence === undefined) {
      continue;
    }

    const start = index;
    const body: BodyLine[] = [];
    while (index < lines.length && !closesFence(lines[index] ?? '', fence)) {
      body.push(bodyLine(lines[index] ?? '', index + 1, fence));
      index += 1;
    }
    index += 1;

    if (fence.skiss) {
      fences.push({ line: start + 1, lines: body });
    }
  }

  return fences;
}

/** A blockquote marker, as Obsidian's own renderer reads one. */
const QUOTE_MARKER = /^ {0,3}> ?/;

/** How deep a quote may nest before the opening fence of a block is looked for. */
const ANY_DEPTH = Number.POSITIVE_INFINITY;

/**
 * A line with up to `limit` blockquote markers taken off the front. Obsidian
 * renders a fence inside a blockquote through the same processor, so the `>`
 * every line of such a block carries belongs to the quote, not to the block.
 * A body line is unquoted only as deeply as its opening fence was, so a `>` the
 * user wrote inside the block is left where it is.
 */
function unquote(line: string, limit: number): { quotes: number; text: string } {
  let text = line;
  let quotes = 0;
  while (quotes < limit) {
    const match = QUOTE_MARKER.exec(text);
    if (match === null) {
      break;
    }
    quotes += 1;
    text = text.slice(match[0].length);
  }
  return { quotes, text };
}

function openingFence(line: string): Fence | undefined {
  const { quotes, text } = unquote(line, ANY_DEPTH);
  // Not the 0-3 spaces of a top-level fence: a fence inside a list item is
  // indented relative to its marker, as deeply as the list nests, and Obsidian
  // renders that through this same processor. Its own indentation is the
  // baseline the body is measured against.
  const match = /^( *)(`{3,}|~{3,})(.*)$/.exec(text);
  if (match === null) {
    return undefined;
  }

  const [, indent = '', marker = '', info = ''] = match;
  // A backtick fence's info string may not contain a backtick (CommonMark §4.5).
  if (marker.startsWith('`') && info.includes('`')) {
    return undefined;
  }

  return {
    marker,
    quotes,
    indent: indent.length,
    // The first word only, so that `skiss title=Foo` exports and `skisser` does not.
    skiss: info.trim().split(/\s+/)[0] === LANGUAGE,
  };
}

function closesFence(line: string, fence: Fence): boolean {
  // The closing fence of an indented block carries that indentation too.
  const match = /^ *(`{3,}|~{3,})[ \t]*$/.exec(unquote(line, fence.quotes).text);
  if (match === null) {
    return false;
  }

  const marker = match[1] ?? '';
  return marker[0] === fence.marker[0] && marker.length >= fence.marker.length;
}

/** One line of a block's body, with the quote and the fence's indentation off. */
function bodyLine(line: string, number: number, fence: Fence): BodyLine {
  const text = dedent(unquote(line, fence.quotes).text, fence.indent);
  // Only the front of the line is ever taken off, so what is left of its
  // length is where the body text starts.
  return { line: number, offset: line.length - text.length, text };
}

function dedent(line: string, indent: number): string {
  let stripped = 0;
  while (stripped < indent && line[stripped] === ' ') {
    stripped += 1;
  }
  return line.slice(stripped);
}
