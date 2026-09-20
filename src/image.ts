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
  const { svg } = await mermaid.render(`skiss-export-${diagramsRendered}`, mermaidText);
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

/** `toBlob` is the callback form of every canvas; this is it as a promise. */
function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error(NO_PNG));
      } else {
        resolve(blob);
      }
    }, 'image/png');
  });
}
