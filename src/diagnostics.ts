import type { Diagnostic } from '@eriknaslund/skiss';

/**
 * Where the line a diagnostic names is counted. `note` is what a reader can
 * navigate to; `block` is the fallback for a block whose place in its note
 * Obsidian will not say, and it is worded so the difference is visible.
 */
export type LineScope = 'note' | 'block';

const WORDING: Record<LineScope, { lower: string; capitalized: string }> = {
  note: { lower: 'line', capitalized: 'Line' },
  block: { lower: 'block line', capitalized: 'Block line' },
};

/**
 * A note is read, not compiled: `5:13: warning W_UNDECLARED_CLASS …` tells a
 * reader neither that `5` is a line nor what the code means. The column and the
 * code are dropped, the line is spelled out, and an error says so, which is
 * what sets it apart from a warning in a list of plain text. The rendered block
 * and the export notice both word a diagnostic this way, so the same warning
 * reads the same in either place.
 */
export function describe(
  { severity, message }: Diagnostic,
  line: number,
  scope: LineScope,
): string {
  const { lower, capitalized } = WORDING[scope];
  return severity === 'error'
    ? `Error, ${lower} ${line}: ${message}`
    : `${capitalized} ${line}: ${message}`;
}
