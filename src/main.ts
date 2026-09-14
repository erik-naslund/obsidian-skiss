import { Plugin } from 'obsidian';
import { exportToLinkML } from './export';
import { render } from './render';

const MARKDOWN = 'md';

export default class SkissPlugin extends Plugin {
  onload(): void {
    this.registerMarkdownCodeBlockProcessor('skiss', (source, el) => render(source, el));

    this.addCommand({
      id: 'skiss-export-linkml',
      name: 'Skiss: Export to LinkML',
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
}
