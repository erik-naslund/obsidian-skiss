import { loadMermaid } from 'obsidian';

/** `loadMermaid()` is untyped; this is the one call the plugin makes into it. */
interface Mermaid {
  render(id: string, text: string): Promise<{ svg: string }>;
}

/** What the notices say when a step of the rasterisation has nothing to hand on. */
const IMAGE_FAILED = 'the diagram could not be loaded as an image';
const NO_CANVAS = 'this device gave no canvas to draw the PNG on';
const NO_SIZE = 'the diagram has no size to rasterise';
const NO_PNG = 'the canvas produced no PNG';
const NOT_RASTERISABLE = 'the diagram could not be rasterised on this device';

/**
 * Prepended to the Mermaid text the export draws, and to that text only.
 *
 * Mermaid writes its labels as HTML inside `<foreignObject>` by default. An SVG
 * carrying one taints the canvas it is drawn on, and `toBlob` then throws a
 * `SecurityError` instead of handing back a PNG, so every PNG export of a
 * diagram with a label failed (#51). Off, the labels are plain SVG `<text>`,
 * which taints no canvas and which drawing tools that do not render
 * `foreignObject` — Illustrator, Inkscape, Keynote — open correctly.
 *
 * Two keys, because a class diagram draws its labels through two of Mermaid's:
 * the class boxes read the root `htmlLabels`, and the arrow labels read
 * `flowchart.htmlLabels`, which is the shared edge-label helper's. The
 * diagram-specific `class.htmlLabels` the config schema carries is read by no
 * 11.x and is left out. Checked against Mermaid 11.4, 11.6, 11.9, 11.12 and
 * 11.17 in Chromium: with both keys the SVG carries no `foreignObject` and
 * `toBlob` hands back a PNG; with either missing it still throws.
 *
 * A directive rather than `mermaid.initialize`: `render` reads the directives
 * of the text it is given, resets the configuration before each render, and
 * keeps neither key for `initialize` alone. The block in the note is drawn by
 * its own call and is unchanged.
 */
const PLAIN_LABELS = '%%{init: {"htmlLabels": false, "flowchart": {"htmlLabels": false}}}%%';

/**
 * How many image pixels the PNG carries per diagram pixel. Fixed rather than
 * read from `window.devicePixelRatio`: a note exported on a laptop and the same
 * note exported on an external monitor should be the same file, and 2 is what
 * keeps the labels of a pasted diagram legible.
 */
const PIXEL_RATIO = 2;

// Mermaid keys the SVG it renders by id and collides when two renders share
// one, so the export counts its own, beside the blocks the note is drawing.
let diagramsRendered = 0;

/**
 * The Mermaid text of a whole note as SVG markup, drawn by the Mermaid that
 * ships with Obsidian ([ADR 0002](../docs/adr/0002-obsidian-bundled-mermaid.md)).
 * Off-screen: `render` returns the markup and attaches nothing to the document,
 * which is what lets a command export a diagram the note never rendered.
 */
export async function diagramSvg(mermaidText: string): Promise<string> {
  diagramsRendered += 1;
  const mermaid = (await loadMermaid()) as Mermaid;
  const { svg } = await mermaid.render(
    `skiss-export-${diagramsRendered}`,
    `${PLAIN_LABELS}\n${mermaidText}`,
  );
  return svg;
}

/**
 * The same SVG as a PNG. The SVG reaches the image through a blob URL rather
 * than a `data:` URL, so a diagram of any size fits, and the URL is revoked
 * again: it holds the blob alive for as long as the document lives otherwise.
 */
export async function diagramPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    return await rasterise(svg, await loadImage(url));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterise(svg: string, image: HTMLImageElement): Promise<Blob> {
  const { width, height } = sizeOf(svg, image);
  // Obsidian's `createEl`, not `document.createElement`: the community
  // directory's scan flags the latter (prefer-create-el), and the helper is
  // what the rest of the plugin builds elements with. Nothing attaches it.
  const canvas = createEl('canvas');
  canvas.width = Math.round(width * PIXEL_RATIO);
  canvas.height = Math.round(height * PIXEL_RATIO);

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error(NO_CANVAS);
  }

  // Nothing is painted under the diagram: a canvas starts out transparent, and
  // a PNG carrying the background of the theme it was exported from is the
  // wrong picture everywhere else it is pasted.
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(PIXEL_RATIO, PIXEL_RATIO);
  // The destination size is given, not left to the image: Mermaid sizes its SVG
  // to its container, so the size the browser gave the image is not the size of
  // the diagram.
  context.drawImage(image, 0, 0, width, height);

  return await toPng(canvas);
}

/**
 * The size the diagram is drawn at: the box its own coordinates span, which is
 * what Mermaid writes into `viewBox`, and the size the browser gave the image
 * otherwise. Mermaid asks for the width of its container rather than a number
 * of pixels, and an image with no intrinsic width is 300 pixels wide by the CSS
 * default — a diagram of any size would export at that one width.
 *
 * The `viewBox` is read off the markup rather than off a parsed document: the
 * root element is the first thing serialised, so the first `viewBox` in the
 * markup is the root's, and two numbers do not need a parser.
 */
function sizeOf(svg: string, image: HTMLImageElement): { width: number; height: number } {
  const box = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/.exec(
    svg,
  );
  const fromBox = { width: Number(box?.[1]), height: Number(box?.[2]) };
  if (isDrawable(fromBox)) {
    return fromBox;
  }

  const intrinsic = { width: image.naturalWidth, height: image.naturalHeight };
  if (isDrawable(intrinsic)) {
    return intrinsic;
  }

  throw new Error(NO_SIZE);
}

function isDrawable({ width, height }: { width: number; height: number }): boolean {
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    // The event says nothing about what went wrong, so the message says only
    // which step it was; a broken SVG is the one thing that reaches this.
    image.addEventListener('error', () => reject(new Error(IMAGE_FAILED)));
    image.src = url;
  });
}

/**
 * `toBlob` is the callback form of every canvas; this is it as a promise. It
 * also throws, rather than calling back, where the browser refuses to read the
 * canvas at all, so the call is guarded.
 */
function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob === null) {
          reject(new Error(NO_PNG));
        } else {
          resolve(blob);
        }
      }, 'image/png');
    } catch (error) {
      reject(rasterisationError(error));
    }
  });
}

/**
 * What the notice says about a canvas the browser would not hand back. A
 * `SecurityError` is a canvas it considers tainted — "Tainted canvases may not
 * be exported" names no device and asks for nothing the user could do — so the
 * sentence that does comes first and the browser's own wording follows it.
 * Anything else reaches the notice as it is.
 */
function rasterisationError(error: unknown): Error {
  if (nameOf(error) !== 'SecurityError') {
    return error instanceof Error ? error : new Error(String(error));
  }
  return new Error(`${NOT_RASTERISABLE}: ${messageOf(error)}`);
}

/**
 * The `name` and the `message` of a thrown value, read off it rather than
 * through `instanceof Error`: a `DOMException` is what a canvas throws, and
 * whether that counts as an `Error` is the engine's answer, not ours.
 */
function nameOf(error: unknown): string {
  return propertyOf(error, 'name');
}

function messageOf(error: unknown): string {
  return propertyOf(error, 'message') || String(error);
}

function propertyOf(error: unknown, key: 'name' | 'message'): string {
  if (typeof error !== 'object' || error === null || !(key in error)) {
    return '';
  }
  const value: unknown = Reflect.get(error, key);
  return typeof value === 'string' ? value : '';
}
