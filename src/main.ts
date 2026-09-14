import { MarkdownView, Plugin } from 'obsidian';
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

    this.registerMarkdownCodeBlockProcessor('skiss', (source, el) =>
      render(source, el, this.settings),
    );

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
        const file = this.app.workspace.getActiveFile();
        if (file === null || file.extension !== MARKDOWN) {
          return false;
        }
        if (!checking) {
          void exportNote(this.app.vault, file, format, sink);
        }
        return true;
      },
    });
  }

  /**
   * Obsidian has no call for "run every block processor again", so each open
   * note is asked to render its preview afresh; that is what runs the block
   * processor with the settings just saved.
   */
  private rerenderOpenNotes(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(MARKDOWN_VIEW)) {
      if (leaf.view instanceof MarkdownView) {
        leaf.view.previewMode.rerender(true);
      }
    }
  }
}
