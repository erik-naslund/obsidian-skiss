/**
 * The Live Preview half of the plugin: a CodeMirror 6 extension that colours
 * the lines of a `skiss` fence and puts the compiler's diagnostics in a gutter
 * beside them. Obsidian's own Markdown mode owns the fence lines; this
 * decorates what is between them, and never replaces a line with a widget, so
 * the block stays as editable as any other code block (ADR 0003).
 *
 * `@codemirror/state` and `@codemirror/view` are Obsidian's own copies at
 * runtime: they are externals in `esbuild.config.mjs` and devDependencies here
 * for their types, so nothing of CodeMirror is bundled.
 *
 * What is drawn comes from `annotate.ts`; this file is the mapping onto a
 * document and the scheduling, and holds no knowledge of the language.
 */

import {
  type Extension,
  type Range,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  GutterMarker,
  gutter,
  type PluginValue,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { blockDiagnostics, highlightSpans, type LineDiagnostic } from './annotate';
import type { SkissSettings } from './settings';

/**
 * How long after the last edit the blocks are compiled again. The tokenizer is
 * cheap enough to run on every keystroke; `parse` and `resolve` are a whole
 * block's work and wait for the typing to stop.
 */
const DEBOUNCE_MS = 300;

/** One `Decoration` per class, so a redraw reuses them rather than allocating. */
const marks = new Map<string, Decoration>();

function markFor(className: string): Decoration {
  const existing = marks.get(className);
  if (existing !== undefined) {
    return existing;
  }
  const mark = Decoration.mark({ class: className });
  marks.set(className, mark);
  return mark;
}

/** The spans of the lines on screen, as a decoration set. */
function decorationsOf(view: EditorView): DecorationSet {
  const { doc } = view.state;
  // The viewport as line numbers, once, rather than per line of every fence.
  const visible = view.visibleRanges.map((range) => ({
    first: doc.lineAt(range.from).number,
    last: doc.lineAt(range.to).number,
  }));
  const wanted = (line: number): boolean =>
    visible.some((range) => line >= range.first && line <= range.last);

  const builder = new RangeSetBuilder<Decoration>();
  for (const span of highlightSpans(doc.toString(), wanted)) {
    if (span.line > doc.lines) {
      continue;
    }
    const line = doc.line(span.line);
    builder.add(line.from + span.from, line.from + span.to, markFor(span.className));
  }
  return builder.finish();
}

class SkissHighlighter implements PluginValue {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = decorationsOf(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = decorationsOf(update.view);
    }
  }
}

const highlighting = ViewPlugin.fromClass(SkissHighlighter, {
  decorations: (plugin) => plugin.decorations,
});

/** What the debounced compile hands the gutter. */
const setDiagnostics = StateEffect.define<readonly LineDiagnostic[]>();

/**
 * The diagnostics the gutter draws. They are held rather than derived, because
 * deriving them would mean compiling every block on every keystroke. Between
 * an edit and the compile that follows it they are a moment stale, which is
 * what keeps a marker still instead of flickering while a line is typed.
 */
const diagnosticsField = StateField.define<readonly LineDiagnostic[]>({
  create: () => [],
  update: (diagnostics, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnostics)) {
        return effect.value;
      }
    }
    return diagnostics;
  },
});

class DiagnosticMarker extends GutterMarker {
  constructor(private readonly diagnostic: LineDiagnostic) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return (
      other instanceof DiagnosticMarker &&
      other.diagnostic.severity === this.diagnostic.severity &&
      other.diagnostic.message === this.diagnostic.message
    );
  }

  toDOM(): Node {
    const el = createSpan({
      cls: ['skiss-gutter-marker', `skiss-gutter-${this.diagnostic.severity}`],
    });
    // `aria-label` is what Obsidian's own tooltip reads; `title` is what the
    // browser shows where that tooltip does not reach.
    el.setAttribute('aria-label', this.diagnostic.message);
    el.setAttribute('title', this.diagnostic.message);
    return el;
  }
}

function gutterMarkers(view: EditorView): RangeSet<GutterMarker> {
  const { doc } = view.state;
  const markers: Range<GutterMarker>[] = [];
  for (const diagnostic of view.state.field(diagnosticsField)) {
    // The document may have lost the line since the last compile.
    if (diagnostic.line < 1 || diagnostic.line > doc.lines) {
      continue;
    }
    markers.push(new DiagnosticMarker(diagnostic).range(doc.line(diagnostic.line).from));
  }
  return RangeSet.of(markers, true);
}

/**
 * Compiles the blocks of the note a while after the typing stops and puts the
 * result in the state, which is what the gutter draws from. Dispatching from
 * the timer rather than from `update` keeps the compile off the keystroke, and
 * an effect that changes nothing is not dispatched at all, so the editor is
 * left alone while a note is merely being read.
 */
class DiagnosticsWatcher implements PluginValue {
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly view: EditorView,
    private readonly settings: SkissSettings,
  ) {
    this.schedule();
  }

  update(update: ViewUpdate): void {
    if (update.docChanged) {
      this.schedule();
    }
  }

  destroy(): void {
    this.cancel();
  }

  private schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.compile();
    }, DEBOUNCE_MS);
  }

  private cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private compile(): void {
    const next = blockDiagnostics(this.view.state.doc.toString(), this.settings.showWarnings);
    if (same(next, this.view.state.field(diagnosticsField))) {
      return;
    }
    this.view.dispatch({ effects: setDiagnostics.of(next) });
  }
}

function same(a: readonly LineDiagnostic[], b: readonly LineDiagnostic[]): boolean {
  return (
    a.length === b.length &&
    a.every((diagnostic, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        other.line === diagnostic.line &&
        other.severity === diagnostic.severity &&
        other.message === diagnostic.message
      );
    })
  );
}

/**
 * The extension as Obsidian registers it. It carries the settings it was built
 * with, so `main.ts` builds it again when they change; a note with no `skiss`
 * block in it gets no decorations and an empty gutter, which `styles.css`
 * gives no width.
 */
export function skissEditorExtension(settings: SkissSettings): Extension {
  return [
    highlighting,
    diagnosticsField,
    ViewPlugin.define((view) => new DiagnosticsWatcher(view, settings)),
    gutter({ class: 'skiss-gutter', markers: gutterMarkers }),
  ];
}
