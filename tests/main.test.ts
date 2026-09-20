import type { App, Command, PluginManifest, PluginSettingTab, WorkspaceLeaf } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SkissPlugin from '../src/main';
import { asContainer, StubElement } from './stub-dom';
import { asVault, StubFile, StubVault } from './stub-vault';

const {
  commands,
  editorExtensions,
  loadMermaid,
  MarkdownRenderChildStub,
  MarkdownViewStub,
  normalizePath,
  Notice,
  PluginStub,
  processors,
  renderChildren,
  settingTabs,
} = vi.hoisted(() => {
  const commands: Command[] = [];
  /** The arrays handed to `registerEditorExtension`, one per load. */
  const editorExtensions: unknown[][] = [];
  const processors: ((source: string, el: unknown, ctx: unknown) => unknown)[] = [];
  const settingTabs: unknown[] = [];
  const renderChildren: unknown[] = [];
  return {
    commands,
    editorExtensions,
    processors,
    renderChildren,
    settingTabs,
    Notice: class {},
    loadMermaid: vi.fn(),
    normalizePath: (path: string): string => path,
    /** What `ctx.addChild` is handed: the container it is told to watch. */
    MarkdownRenderChildStub: class {
      constructor(readonly containerEl: unknown) {}
    },
    /**
     * `main.ts` narrows a leaf's view with `instanceof` and reaches the note
     * through the view; the double is what it narrows to and what it reads.
     */
    MarkdownViewStub: class {
      readonly previewMode = { rerender: vi.fn() };
      file: StubFile | null = null;
      buffer: string | null = null;
      readonly editor = {
        getValue: (): string => this.buffer ?? this.file?.content ?? '',
      };
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

      registerEditorExtension(extension: unknown[]): void {
        editorExtensions.push(extension);
      }

      registerMarkdownCodeBlockProcessor(
        _language: string,
        handler: (source: string, el: unknown, ctx: unknown) => unknown,
      ): void {
        processors.push(handler);
      }
    },
  };
});

// The npm `obsidian` package is types only, so every value the plugin imports
// from it is a double.
vi.mock('obsidian', async () => {
  // `StubFile` stands in as `TFile`, so the `instanceof` narrowing `export.ts`
  // does over what a path holds is the one it does in a vault.
  const { StubFile } = await import('./stub-vault');
  return {
    Plugin: PluginStub,
    Notice,
    loadMermaid,
    normalizePath,
    MarkdownRenderChild: MarkdownRenderChildStub,
    MarkdownView: MarkdownViewStub,
    TFile: StubFile,
    PluginSettingTab: class {},
  };
});

// `navigator.clipboard` is a browser global inside Obsidian; a test run has to
// supply one.
const writeText = vi.fn((_text: string) => Promise.resolve());
vi.stubGlobal('navigator', { clipboard: { writeText } });

/**
 * The body the plugin puts the vivid palette on. `addClass` and `removeClass`
 * are Obsidian's own helpers on an element rather than the DOM's `classList`,
 * so the double carries those two and the set they edit, and nothing else.
 */
const body = {
  classes: new Set<string>(),
  addClass(...classes: string[]): void {
    for (const cls of classes) {
      body.classes.add(cls);
    }
  },
  removeClass(...classes: string[]): void {
    for (const cls of classes) {
      body.classes.delete(cls);
    }
  },
};
vi.stubGlobal('document', { body });

const MANIFEST = {} as unknown as PluginManifest;
const BLOCK = '```skiss\nCharacter\n  id*\n```\n';

// A question and a description on one class, so a hidden section is visible in what renders.
const SOURCE = 'Character   # a person or droid   ? is a droid a character\n  id*\n';

// `Ferson` is not a class anyone declared: a warning on the block's second line.
const WITH_WARNING = 'Character\n  homeworld: Ferson\n';

/** The `Plugin` double's own fields, which the plugin's type knows nothing of. */
interface Recorded {
  stored: unknown;
  saved: unknown[];
}

interface Loaded {
  plugin: SkissPlugin;
  vault: StubVault;
  /** What the plugin wrote with `saveData`, in order. */
  saved: unknown[];
  /** Every markdown view the stubbed workspace has open. */
  views: InstanceType<typeof MarkdownViewStub>[];
  /** A leaf holding something that is not a markdown view. */
  otherView: { previewMode: { rerender: ReturnType<typeof vi.fn> } };
  /** The call that carries a changed setting into Live Preview. */
  updateOptions: ReturnType<typeof vi.fn>;
}

interface LoadOptions {
  /** What `loadData` hands back. */
  stored?: unknown;
  /** What the editor holds when it is ahead of the file on disk. */
  buffer?: string | null;
  /** Whether a markdown view has the focus at all, or a graph or a canvas has. */
  markdownViewActive?: boolean;
}

async function load(
  activeFile: StubFile | null = new StubFile('Note.md', BLOCK),
  { stored = null, buffer = null, markdownViewActive = true }: LoadOptions = {},
): Promise<Loaded> {
  const vault = new StubVault();
  const views = [new MarkdownViewStub(), new MarkdownViewStub()];
  // The first view is the active one: it holds the note the commands export.
  const activeView = views[0];
  if (activeView !== undefined) {
    activeView.file = activeFile;
    activeView.buffer = buffer;
  }
  // The third leaf holds something that is not a markdown view; the plugin skips it.
  const otherView = { previewMode: { rerender: vi.fn() } };
  const leaves = [...views, otherView].map((view) => ({ view }) as unknown as WorkspaceLeaf);
  const updateOptions = vi.fn();
  const app = {
    vault: asVault(vault),
    workspace: {
      getActiveViewOfType: () =>
        activeFile === null || !markdownViewActive ? null : (activeView ?? null),
      getLeavesOfType: (viewType: string) => (viewType === 'markdown' ? leaves : []),
      updateOptions,
    },
  } as unknown as App;

  const plugin = new SkissPlugin(app, MANIFEST);
  const recorded = plugin as unknown as Recorded;
  recorded.stored = stored;
  await plugin.onload();

  return { plugin, vault, saved: recorded.saved, views, otherView, updateOptions };
}

/** The command the plugin registered under `id`. */
function commandWith(id: string): Command {
  const command = commands.find((registered) => registered.id === id);
  if (command === undefined) {
    throw new Error(`the plugin registered no command with the id ${id}`);
  }
  return command;
}

/**
 * What `registerMarkdownCodeBlockProcessor` was handed, run over one block.
 * `lineStart` is what Obsidian's own context reports for the section, and
 * `null` is what it reports for a block it cannot place.
 */
async function renderBlock(source: string, lineStart: number | null = null): Promise<StubElement> {
  const handler = processors[0];
  if (handler === undefined) {
    throw new Error('the plugin registered no code block processor');
  }
  const el = new StubElement();
  const ctx = {
    addChild: (child: unknown): void => {
      renderChildren.push(child);
    },
    getSectionInfo: () =>
      lineStart === null ? null : { text: source, lineStart, lineEnd: lineStart + 2 },
  };
  await handler(source, asContainer(el), ctx);
  return el;
}

/** `Command.checkCallback` may return nothing; the plugin's always returns a boolean. */
function check(command: Command, checking: boolean): unknown {
  return command.checkCallback?.(checking);
}

beforeEach(() => {
  body.classes.clear();
  commands.length = 0;
  editorExtensions.length = 0;
  processors.length = 0;
  renderChildren.length = 0;
  settingTabs.length = 0;
  writeText.mockClear();
});

const EXPORT_IDS = [
  'export-linkml-file',
  'export-linkml-clipboard',
  'export-mermaid-file',
  'export-mermaid-clipboard',
  'export-svg-file',
  'export-svg-clipboard',
  'export-png-file',
  'export-png-clipboard',
];

describe('the export commands', () => {
  it('registers the eight ids and names the palette shows', async () => {
    await load();

    // The palette prefixes the plugin name and id itself; carrying either here
    // would double it. The old `export-linkml` is gone with the rename.
    expect(commands.map((command) => [command.id, command.name])).toEqual([
      ['export-linkml-file', 'Export LinkML to new file'],
      ['export-linkml-clipboard', 'Export LinkML to clipboard'],
      ['export-mermaid-file', 'Export Mermaid to new file'],
      ['export-mermaid-clipboard', 'Export Mermaid to clipboard'],
      ['export-svg-file', 'Export SVG to new file'],
      ['export-svg-clipboard', 'Export SVG to clipboard'],
      ['export-png-file', 'Export PNG to new file'],
      ['export-png-clipboard', 'Export PNG to clipboard'],
    ]);
  });

  it.each([
    ['no file is active', null],
    ['the active file is not markdown', new StubFile('diagram.canvas')],
  ])('is unavailable when %s', async (_name, activeFile) => {
    await load(activeFile);

    for (const id of EXPORT_IDS) {
      expect(check(commandWith(id), true)).toBe(false);
    }
  });

  it('is unavailable when the focus is a graph or a canvas rather than a note', async () => {
    // A note is open behind it, which is exactly what the old gate exported.
    await load(new StubFile('Note.md', BLOCK), { markdownViewActive: false });

    for (const id of EXPORT_IDS) {
      expect(check(commandWith(id), true)).toBe(false);
    }
  });

  it('exports what the editor holds, not what the file on disk holds', async () => {
    const { vault } = await load(new StubFile('Note.md', BLOCK), {
      buffer: '```skiss\nCharacter\n  id*\n  name\n```\n',
    });

    expect(check(commandWith('export-linkml-file'), false)).toBe(true);

    await vi.waitFor(() => expect(vault.created).toEqual(['Note.linkml.yaml']));
    expect(vault.contentOf('Note.linkml.yaml')).toContain('name');
  });

  it('is available for a markdown note, and checking alone exports nothing', async () => {
    const { vault } = await load();

    for (const id of EXPORT_IDS) {
      expect(check(commandWith(id), true)).toBe(true);
    }
    expect(vault.created).toEqual([]);
    expect(writeText).not.toHaveBeenCalled();
  });

  it.each([
    ['export-linkml-file', 'Note.linkml.yaml'],
    ['export-mermaid-file', 'Note.mmd'],
  ])('writes the active note next to itself when %s is invoked', async (id, path) => {
    const { vault } = await load();

    expect(check(commandWith(id), false)).toBe(true);

    await vi.waitFor(() => expect(vault.created).toEqual([path]));
    expect(writeText).not.toHaveBeenCalled();
  });

  it('draws the active note through Mermaid when export-svg-file is invoked', async () => {
    const { vault } = await load();
    // The PNG commands go the same way and are rasterised past this point;
    // `export-image.test.ts` drives both from `exportNote` with a browser.
    loadMermaid.mockResolvedValueOnce({
      render: (_id: string, _text: string) =>
        Promise.resolve({ svg: '<svg viewBox="0 0 10 10"/>' }),
    });

    expect(check(commandWith('export-svg-file'), false)).toBe(true);

    await vi.waitFor(() => expect(vault.created).toEqual(['Note.svg']));
    expect(vault.contentOf('Note.svg')).toBe('<svg viewBox="0 0 10 10"/>');
  });

  it.each([
    ['export-linkml-clipboard', 'name: note'],
    ['export-mermaid-clipboard', 'classDiagram'],
  ])('copies the active note when %s is invoked', async (id, text) => {
    const { vault } = await load();

    expect(check(commandWith(id), false)).toBe(true);

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]?.[0]).toContain(text);
    expect(vault.created).toEqual([]);
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
      highlightColours: 'calm',
    });
  });

  it('loads what the vault holds', async () => {
    const { plugin } = await load(new StubFile('Note.md', BLOCK), {
      stored: { showComments: false },
    });

    expect(plugin.settings.showComments).toBe(false);
    expect(plugin.settings.showQuestions).toBe(true);
  });

  it('renders every block with the settings it loaded', async () => {
    await load(new StubFile('Note.md', BLOCK), { stored: { showComments: false } });

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

    expect(saved).toEqual([
      { showWarnings: true, showQuestions: false, showComments: true, highlightColours: 'calm' },
    ]);
  });

  it('re-renders every open note when the settings change', async () => {
    const { plugin, views, otherView, updateOptions } = await load();

    await plugin.saveSettings();

    for (const view of views) {
      expect(view.previewMode.rerender).toHaveBeenCalledWith(true);
    }
    // A leaf that is not a markdown view is left alone, however it looks.
    expect(otherView.previewMode.rerender).not.toHaveBeenCalled();
    // The preview rerender does not reach Live Preview; this is the call that does.
    expect(updateOptions).toHaveBeenCalled();
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

describe('the highlight palette on the body', () => {
  const VIVID = 'skiss-vivid';

  /** What Obsidian Sync writes into `data.json` behind the plugin's back. */
  function storeExternally(plugin: SkissPlugin, stored: unknown): void {
    (plugin as unknown as Recorded).stored = stored;
  }

  it('leaves the body alone on a vault that has chosen no palette', async () => {
    await load();

    // Calm is the stylesheet unscoped, so a calm vault needs no class at all.
    expect([...body.classes]).toEqual([]);
  });

  it('carries the class from the moment it loads a vault that holds vivid', async () => {
    await load(new StubFile('Note.md', BLOCK), { stored: { highlightColours: 'vivid' } });

    expect(body.classes.has(VIVID)).toBe(true);
  });

  it('adds the class when vivid is chosen and takes it off again when calm is', async () => {
    const { plugin } = await load();

    plugin.settings.highlightColours = 'vivid';
    await plugin.saveSettings();
    expect(body.classes.has(VIVID)).toBe(true);

    plugin.settings.highlightColours = 'calm';
    await plugin.saveSettings();
    expect(body.classes.has(VIVID)).toBe(false);
  });

  it('takes the class off for off, which is no palette rather than a quiet one', async () => {
    const { plugin } = await load(new StubFile('Note.md', BLOCK), {
      stored: { highlightColours: 'vivid' },
    });

    plugin.settings.highlightColours = 'off';
    await plugin.saveSettings();

    expect(body.classes.has(VIVID)).toBe(false);
  });

  it('follows the palette another device chose', async () => {
    const { plugin } = await load();
    storeExternally(plugin, { highlightColours: 'vivid' });

    await plugin.onExternalSettingsChange();

    expect(body.classes.has(VIVID)).toBe(true);
  });

  it('leaves nothing on the body when the plugin unloads', async () => {
    const { plugin } = await load(new StubFile('Note.md', BLOCK), {
      stored: { highlightColours: 'vivid' },
    });

    plugin.onunload();

    expect([...body.classes]).toEqual([]);
  });

  it('builds the extension again for a palette change, so off reaches the open notes', async () => {
    const { plugin, updateOptions } = await load();
    const extension = editorExtensions[0];
    const before = extension?.[0];

    plugin.settings.highlightColours = 'off';
    await plugin.saveSettings();

    expect(extension?.[0]).not.toBe(before);
    expect(updateOptions).toHaveBeenCalled();
  });
});

describe('the Live Preview extension', () => {
  /** The array `registerEditorExtension` was handed, which Obsidian keeps reading. */
  function registered(): unknown[] {
    const extension = editorExtensions[0];
    if (extension === undefined) {
      throw new Error('the plugin registered no editor extension');
    }
    return extension;
  }

  it('is registered once, as an array Obsidian keeps a reference to', async () => {
    await load();

    expect(editorExtensions).toHaveLength(1);
    expect(registered()).toHaveLength(1);
  });

  it('is built again when the settings change, so the gutter reads the new ones', async () => {
    const { plugin, updateOptions } = await load();
    const before = registered()[0];

    plugin.settings.showWarnings = false;
    await plugin.saveSettings();

    // The same array, holding an extension built with the settings as they are
    // now: what `updateOptions` then asks the open editors to read.
    expect(editorExtensions).toHaveLength(1);
    expect(registered()).toHaveLength(1);
    expect(registered()[0]).not.toBe(before);
    expect(updateOptions).toHaveBeenCalled();
  });

  it('is built again when another device changes the settings', async () => {
    const { plugin } = await load();
    const before = registered()[0];
    (plugin as unknown as Recorded).stored = { showWarnings: false };

    await plugin.onExternalSettingsChange();

    expect(registered()[0]).not.toBe(before);
  });
});

describe('a settings change from another device', () => {
  /** What Obsidian Sync writes into `data.json` behind the plugin's back. */
  function storeExternally(plugin: SkissPlugin, stored: unknown): void {
    (plugin as unknown as Recorded).stored = stored;
  }

  it('reloads the settings Obsidian says changed underneath it', async () => {
    const { plugin } = await load();
    storeExternally(plugin, { showQuestions: false });

    await plugin.onExternalSettingsChange();

    expect(plugin.settings).toEqual({
      showWarnings: true,
      showQuestions: false,
      showComments: true,
      highlightColours: 'calm',
    });
  });

  it('reads the new file through readSettings, so a hand-edited one still loads', async () => {
    const { plugin } = await load();
    // Not booleans, and a key nothing knows: the defaults stand, as on a first run.
    storeExternally(plugin, { showWarnings: 'no', unrelated: 1 });

    await plugin.onExternalSettingsChange();

    expect(plugin.settings).toEqual({
      showWarnings: true,
      showQuestions: true,
      showComments: true,
      highlightColours: 'calm',
    });
  });

  it('re-renders every open note, so the change lands without a reload', async () => {
    const { plugin, views, otherView, updateOptions } = await load();
    storeExternally(plugin, { showComments: false });

    await plugin.onExternalSettingsChange();

    for (const view of views) {
      expect(view.previewMode.rerender).toHaveBeenCalledWith(true);
    }
    expect(otherView.previewMode.rerender).not.toHaveBeenCalled();
    expect(updateOptions).toHaveBeenCalled();
  });

  it('writes nothing back: the other device already holds what it changed', async () => {
    const { plugin, saved } = await load();
    storeExternally(plugin, { showComments: false });

    await plugin.onExternalSettingsChange();

    expect(saved).toEqual([]);
  });

  it('renders a block it renders again with the settings that arrived', async () => {
    const { plugin } = await load();
    storeExternally(plugin, { showQuestions: false });

    await plugin.onExternalSettingsChange();
    const el = await renderBlock(SOURCE);

    expect(el.find('skiss-questions')).toBeUndefined();
    expect(el.find('skiss-comments')?.lines()).toEqual([
      'Comments',
      'Character: a person or droid',
    ]);
  });
});

describe('the code block processor', () => {
  it('registers what it renders as a child of the section that holds it', async () => {
    await load();

    const el = await renderBlock(SOURCE);

    expect(renderChildren).toHaveLength(1);
    expect((renderChildren[0] as { containerEl: unknown }).containerEl).toBe(el);
  });

  it('names the note line of a diagnostic when Obsidian says where the block sits', async () => {
    await load();

    // The fence on the note's eleventh line, 0-based as Obsidian counts it, so
    // the body starts on the twelfth and its second line is the note's 13th.
    const el = await renderBlock(WITH_WARNING, 10);

    expect(el.find('skiss-diagnostics')?.lines()).toEqual([
      'Line 13: class `Ferson` is not declared',
    ]);
  });

  it("falls back to the block's own lines when Obsidian will not say", async () => {
    await load();

    const el = await renderBlock(WITH_WARNING);

    expect(el.find('skiss-diagnostics')?.lines()).toEqual([
      'Block line 2: class `Ferson` is not declared',
    ]);
  });
});
