import type { App } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  readSettings,
  type SkissSettings,
  type SkissSettingsOwner,
  SkissSettingTab,
} from '../src/settings';
import { StubElement } from './stub-dom';

const { rows, SettingStub, SettingTabStub } = vi.hoisted(() => {
  /** The toggle a row carries: the value it opened with and what a click runs. */
  class ToggleStub {
    value = false;
    change: ((value: boolean) => unknown) | undefined;

    setValue(value: boolean): this {
      this.value = value;
      return this;
    }

    onChange(change: (value: boolean) => unknown): this {
      this.change = change;
      return this;
    }
  }

  const rows: SettingStub[] = [];

  /** One row of the tab: what it is called and the toggle it holds. */
  class SettingStub {
    name = '';
    description = '';
    toggle: ToggleStub | undefined;

    constructor(readonly containerEl: unknown) {
      rows.push(this);
    }

    setName(name: string): this {
      this.name = name;
      return this;
    }

    setDesc(description: string): this {
      this.description = description;
      return this;
    }

    addToggle(add: (toggle: ToggleStub) => unknown): this {
      const toggle = new ToggleStub();
      this.toggle = toggle;
      add(toggle);
      return this;
    }
  }

  /** What `PluginSettingTab` gives a tab: Obsidian builds the container for it. */
  class SettingTabStub {
    readonly containerEl = new StubElement();

    constructor(
      readonly app: App,
      readonly plugin: unknown,
    ) {}
  }

  return { rows, SettingStub, SettingTabStub };
});

vi.mock('obsidian', () => ({ PluginSettingTab: SettingTabStub, Setting: SettingStub }));

const APP = {} as unknown as App;

interface Owner {
  settings: SkissSettings;
  saveSettings: ReturnType<typeof vi.fn>;
}

function openTab(settings: SkissSettings = { ...DEFAULT_SETTINGS }): {
  tab: SkissSettingTab;
  owner: Owner;
} {
  const owner: Owner = { settings, saveSettings: vi.fn(() => Promise.resolve()) };
  const tab = new SkissSettingTab(APP, owner as unknown as SkissSettingsOwner);
  tab.display();
  return { tab, owner };
}

/** The row a toggle sits in, by the name the tab shows. */
function row(name: string): InstanceType<typeof SettingStub> {
  const found = rows.find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`the tab has no row named ${name}`);
  }
  return found;
}

beforeEach(() => {
  rows.length = 0;
});

describe('the settings a vault holds', () => {
  it('shows everything by default', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      showWarnings: true,
      showQuestions: true,
      showComments: true,
    });
  });

  it.each([
    ['nothing is stored yet', null],
    ['the file holds no object', 'not settings'],
    ['the file holds an empty object', {}],
  ])('falls back to the defaults when %s', (_name, stored) => {
    expect(readSettings(stored)).toEqual(DEFAULT_SETTINGS);
  });

  it('takes the flags the file holds and leaves the rest at their default', () => {
    expect(readSettings({ showWarnings: false })).toEqual({
      showWarnings: false,
      showQuestions: true,
      showComments: true,
    });
  });

  it('ignores a flag that is not a boolean and a key it does not know', () => {
    expect(readSettings({ showComments: 'no', showDiagram: false })).toEqual(DEFAULT_SETTINGS);
  });

  it('hands back a settings object of its own, never the defaults', () => {
    const settings = readSettings({ showWarnings: false });
    settings.showQuestions = false;

    expect(DEFAULT_SETTINGS.showQuestions).toBe(true);
  });
});

describe('the settings tab', () => {
  it('shows one toggle per setting, in the order the issue lists them', () => {
    openTab();

    expect(rows.map((each) => each.name)).toEqual([
      'Show warnings',
      'Show open questions',
      'Show comments',
    ]);
    expect(row('Show warnings').description).toContain('Errors are always listed');
  });

  it('opens each toggle at what the plugin holds', () => {
    openTab({ showWarnings: false, showQuestions: true, showComments: false });

    expect(row('Show warnings').toggle?.value).toBe(false);
    expect(row('Show open questions').toggle?.value).toBe(true);
    expect(row('Show comments').toggle?.value).toBe(false);
  });

  it('writes a flipped toggle to the plugin and saves it', async () => {
    const { owner } = openTab();

    await row('Show open questions').toggle?.change?.(false);

    expect(owner.settings).toEqual({
      showWarnings: true,
      showQuestions: false,
      showComments: true,
    });
    expect(owner.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('leaves the other settings alone', async () => {
    const { owner } = openTab();

    await row('Show comments').toggle?.change?.(false);

    expect(owner.settings.showWarnings).toBe(true);
    expect(owner.settings.showQuestions).toBe(true);
  });

  it('fills its container afresh each time it is opened', () => {
    const { tab } = openTab();
    const container = tab.containerEl as unknown as StubElement;
    container.append(new StubElement());

    tab.display();

    expect(container.children).toEqual([]);
    expect(rows).toHaveLength(6);
  });
});
