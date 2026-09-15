/**
 * The DOM `render` and the settings tab touch, and no more. The plugin ships
 * nothing but `@eriknaslund/skiss`, and keeping this double small keeps both it
 * and the code honest about how much DOM they use: what the double cannot
 * express, the code does not rely on.
 *
 * The one exception is `render-svg.test.ts`, which runs against a real
 * `DOMParser` under jsdom. `StubDOMParser` below reads the first tag name with
 * a regex, so it cannot fail the way a browser's parser does — foreign content,
 * the SVG attribute-adjustment table, entities, cross-document adoption — and
 * that is where a "Mermaid returned an SVG that could not be parsed" comes
 * from. jsdom is a devDependency for that file alone; everything else, this.
 */
export class StubElement {
  className = '';
  textContent = '';
  readonly children: StubElement[] = [];
  readonly ownerDocument = {
    createElement: (tagName: string): StubElement => new StubElement(tagName),
  };

  constructor(readonly tagName: string = 'div') {}

  append(child: StubElement): void {
    this.children.push(child);
  }

  /** The settings tab clears its container before it fills it again. */
  empty(): void {
    this.children.length = 0;
  }

  /** The first descendant carrying `className`, searched depth first. */
  find(className: string): StubElement | undefined {
    for (const child of this.children) {
      if (child.className === className) {
        return child;
      }
      const found = child.find(className);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  /** The text of each direct child, one per rendered line. */
  lines(): string[] {
    return this.children.map((child) => child.textContent);
  }
}

/** What the double's `DOMParser` hands back: the one path `render` reads. */
export class StubDocument {
  readonly body: { firstElementChild: StubElement | null };

  constructor(firstElementChild: StubElement | null) {
    this.body = { firstElementChild };
  }
}

/**
 * `DOMParser` is a browser global; in a test run there is none. This double
 * reads the first tag name, which is all `render` looks at, and hands back an
 * empty body for source with no tag, as the HTML parser does for plain text.
 */
export class StubDOMParser {
  parseFromString(source: string, _type: string): StubDocument {
    const rootTag = /^\s*<([a-zA-Z][\w.:-]*)/.exec(source)?.[1];
    return new StubDocument(rootTag === undefined ? null : new StubElement(rootTag));
  }
}

/** `render` takes an Obsidian container; the double stands in for one. */
export function asContainer(el: StubElement): HTMLElement {
  return el as unknown as HTMLElement;
}
