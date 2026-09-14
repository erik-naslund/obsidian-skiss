/**
 * The DOM `render` touches, and no more. The repository depends on nothing but
 * `@eriknaslund/skiss`, so there is no jsdom to render into; keeping this
 * double small keeps `render` honest about how much DOM it uses.
 */
export class StubElement {
  className = '';
  textContent = '';
  innerHTML = '';
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
}

/** `render` takes an Obsidian container; the double stands in for one. */
export function asContainer(el: StubElement): HTMLElement {
  return el as unknown as HTMLElement;
}
