import type { App, Command, PluginManifest } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkissPlugin from '../src/main';
import { asFile, asVault, StubFile, StubVault } from './stub-vault';

const { commands, loadMermaid, Notice, PluginStub } = vi.hoisted(() => {
  const commands: Command[] = [];
  return {
    commands,
    Notice: class {},
    loadMermaid: vi.fn(),
    /** Everything `main.ts` inherits from `Plugin`, and no more. */
    PluginStub: class {
      constructor(readonly app: App) {}

      addCommand(command: Command): Command {
        commands.push(command);
        return command;
      }

      registerMarkdownCodeBlockProcessor(_language: string, _handler: unknown): void {}
    },
  };
});

// The npm `obsidian` package is types only, so every value the plugin imports
// from it is a double.
vi.mock('obsidian', () => ({ Plugin: PluginStub, Notice, loadMermaid }));

const MANIFEST = {} as unknown as PluginManifest;
const BLOCK = '```skiss\nCharacter\n  id*\n```\n';

function loadWith(activeFile: StubFile | null): { vault: StubVault; command: Command } {
  const vault = new StubVault();
  const app = {
    vault: asVault(vault),
    workspace: { getActiveFile: () => (activeFile === null ? null : asFile(activeFile)) },
  } as unknown as App;

  new SkissPlugin(app, MANIFEST).onload();

  const command = commands[0];
  if (command === undefined) {
    throw new Error('the plugin registered no command');
  }
  return { vault, command };
}

// `Command.checkCallback` may return nothing; the plugin's always returns a boolean.
function check(command: Command, checking: boolean): unknown {
  return command.checkCallback?.(checking);
}

beforeEach(() => {
  commands.length = 0;
});

describe('the Export to LinkML command', () => {
  it('registers under the id and name the palette shows', () => {
    const { command } = loadWith(new StubFile('Note.md'));

    expect(commands).toHaveLength(1);
    expect(command.id).toBe('skiss-export-linkml');
    expect(command.name).toBe('Skiss: Export to LinkML');
  });

  it.each([
    ['no file is active', null],
    ['the active file is not markdown', new StubFile('diagram.canvas')],
  ])('is unavailable when %s', (_name, activeFile) => {
    const { command } = loadWith(activeFile);

    expect(check(command, true)).toBe(false);
  });

  it('is available for a markdown note, and checking alone exports nothing', () => {
    const { vault, command } = loadWith(new StubFile('Note.md', BLOCK));

    expect(check(command, true)).toBe(true);
    expect(vault.created).toEqual([]);
  });

  it('exports the active note when invoked', async () => {
    const { vault, command } = loadWith(new StubFile('Note.md', BLOCK));

    expect(check(command, false)).toBe(true);

    await vi.waitFor(() => expect(vault.created).toEqual(['Note.linkml.yaml']));
  });
});
