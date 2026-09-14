import { MarkdownView, Plugin } from 'obsidian';
import { exportToLinkML } from './export';
import { render } from './render';
import { DEFAULT_SETTINGS, readSettings, type SkissSettings, SkissSettingTab } from './settings';

const MARKDOWN = 'md';
const MARKDOWN_VIEW = 'markdown';

export default class SkissPlugin extends Plugin {
  settings: SkissSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    this.settings = readSettings(await this.loadData());

    this.registerMarkdownCodeBlockProcessor('skiss', (source, el) =>
      render(source, el, this.settings),
    );

    this.addSettingTab(new SkissSettingTab(this.app, this));

    // Obsidian prefixes the plugin name in the palette, so the name carries
    // none: it reads "Skiss: Export to LinkML" either way.
    this.addCommand({
      id: 'skiss-export-linkml',
      name: 'Export to LinkML',
      checkCallback: (checking: boolean): boolean => {
        const file = this.app.workspace.getActiveFile();
        if (file === null || file.extension !== MARKDOWN) {
          return false;
        }
        if (!checking) {
          void exportToLinkML(this.app.vault, file);
        }
        return true;
      },
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.rerenderOpenNotes();
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
