// @vitest-environment jsdom

import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { skissEditorExtension } from '../src/editor';
import { DEFAULT_SETTINGS, type HighlightColours } from '../src/settings';

/**
 * The extension in an editor, rather than the extension as a list. What the
 * palette decides is whether a block carries any `cm-skiss-*` span at all, and
 * that is a thing to read off a document: a real CodeMirror view over a note
 * with a `skiss` block in it, built the way `main.ts` builds it. The colours
 * themselves are `styles.css` and are not in the DOM at all, which is why
 * *Calm* and *Vivid* look the same here and differ only in a stylesheet.
 */

// `settings.ts` imports Obsidian's `PluginSettingTab`; the extension itself
// reaches for nothing of Obsidian but `createSpan`.
vi.mock('obsidian', () => ({ PluginSettingTab: class {} }));

// Obsidian's own helper, which the gutter marker builds its bar with. It makes
// the element, applies `cls` and hands it back, as Obsidian's does.
vi.stubGlobal('createSpan', (info?: { cls?: string[] }) => {
  const el = document.createElement('span');
  for (const cls of info?.cls ?? []) {
    el.classList.add(cls);
  }
  return el;
});

/** How long after the last edit `editor.ts` compiles the blocks. */
const DEBOUNCE_MS = 300;

// `Ferson` is no declared class: a warning on the block's second line, which is
// what the gutter has to draw whatever the palette says.
const NOTE = '```skiss\nCharacter @Catalog\n  homeworld: Ferson\n```\n';

const views: EditorView[] = [];

/** A note open in an editor carrying the extension, at `highlightColours`. */
function open(highlightColours: HighlightColours): EditorView {
  const view = new EditorView({
    state: EditorState.create({
      doc: NOTE,
      extensions: [skissEditorExtension({ ...DEFAULT_SETTINGS, highlightColours })],
    }),
    parent: document.body,
  });
  views.push(view);
  return view;
}

/** The classes the block's spans carry, in the order they are drawn. */
function colouring(view: EditorView): string[] {
  return [...view.dom.querySelectorAll('[class*="cm-skiss-"]')].map((el) => el.className);
}

/** What the gutter draws beside the lines, as the marker's tooltip reads. */
function markers(view: EditorView): (string | null)[] {
  return [...view.dom.querySelectorAll('.skiss-gutter-marker')].map((el) =>
    el.getAttribute('aria-label'),
  );
}

afterEach(() => {
  for (const view of views) {
    view.destroy();
  }
  views.length = 0;
});

describe('the palette in an editor', () => {
  it('colours the lines of a block under the calm palette', () => {
    expect(colouring(open('calm'))).toContain('cm-skiss-class');
  });

  it('colours them under vivid the same way: the palette is a stylesheet, not a second extension', () => {
    // Same spans, same classes: what differs between the two is which colour
    // `styles.css` gives those classes, and the document never says.
    expect(colouring(open('vivid'))).toEqual(colouring(open('calm')));
  });

  it('leaves the block uncoloured under off', () => {
    // Not a span styled back to the text colour: no span at all.
    expect(colouring(open('off'))).toEqual([]);
  });

  it.each<[HighlightColours]>([['calm'], ['vivid'], ['off']])(
    'marks the diagnostics in the gutter under %s',
    (highlightColours) => {
      vi.useFakeTimers();
      try {
        const view = open(highlightColours);
        vi.advanceTimersByTime(DEBOUNCE_MS + 1);

        expect(markers(view)).toEqual(['class `Ferson` is not declared']);
      } finally {
        vi.useRealTimers();
      }
    },
  );
});
