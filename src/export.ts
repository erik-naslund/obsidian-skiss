import { compile, type Diagnostic, formatDiagnostic } from '@eriknaslund/skiss';
import { Notice, type TFile, type Vault } from 'obsidian';

/** The info string of a block this command exports, and the fence it opens. */
const LANGUAGE = 'skiss';

const OUTPUT_SUFFIX = '.linkml.yaml';

const NO_BLOCKS = 'No skiss blocks in this note';

/** A notice is a small box; the rest of the diagnostics are in the block itself. */
const DIAGNOSTICS_IN_NOTICE = 3;

interface Fence {
  /** The run of backticks or tildes that opened the block. */
  marker: string;
  /** Leading spaces on the opening fence, stripped from every body line. */
  indent: number;
  skiss: boolean;
}

/** A `skiss` block of a note, and where its body sits in that note. */
export interface Block {
  body: string;
  /** The note's own line, 1-based, that the body's first line is on. */
  line: number;
}

/**
 * Every fenced `skiss` block in `text`, in the order they appear. A fence that
 * is never closed runs to the end of the note, as Obsidian's own renderer
 * treats it.
 */
export function skissBlocks(text: string): Block[] {
  const lines = text.split(/\r?\n/);
  const blocks: Block[] = [];

  let index = 0;
  while (index < lines.length) {
    const fence = openingFence(lines[index] ?? '');
    index += 1;
    if (fence === undefined) {
      continue;
    }

    const start = index;
    const body: string[] = [];
    while (index < lines.length && !closesFence(lines[index] ?? '', fence)) {
      body.push(dedent(lines[index] ?? '', fence.indent));
      index += 1;
    }
    index += 1;

    if (fence.skiss) {
      blocks.push({ body: body.join('\n'), line: start + 1 });
    }
  }

  return blocks;
}

/** One source for the whole note: the blocks in order, separated by a blank line. */
export function concatenateBlocks(blocks: Block[]): string {
  return `${blocks.map((block) => block.body).join('\n\n')}\n`;
}

/**
 * The note line that line `line` of the concatenated source sits on. The
 * compiler counts from the top of a source the user never sees, so a number
 * straight from a diagnostic matches nothing in the note.
 */
export function noteLineOf(blocks: Block[], line: number): number {
  let start = 1;
  let noteLine = line;
  for (const block of blocks) {
    if (line < start) {
      break;
    }
    noteLine = block.line + (line - start);
    // The blank line `concatenateBlocks` puts between two blocks.
    start += lineCountOf(block.body) + 1;
  }
  return noteLine;
}

/**
 * The note's basename. `compile` normalises it into a LinkML name itself
 * (SPEC §5.2), so the plugin passes it through untouched.
 */
export function schemaNameFor(notePath: string): string {
  return basenameOf(notePath);
}

/** `<note>.linkml.yaml`, in the note's own folder. */
export function outputPathFor(notePath: string): string {
  const slash = notePath.lastIndexOf('/');
  const folder = slash === -1 ? '' : notePath.slice(0, slash + 1);
  return `${folder}${basenameOf(notePath)}${OUTPUT_SUFFIX}`;
}

/**
 * Compiles every `skiss` block in `file` and writes the schema next to it.
 * Reports what happened through notices and never throws: a command that
 * fails silently leaves the vault in a state the user cannot see.
 */
export async function exportToLinkML(vault: Vault, file: TFile): Promise<void> {
  try {
    const blocks = skissBlocks(await vault.read(file));
    if (blocks.length === 0) {
      new Notice(NO_BLOCKS);
      return;
    }

    const { output, diagnostics } = compile(concatenateBlocks(blocks), {
      target: 'linkml',
      schemaName: schemaNameFor(file.path),
    });

    const path = outputPathFor(file.path);
    const existing = vault.getFileByPath(path);
    if (existing === null) {
      await vault.create(path, output);
    } else {
      await vault.modify(existing, output);
    }

    new Notice(`Exported to ${path}`);
    if (diagnostics.length > 0) {
      new Notice(diagnosticsMessage(blocks, diagnostics));
    }
  } catch (error) {
    new Notice(`Export failed: ${messageOf(error)}`);
  }
}

function diagnosticsMessage(blocks: Block[], diagnostics: Diagnostic[]): string {
  const count = diagnostics.length;
  const heading = `${count} diagnostic${count === 1 ? '' : 's'}`;
  const shown = diagnostics
    .slice(0, DIAGNOSTICS_IN_NOTICE)
    .map((d) => formatDiagnostic({ ...d, line: noteLineOf(blocks, d.line) }));
  return [heading, ...shown].join('\n');
}

function lineCountOf(body: string): number {
  return body.split('\n').length;
}

function openingFence(line: string): Fence | undefined {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
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
    indent: indent.length,
    // The first word only, so that `skiss title=Foo` exports and `skisser` does not.
    skiss: info.trim().split(/\s+/)[0] === LANGUAGE,
  };
}

function closesFence(line: string, fence: Fence): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  if (match === null) {
    return false;
  }

  const marker = match[1] ?? '';
  return marker[0] === fence.marker[0] && marker.length >= fence.marker.length;
}

function dedent(line: string, indent: number): string {
  let stripped = 0;
  while (stripped < indent && line[stripped] === ' ') {
    stripped += 1;
  }
  return line.slice(stripped);
}

function basenameOf(notePath: string): string {
  const name = notePath.slice(notePath.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
