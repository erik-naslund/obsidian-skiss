import { MarkdownRenderChild, MarkdownView, Plugin } from 'obsidian';
import { exportNote, type Format, type Sink } from './export';
import { render } from './render';
import { DEFAULT_SETTINGS, readSettings, type SkissSettings, SkissSettingTab } from './settings';

const MARKDOWN = 'md';
const MARKDOWN_VIEW = 'markdown';

interface ExportCommand {
  /** No plugin id here: Obsidian prefixes `skiss:` itself. */
  id: string;
  /** No plugin name either; the palette reads "Skiss: Export …" either way. */
  name: string;
  format: Format;
  sink: Sink;
}

const EXPORT_COMMANDS: readonly ExportCommand[] = [
  {
    id: 'export-linkml-file',
    name: 'Export LinkML to new file',
    format: 'linkml',
    sink: 'file',
  },
  {
    id: 'export-linkml-clipboard',
    name: 'Export LinkML to clipboard',
    format: 'linkml',
    sink: 'clipboard',
  },
  {
    id: 'export-mermaid-file',
    name: 'Export Mermaid to new file',
    format: 'mermaid',
    sink: 'file',
  },
  {
    id: 'export-mermaid-clipboard',
    name: 'Export Mermaid to clipboard',
    format: 'mermaid',
    sink: 'clipboard',
  },
];

export default class SkissPlugin extends Plugin {
  settings: SkissSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    this.settings = readSettings(await this.loadData());

    this.registerMarkdownCodeBlockProcessor('skiss', (source, el, ctx) => {
      // The render child ties what is drawn to the section that holds it: when
      // the block is replaced by an edit, or the plugin is unloaded while
      // Mermaid is still drawing, Obsidian unloads it along with the section.
      ctx.addChild(new MarkdownRenderChild(el));
      // Where the block sits in its note, so a diagnostic names a line the
      // reader can navigate to. Obsidian hands back `null` for a section it
      // cannot place, and `render` falls back to the block's own numbering.
      return render(source, el, this.settings, ctx.getSectionInfo(el)?.lineStart);
    });

    this.addSettingTab(new SkissSettingTab(this.app, this));

    for (const command of EXPORT_COMMANDS) {
      this.addExportCommand(command);
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.rerenderOpenNotes();
  }

  private addExportCommand({ id, name, format, sink }: ExportCommand): void {
    this.addCommand({
      id,
      name,
      checkCallback: (checking: boolean): boolean => {
        // The active markdown view, not the active file: the file survives a
        // move to a graph or a canvas, and a command that exports the note the
        // user has left behind is a command that exports the wrong note. The
        // view is also what carries the editor the export reads.
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const file = view === null ? null : view.file;
        if (view === null || file === null || file.extension !== MARKDOWN) {
          return false;
        }
        if (!checking) {
          void exportNote(this.app.vault, file, format, sink, view);
        }
        return true;
      },
    });
  }

  /**
   * Obsidian has no call for "run every block processor again", so each open
   * note is asked to render its preview afresh; that is what runs the block
   * processor with the settings just saved.
   *
   * A note in Live Preview mounts its blocks through the editor rather than
   * through the preview, which `rerender` does not reach. `updateOptions` is
   * the call that makes every open editor reconfigure itself, and it is what
   * carries a changed setting into Live Preview.
   */
  private rerenderOpenNotes(): void {
    this.app.workspace.updateOptions();
    for (const leaf of this.app.workspace.getLeavesOfType(MARKDOWN_VIEW)) {
      if (leaf.view instanceof MarkdownView) {
        leaf.view.previewMode.rerender(true);
      }
    }
  }
}
