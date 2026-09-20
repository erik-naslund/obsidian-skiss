/**
 * What the editor has to say about the `skiss` blocks of a note: which runs of
 * which lines carry which colour, and which lines carry a diagnostic. Both are
 * plain data about note lines, so the CodeMirror extension in `editor.ts` is
 * left with the mapping onto a document and nothing else, and both can be
 * tested without an editor.
 */

import { type Diagnostic, parse, resolve } from '@eriknaslund/skiss';
import { skissFences } from './fences';
import { tokenizeLine } from './tokenize';

/** The class prefix the issue asks for, and `styles.css` styles. */
const CLASS_PREFIX = 'cm-skiss-';

/** One coloured run of one line. */
export interface HighlightSpan {
  /** The note's own line, 1-based. */
  line: number;
  /** Where the run starts on that line, counted from the start of the line. */
  from: number;
  to: number;
  className: string;
}

/** A diagnostic of a block, on the note's own line rather than the block's. */
export interface LineDiagnostic {
  /** The note's own line, 1-based. */
  line: number;
  severity: 'error' | 'warning';
  /** The compiler's own wording, which the gutter marker shows on hover. */
  message: string;
}

/**
 * Every span of every `skiss` block in `text`, for the lines `wanted` accepts —
 * the editor passes what is on screen, so a note that is mostly scrolled away
 * is mostly not tokenized. Ascending, so a range set can be built from them
 * as they come.
 *
 * Only the lines between the fences: the fence lines themselves belong to
 * Obsidian's own Markdown mode (ADR 0003).
 */
export function highlightSpans(
  text: string,
  wanted: (line: number) => boolean = () => true,
): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  for (const fence of skissFences(text)) {
    for (const body of fence.lines) {
      if (!wanted(body.line)) {
        continue;
      }
      for (const token of tokenizeLine(body.text)) {
        spans.push({
          line: body.line,
          // The blockquote markers and the indentation the block was written
          // with are not part of the block; the compiler never saw them.
          from: body.offset + token.from,
          to: body.offset + token.to,
          className: `${CLASS_PREFIX}${token.kind}`,
        });
      }
    }
  }
  return spans;
}

/**
 * The diagnostics of every `skiss` block in `text`, on the note's own lines. A
 * block is compiled on its own, as the block processor compiles it, so the
 * gutter of a note agrees with what its blocks render (ARCHITECTURE.md, "A
 * block is a diagram; a note is a schema").
 *
 * `showWarnings` is the reader's setting. Errors are never hidden: a block that
 * fails to parse must never look fine.
 */
export function blockDiagnostics(text: string, showWarnings: boolean): LineDiagnostic[] {
  const found: LineDiagnostic[] = [];
  for (const fence of skissFences(text)) {
    const body = fence.lines.map((line) => line.text).join('\n');
    let diagnostics: readonly Diagnostic[];
    try {
      diagnostics = resolve(parse(body)).diagnostics;
    } catch {
      // A compiler that throws is reported by the block itself, which renders
      // the failure where its diagnostics would have been. The gutter says
      // nothing rather than inventing a line for it.
      continue;
    }

    for (const diagnostic of diagnostics) {
      if (diagnostic.severity !== 'error' && !showWarnings) {
        continue;
      }
      // The compiler counts from the top of the block; the editor counts from
      // the top of the note. A line the block does not have is dropped rather
      // than marked somewhere it would mislead.
      const line = fence.lines[diagnostic.line - 1];
      if (line === undefined) {
        continue;
      }
      found.push({ line: line.line, severity: diagnostic.severity, message: diagnostic.message });
    }
  }
  return found;
}
