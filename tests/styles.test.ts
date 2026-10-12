import { readFileSync } from 'node:fs';
import type { TokenKind } from '@eriknaslund/skiss';
import { describe, expect, it } from 'vitest';

/**
 * The half of the palettes that is not TypeScript. `main.ts` decides which of
 * the two is on the body; what they are is `styles.css`, and what a test can
 * hold it to is the shape the issue asked for: Obsidian's own `--code-*`
 * variables and nothing else, colour and nothing else, the vivid palette under
 * its one class, and nothing shouted with `!important` over a reader's own
 * snippet. Since the tokenizer moved to the package, this file also holds the
 * one contract between the two: a kind the package can return has a rule here.
 */

const STYLES = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

interface Rule {
  selector: string;
  declarations: string[];
}

/** The rules of a stylesheet, their comments dropped. */
function rulesOf(css: string): Rule[] {
  return [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)].map((rule) => ({
    selector: (rule[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    declarations: (rule[2] ?? '')
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration !== ''),
  }));
}

/** The rules that style the lines of a block, whichever palette they belong to. */
const palette = rulesOf(STYLES).filter((rule) => rule.selector.includes('.cm-skiss-'));

/** The classes a selector styles, `body.skiss-vivid .cm-skiss-class` included. */
function classesOf(rule: Rule): string[] {
  return [...rule.selector.matchAll(/\.cm-skiss-[\w-]+/g)].map((match) => match[0]);
}

const vivid = palette.filter((rule) => rule.selector.includes('skiss-vivid'));
const calm = palette.filter((rule) => !rule.selector.includes('skiss-vivid'));

/**
 * Every kind the tokenizer of `@eriknaslund/skiss` can return. A `Record` keyed
 * on the union rather than a list of strings, so a kind added to the package
 * fails the typecheck here, and then the test below, until the stylesheet has a
 * colour for it. The tokenizer itself is the package's to test; what is the
 * plugin's own is that each kind it returns reaches a rule.
 */
const KINDS: Record<TokenKind, true> = {
  class: true,
  field: true,
  system: true,
  primitive: true,
  type: true,
  enum: true,
  operator: true,
  marker: true,
  description: true,
  doubt: true,
  comment: true,
};

describe('the palettes in styles.css', () => {
  it('styles the lines of a block at all', () => {
    // A regex that stopped matching would otherwise make every test below pass
    // over an empty list.
    expect(calm.length).toBeGreaterThan(0);
    expect(vivid.length).toBeGreaterThan(0);
  });

  it('has a rule for every kind the tokenizer returns', () => {
    // One palette or the other: the calm one deliberately leaves the operators
    // the colour of the text around them, and the vivid one colours them.
    const styled = new Set(palette.flatMap(classesOf));
    const missing = Object.keys(KINDS).filter((kind) => !styled.has(`.cm-skiss-${kind}`));
    expect(missing).toEqual([]);
  });

  it("gives a colour and nothing else, from Obsidian's own code variables", () => {
    // Colour only: a line is the same shape whatever it says, and a theme that
    // restyles code blocks restyles these along with them.
    for (const rule of palette) {
      for (const declaration of rule.declarations) {
        expect(declaration).toMatch(/^color: var\(--code-[\w-]+\)$/);
      }
    }
  });

  it('leaves the operators of a calm block the colour of the text around them', () => {
    // The `:`, `[]` and `|` between the words of a field line are what made the
    // old palette read as noise; the calm one has no rule for them.
    expect(calm.flatMap(classesOf)).not.toContain('.cm-skiss-operator');
  });

  it('scopes the vivid palette under the one class the plugin adds to the body', () => {
    for (const rule of vivid) {
      expect(rule.selector).toMatch(/^body\.skiss-vivid \.cm-skiss-[\w-]+$/);
    }
  });

  it('restores the colours of 0.3.1 with the three rules that differ', () => {
    expect(
      vivid.map((rule) => [rule.selector.replace('body.skiss-vivid ', ''), ...rule.declarations]),
    ).toEqual([
      ['.cm-skiss-class', 'color: var(--code-function)'],
      ['.cm-skiss-field', 'color: var(--code-property)'],
      ['.cm-skiss-operator', 'color: var(--code-operator)'],
    ]);
  });

  it("shouts nothing down: a snippet of the reader's own wins over all of it", () => {
    expect(STYLES).not.toContain('!important');
  });
});
