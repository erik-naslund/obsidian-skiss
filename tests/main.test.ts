import type { App, Command, PluginManifest, PluginSettingTab, WorkspaceLeaf } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkissPlugin from '../src/main';
import { asContainer, StubElement } from './stub-dom';
import { asFile, asVault, StubFile, StubVault } from './stub-vault';

const { commands, loadMermaid, MarkdownViewStub, Notice, PluginStub, processors, settingTabs } =
  vi.hoisted(() => {
    const commands: Command[] = [];
    const processors: ((source: string, el: unknown) => unknown)[] = [];
    const settingTabs: unknown[] = [];
    return {
      commands,
      processors,
      settingTabs,
      Notice: class {},
      loadMermaid: vi.fn(),
      /** `main.ts` narrows a leaf's view with `instanceof`; the double is what it narrows to. */
      MarkdownViewStub: class {
        readonly previewMode = { rerender: vi.fn() };
      },
      /** Everything `main.ts` inherits from `Plugin`, and no more. */
      PluginStub: class {
        stored: unknown = null;
        readonly saved: unknown[] = [];

        constructor(readonly app: App) {}

        addCommand(command: Command): Command {
          commands.push(command);
          return command;
        }

        addSettingTab(settingTab: PluginSettingTab): void {
          settingTabs.push(settingTab);
        }

        loadData(): Promise<unknown> {
          return Promise.resolve(this.stored);
        }

        saveData(data: unknown): Promise<void> {
          this.saved.push(data);
          return Promise.resolve();
        }

        registerMarkdownCodeBlockProcessor(
          _language: string,
          handler: (source: string, el: unknown) => unknown,
        ): void {
          processors.push(handler);
        }
      },
    };
  });

// The npm `obsidian` package is types only, so every value the plugin imports
// from it is a double.
vi.mock('obsidian', () => ({
  Plugin: PluginStub,
  Notice,
  loadMermaid,
  MarkdownView: MarkdownViewStub,
  PluginSettingTab: class {},
  Setting: class {},
}));

const MANIFEST = {} as unknown as PluginManifest;
const BLOCK = '```skiss\nCharacter\n  id*\n```\n';

// A question and a description on one class, so a hidden section is visible in what renders.
const SOURCE = 'Character   # a person or droid   ? is a droid a character\n  id*\n';

/** The `Plugin` double's own fields, which the plugin's type knows nothing of. */
interface Recorded {
  stored: unknown;
  saved: unknown[];
}

interface Loaded {
  plugin: SkissPlugin;
  vault: StubVault;
  command: Command;
  /** What the plugin wrote with `saveData`, in order. */
  saved: unknown[];
  /** Every markdown view the stubbed workspace has open. */
  views: InstanceType<typeof MarkdownViewStub>[];
  /** A leaf holding something that is not a markdown view. */
  otherView: { previewMode: { rerender: ReturnType<typeof vi.fn> } };
}

async function load(
  activeFile: StubFile | null = new StubFile('Note.md', BLOCK),
  stored: unknown = null,
): Promise<Loaded> {
  const vault = new StubVault();
  const views = [new MarkdownViewStub(), new MarkdownViewStub()];
  // The third leaf holds something that is not a markdown view; the plugin skips it.
  const otherView = { previewMode: { rerender: vi.fn() } };
  const leaves = [...views, otherView].map((view) => ({ view }) as unknown as WorkspaceLeaf);
  const app = {
    vault: asVault(vault),
    workspace: {
      getActiveFile: () => (activeFile === null ? null : asFile(activeFile)),
      getLeavesOfType: (viewType: string) => (viewType === 'markdown' ? leaves : []),
    },
  } as unknown as App;

  const plugin = new SkissPlugin(app, MANIFEST);
  const recorded = plugin as unknown as Recorded;
  recorded.stored = stored;
  await plugin.onload();

  const command = commands[0];
  if (command === undefined) {
    throw new Error('the plugin registered no command');
  }
  return { plugin, vault, command, saved: recorded.saved, views, otherView };
}

/** What `registerMarkdownCodeBlockProcessor` was handed, run over one block. */
async function renderBlock(source: string): Promise<StubElement> {
  const handler = processors[0];
  if (handler === undefined) {
    throw new Error('the plugin registered no code block processor');
  }
  const el = new StubElement();
  await handler(source, asContainer(el));
  return el;
}

/** `Command.checkCallback` may return nothing; the plugin's always returns a boolean. */
function check(command: Command, checking: boolean): unknown {
  return command.checkCallback?.(checking);
}

beforeEach(() => {
  commands.length = 0;
  processors.length = 0;
  settingTabs.length = 0;
});

describe('the Export to LinkML command', () => {
  it('registers under the id and name the palette shows', async () => {
    const { command } = await load();

    expect(commands).toHaveLength(1);
    expect(command.id).toBe('export-linkml');
    // The palette prefixes the plugin name itself; carrying it here would double it.
    expect(command.name).toBe('Export to LinkML');
  });

  it.each([
    ['no file is active', null],
    ['the active file is not markdown', new StubFile('diagram.canvas')],
  ])('is unavailable when %s', async (_name, activeFile) => {
    const { command } = await load(activeFile);

    expect(check(command, true)).toBe(false);
  });

  it('is available for a markdown note, and checking alone exports nothing', async () => {
    const { vault, command } = await load();

    expect(check(command, true)).toBe(true);
    expect(vault.created).toEqual([]);
  });

  it('exports the active note when invoked', async () => {
    const { vault, command } = await load();

    expect(check(command, false)).toBe(true);

    await vi.waitFor(() => expect(vault.created).toEqual(['Note.linkml.yaml']));
  });
});

describe('the settings', () => {
  it('registers the settings tab', async () => {
    await load();

    expect(settingTabs).toHaveLength(1);
  });

  it('shows everything when the vault holds no settings yet', async () => {
    const { plugin } = await load();

    expect(plugin.settings).toEqual({
      showWarnings: true,
      showQuestions: true,
      showComments: true,
    });
  });

  it('loads what the vault holds', async () => {
    const { plugin } = await load(new StubFile('Note.md', BLOCK), { showComments: false });

    expect(plugin.settings.showComments).toBe(false);
    expect(plugin.settings.showQuestions).toBe(true);
  });

  it('renders every block with the settings it loaded', async () => {
    await load(new StubFile('Note.md', BLOCK), { showComments: false });

    const el = await renderBlock(SOURCE);

    expect(el.find('skiss-comments')).toBeUndefined();
    expect(el.find('skiss-questions')?.lines()).toEqual([
      'Open questions',
      'Character: is a droid a character',
    ]);
  });

  it('writes the settings to the vault when they change', async () => {
    const { plugin, saved } = await load();

    plugin.settings.showQuestions = false;
    await plugin.saveSettings();

    expect(saved).toEqual([{ showWarnings: true, showQuestions: false, showComments: true }]);
  });

  it('re-renders every open note when the settings change', async () => {
    const { plugin, views, otherView } = await load();

    await plugin.saveSettings();

    for (const view of views) {
      expect(view.previewMode.rerender).toHaveBeenCalledWith(true);
    }
    // A leaf that is not a markdown view is left alone, however it looks.
    expect(otherView.previewMode.rerender).not.toHaveBeenCalled();
  });

  it('renders a block it renders again with the settings that changed', async () => {
    const { plugin } = await load();

    plugin.settings.showQuestions = false;
    await plugin.saveSettings();
    const el = await renderBlock(SOURCE);

    expect(el.find('skiss-questions')).toBeUndefined();
    expect(el.find('skiss-comments')?.lines()).toEqual([
      'Comments',
      'Character: a person or droid',
    ]);
  });
});
