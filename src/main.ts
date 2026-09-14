import { Plugin } from 'obsidian';

export default class SkissPlugin extends Plugin {
  onload(): void {
    console.log('Skiss: plugin loaded');
  }
}
