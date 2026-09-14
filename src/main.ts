import { Plugin } from 'obsidian';
import { render } from './render';

export default class SkissPlugin extends Plugin {
  onload(): void {
    this.registerMarkdownCodeBlockProcessor('skiss', (source, el) => render(source, el));
  }
}
