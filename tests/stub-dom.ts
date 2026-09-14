/**
 * The DOM `render` and the settings tab touch, and no more. The repository
 * depends on nothing but `@eriknaslund/skiss`, so there is no jsdom to render
 * into; keeping this double small keeps both honest about how much DOM they use.
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
