/**
 * The browser the PNG export draws on: an `Image` that loads a blob URL, a
 * canvas that records what was asked of it, and the `ClipboardItem` an image
 * goes onto the clipboard in.
 *
 * jsdom has no canvas, so no test run can rasterise anything; what these
 * doubles make testable is what the plugin decides — the size of the canvas, the
 * scale it draws at, that nothing is painted under the diagram, and the type it
 * asks the canvas for. That the PNG itself looks right is a vault check.
 *
 * `Blob` and `URL.createObjectURL` are not doubled: Node has both, so the blob
 * the SVG is wrapped in and the one the canvas hands back are real, and their
 * `arrayBuffer()` is the one `Vault.createBinary` is handed.
 */

/** What `Image` does when the export loads the blob URL of an SVG. */
interface Loads {
  /** The intrinsic size the browser gives the image, as `naturalWidth` reports it. */
  naturalWidth: number;
  naturalHeight: number;
  /** An SVG the image cannot read at all: the `error` event rather than `load`. */
  fails: boolean;
}

export class StubImage {
  /**
   * The next image loads like this. Static because `new Image()` is created
   * inside the code under test, which takes no doubles: a test says what the
   * browser will do with the SVG before it runs the export.
   */
  static loads: Loads = { naturalWidth: 0, naturalHeight: 0, fails: false };

  /** Every image the run created, in order, and the URL each was handed. */
  static readonly created: StubImage[] = [];

  static reset(loads: Partial<Loads> = {}): void {
    StubImage.loads = { naturalWidth: 0, naturalHeight: 0, fails: false, ...loads };
    StubImage.created.length = 0;
  }

  readonly naturalWidth: number;
  readonly naturalHeight: number;
  url = '';

  private readonly listeners = new Map<string, (() => void)[]>();

  constructor() {
    this.naturalWidth = StubImage.loads.naturalWidth;
    this.naturalHeight = StubImage.loads.naturalHeight;
    StubImage.created.push(this);
  }

  addEventListener(type: string, listener: () => void): void {
    const registered = this.listeners.get(type) ?? [];
    registered.push(listener);
    this.listeners.set(type, registered);
  }

  /** Setting `src` is what starts a load; a real one never finishes in the same tick. */
  set src(url: string) {
    this.url = url;
    void Promise.resolve().then(() => {
      for (const listener of this.listeners.get(StubImage.loads.fails ? 'error' : 'load') ?? []) {
        listener();
      }
    });
  }

  get src(): string {
    return this.url;
  }
}

/** The 2D context, which records what was drawn on it rather than drawing it. */
export class StubContext {
  readonly cleared: [number, number, number, number][] = [];
  readonly scaled: [number, number][] = [];
  readonly drawn: { image: unknown; args: number[] }[] = [];
  /** Nothing the plugin does should land here: a filled rectangle is a background. */
  readonly filled: [number, number, number, number][] = [];

  clearRect(x: number, y: number, width: number, height: number): void {
    this.cleared.push([x, y, width, height]);
  }

  scale(x: number, y: number): void {
    this.scaled.push([x, y]);
  }

  drawImage(image: unknown, ...args: number[]): void {
    this.drawn.push({ image, args });
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.filled.push([x, y, width, height]);
  }
}

export class StubCanvas {
  width = 0;
  height = 0;
  readonly context = new StubContext();

  /** The type the export asked for, and whether the canvas gave one at all. */
  requestedContext: string | null = null;
  hasContext = true;

  /** What `toBlob` hands the callback: a real `Blob`, or `null` as a canvas may. */
  blob: Blob | null = new Blob(['png'], { type: 'image/png' });
  requestedType: string | undefined = undefined;

  getContext(type: string): StubContext | null {
    this.requestedContext = type;
    return this.hasContext ? this.context : null;
  }

  toBlob(callback: (blob: Blob | null) => void, type?: string): void {
    this.requestedType = type;
    callback(this.blob);
  }
}

/** `new ClipboardItem({ 'image/png': blob })`, as the clipboard write builds one. */
export class StubClipboardItem {
  constructor(readonly items: Record<string, Blob>) {}
}
