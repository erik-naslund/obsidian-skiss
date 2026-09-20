import { type CompileResult, compile, type Diagnostic } from '@eriknaslund/skiss';
import { type MarkdownView, Notice, normalizePath, TFile, type Vault } from 'obsidian';
import { describe } from './diagnostics';
import { diagramPng, diagramSvg } from './image';

/** The info string of a block these commands export, and the fence it opens. */
const LANGUAGE = 'skiss';

/**
 * What the blocks of a note are compiled to. `svg` and `png` are the Mermaid
 * diagram drawn and then rasterised, so both carry whatever `mermaid` carries.
 */
export type Format = 'linkml' | 'mermaid' | 'svg' | 'png';

/** Where the compiled text goes. */
export type Sink = 'file' | 'clipboard';

interface FormatSpec {
  /** What the notices call the format. */
  label: string;
  /** Appended to the note's basename by the file sink. */
  suffix: string;
}

const FORMATS: Record<Format, FormatSpec> = {
  linkml: { label: 'LinkML', suffix: '.linkml.yaml' },
  // `.mmd` is the extension the skiss CLI's own fixtures use.
  mermaid: { label: 'Mermaid', suffix: '.mmd' },
  svg: { label: 'SVG', suffix: '.svg' },
  png: { label: 'PNG', suffix: '.png' },
};

const NO_BLOCKS = 'No skiss blocks in this note';

/** The export's own path is taken by a folder, so there is nowhere to write. */
const PATH_IS_A_FOLDER = 'A folder is in the way of the export';

/** No `ClipboardItem`, so there is no way to put an image on the clipboard. */
const NO_IMAGE_CLIPBOARD = 'This device cannot put an image on the clipboard';

/** A notice is a small box; the rest of the diagnostics are in the block itself. */
const DIAGNOSTICS_IN_NOTICE = 3;

interface Fence {
  /** The run of backticks or tildes that opened the block. */
  marker: string;
  /** Blockquote markers the opening fence carried, stripped from every line. */
  quotes: number;
  /** Indentation of the opening fence inside the quote, stripped from every body line. */
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
      body.push(bodyLine(lines[index] ?? '', fence));
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

/**
 * `<note>.linkml.yaml`, `<note>.mmd`, `<note>.svg` or `<note>.png`, in the
 * note's own folder. The path is built here rather than taken from the user, and
 * the guidelines ask for `normalizePath` on it: that is what makes a folder or a
 * note name carrying a non-breaking space or a decomposed accent find the file
 * the vault holds.
 */
export function outputPathFor(notePath: string, format: Format): string {
  const slash = notePath.lastIndexOf('/');
  const folder = slash === -1 ? '' : notePath.slice(0, slash + 1);
  return normalizePath(`${folder}${basenameOf(notePath)}${FORMATS[format].suffix}`);
}

/**
 * The whole note as one document in `format`. Every format reads the same
 * concatenated source, so a note is one schema and one diagram, and the
 * diagnostics of any of them map back to note lines the same way. The image
 * formats compile to Mermaid and are drawn from that, so a note exports the
 * same diagram whether it is asked for as text or as a picture.
 */
export function compileNote(source: string, format: Format, notePath: string): CompileResult {
  // `notes` stays off, so `?` doubts are no more drawn on an exported diagram
  // than on the one in the block.
  return format === 'linkml'
    ? compile(source, { target: 'linkml', schemaName: schemaNameFor(notePath) })
    : compile(source, { target: 'mermaid' });
}

/**
 * What a sink is handed: the compiled text, or the diagram as a PNG. Only the
 * image formats reach a browser, and only the PNG comes back as bytes.
 */
type Payload = { kind: 'text'; text: string } | { kind: 'image'; blob: Blob };

/**
 * The compiled text as the sinks take it. `svg` is the markup Mermaid returns,
 * as is; `png` is that markup rasterised.
 */
async function payloadOf(format: Format, output: string): Promise<Payload> {
  if (format !== 'svg' && format !== 'png') {
    return { kind: 'text', text: output };
  }

  const svg = await diagramSvg(output);
  return format === 'svg'
    ? { kind: 'text', text: svg }
    : { kind: 'image', blob: await diagramPng(svg) };
}

/**
 * Compiles every `skiss` block in `file` to `format` and hands the result to
 * `sink`. Reports what happened through notices and never throws: a command
 * that fails silently leaves the vault in a state the user cannot see.
 */
export async function exportNote(
  vault: Vault,
  file: TFile,
  format: Format,
  sink: Sink,
  view?: MarkdownView,
): Promise<void> {
  try {
    const blocks = skissBlocks(await noteTextOf(vault, file, view));
    if (blocks.length === 0) {
      new Notice(NO_BLOCKS);
      return;
    }

    // Before anything is drawn: a webview with no `ClipboardItem` cannot take
    // an image however well the PNG turns out, and the reason the user is given
    // should be that one rather than whatever fails after it.
    if (format === 'png' && sink === 'clipboard' && !clipboardTakesImages()) {
      new Notice(NO_IMAGE_CLIPBOARD);
      return;
    }

    const { output, diagnostics } = compileNote(concatenateBlocks(blocks), format, file.path);
    const payload = await payloadOf(format, output);

    if (sink === 'file') {
      await writeNextToNote(vault, file.path, format, payload);
    } else {
      await copyToClipboard(format, payload);
    }

    if (diagnostics.length > 0) {
      new Notice(diagnosticsMessage(blocks, diagnostics));
    }
  } catch (error) {
    new Notice(`Export failed: ${messageOf(error)}`);
  }
}

/**
 * The note as the user sees it. Obsidian writes the editor to disk on a
 * debounce, so the file lags the buffer by a moment: an export run straight
 * after typing would miss the last line. The buffer is read when the active
 * view holds this very note, and the file otherwise.
 */
function noteTextOf(vault: Vault, file: TFile, view: MarkdownView | undefined): Promise<string> {
  if (view !== undefined && view.file?.path === file.path) {
    return Promise.resolve(view.editor.getValue());
  }
  return vault.read(file);
}

/**
 * Always the note's own sibling path, never anything else: re-exporting a note
 * refreshes the file it wrote last time. `process` rather than `modify`, as the
 * guidelines ask for a file the user is not editing — it is atomic against
 * another plugin writing the same file — and the notice says which of the two
 * happened, because creating a file and overwriting one are not the same thing
 * to whoever hand-edited it.
 *
 * The lookup is `getAbstractFileByPath`, not `getFileByPath`: the latter hands
 * back `null` for a path a *folder* occupies, and `create` then throws
 * "File already exists" at a user who cannot tell what the export tripped over.
 * A folder is named instead, and nothing is written.
 */
async function writeNextToNote(
  vault: Vault,
  notePath: string,
  format: Format,
  payload: Payload,
): Promise<void> {
  const path = outputPathFor(notePath, format);
  const existing = vault.getAbstractFileByPath(path);
  if (existing === null) {
    await createExport(vault, path, payload);
    new Notice(`Created ${path}`);
  } else if (existing instanceof TFile) {
    await overwrite(vault, existing, payload);
    new Notice(`Updated ${path}`);
  } else {
    new Notice(`${PATH_IS_A_FOLDER}: ${path}`);
  }
}

/** `createBinary` for the PNG, `create` for the formats that are text. */
async function createExport(vault: Vault, path: string, payload: Payload): Promise<void> {
  if (payload.kind === 'text') {
    await vault.create(path, payload.text);
    return;
  }
  await vault.createBinary(path, await payload.blob.arrayBuffer());
}

/**
 * `process` for text, which is atomic against another plugin writing the same
 * file. A `Vault` has no binary `process`, so the PNG goes through
 * `modifyBinary` — the write for a file the user is not editing — and the
 * create-or-update notice is the same either way.
 */
async function overwrite(vault: Vault, file: TFile, payload: Payload): Promise<void> {
  if (payload.kind === 'text') {
    await vault.process(file, () => payload.text);
    return;
  }
  await vault.modifyBinary(file, await payload.blob.arrayBuffer());
}

async function copyToClipboard(format: Format, payload: Payload): Promise<void> {
  if (payload.kind === 'text') {
    await navigator.clipboard.writeText(payload.text);
  } else {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': payload.blob })]);
  }
  new Notice(`Copied ${FORMATS[format].label} to clipboard`);
}

/**
 * Whether an image can be put on the clipboard at all. `ClipboardItem` is what
 * some mobile webviews do not carry; where it is missing the command says so
 * and writes nothing, rather than copying the SVG markup as a consolation the
 * user did not ask for.
 */
function clipboardTakesImages(): boolean {
  return typeof ClipboardItem !== 'undefined';
}

function diagnosticsMessage(blocks: Block[], diagnostics: Diagnostic[]): string {
  const count = diagnostics.length;
  const heading = `${count} diagnostic${count === 1 ? '' : 's'}`;
  const shown = diagnostics
    .slice(0, DIAGNOSTICS_IN_NOTICE)
    .map((d) => describe(d, noteLineOf(blocks, d.line), 'note'));
  return [heading, ...shown].join('\n');
}

function lineCountOf(body: string): number {
  return body.split('\n').length;
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
function bodyLine(line: string, fence: Fence): string {
  return dedent(unquote(line, fence.quotes).text, fence.indent);
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
