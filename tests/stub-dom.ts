/**
 * The DOM `render` touches, and no more. The repository depends on nothing but
 * `@eriknaslund/skiss`, so there is no jsdom to render into; keeping this
 * double small keeps `render` honest about how much DOM it uses.
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

  /** This element and everything below it, depth first. */
  selfAndDescendants(): StubElement[] {
    return [this, ...this.children.flatMap((child) => child.selfAndDescendants())];
  }
}

/** What the double's `DOMParser` hands back: the two members `render` reads. */
export class StubDocument {
  constructor(readonly documentElement: StubElement) {}

  getElementsByTagName(tagName: string): StubElement[] {
    return this.documentElement.selfAndDescendants().filter((el) => el.tagName === tagName);
  }
}

/**
 * `DOMParser` is a browser global; in a test run there is none. This double
 * reads the root tag name, which is all `render` looks at, and reports the
 * `parsererror` document a browser produces for source it cannot parse.
 */
export class StubDOMParser {
  parseFromString(source: string, _type: string): StubDocument {
    const rootTag = /^\s*<([a-zA-Z][\w.:-]*)/.exec(source)?.[1];
    return new StubDocument(new StubElement(rootTag ?? 'parsererror'));
  }
}

/** `render` takes an Obsidian container; the double stands in for one. */
export function asContainer(el: StubElement): HTMLElement {
  return el as unknown as HTMLElement;
}
