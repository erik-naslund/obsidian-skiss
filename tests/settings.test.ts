import type { App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  readSettings,
  type SkissSettings,
  type SkissSettingsOwner,
  SkissSettingTab,
} from '../src/settings';

const { SettingTabStub } = vi.hoisted(() => {
  /**
   * What `PluginSettingTab` gives a tab. The tab describes itself and never
   * touches the container Obsidian renders it into, so the double holds the two
   * things the constructor is handed and nothing else.
   */
  class SettingTabStub {
    constructor(
      readonly app: App,
      readonly plugin: unknown,
    ) {}
  }

  return { SettingTabStub };
});

vi.mock('obsidian', () => ({ PluginSettingTab: SettingTabStub }));

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
  return { tab, owner };
}

/** One row of the tab as these tests read it: what it says and what it edits. */
interface Toggle {
  name: string;
  desc: string | DocumentFragment | undefined;
  key: string;
  defaultValue: boolean | undefined;
}

/**
 * The toggles the tab describes, in order. A definition that is not a toggle
 * fails here rather than quietly reading as one: the tab has three toggles and
 * nothing else.
 */
function toggles(tab: SkissSettingTab): Toggle[] {
  return tab.getSettingDefinitions().map((definition) => {
    if (!('control' in definition) || definition.control === undefined) {
      throw new Error('the tab describes an item that carries no control');
    }
    const control = definition.control;
    if (control.type !== 'toggle') {
      throw new Error(`the tab describes a ${control.type}, not a toggle`);
    }
    return {
      name: definition.name,
      desc: definition.desc,
      key: control.key,
      defaultValue: control.defaultValue,
    };
  });
}

/** The toggle the tab shows under `name`. */
function toggle(tab: SkissSettingTab, name: string): Toggle {
  const found = toggles(tab).find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`the tab has no row named ${name}`);
  }
  return found;
}

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
  it('describes one toggle per setting, in the order the issue lists them', () => {
    const { tab } = openTab();

    expect(toggles(tab).map((each) => each.name)).toEqual([
      'Show warnings',
      'Show open questions',
      'Show comments',
    ]);
    expect(toggle(tab, 'Show warnings').desc).toContain('Errors are always listed');
  });

  it('keys each toggle to the setting it edits, at the default it ships with', () => {
    const { tab } = openTab();

    expect(toggles(tab).map(({ key, defaultValue }) => [key, defaultValue])).toEqual([
      ['showWarnings', true],
      ['showQuestions', true],
      ['showComments', true],
    ]);
  });

  it('opens each toggle at what the plugin holds', () => {
    const { tab } = openTab({ showWarnings: false, showQuestions: true, showComments: false });

    expect(tab.getControlValue('showWarnings')).toBe(false);
    expect(tab.getControlValue('showQuestions')).toBe(true);
    expect(tab.getControlValue('showComments')).toBe(false);
  });

  it('has no value for a key it does not know', () => {
    const { tab } = openTab();

    expect(tab.getControlValue('showDiagram')).toBeUndefined();
  });

  it('writes a flipped toggle to the plugin and saves it', async () => {
    const { tab, owner } = openTab();

    await tab.setControlValue('showQuestions', false);

    expect(owner.settings).toEqual({
      showWarnings: true,
      showQuestions: false,
      showComments: true,
    });
    // Saving is what re-renders the open notes, so the blocks follow the toggle.
    expect(owner.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('leaves the other settings alone', async () => {
    const { tab, owner } = openTab();

    await tab.setControlValue('showComments', false);

    expect(owner.settings.showWarnings).toBe(true);
    expect(owner.settings.showQuestions).toBe(true);
  });

  it.each<[string, string, unknown]>([
    ['a key it does not know', 'showDiagram', false],
    ['a value that is not a boolean', 'showWarnings', 'no'],
  ])('writes nothing and saves nothing for %s', async (_name, key, value) => {
    const { tab, owner } = openTab();

    await tab.setControlValue(key, value);

    expect(owner.settings).toEqual(DEFAULT_SETTINGS);
    expect(owner.saveSettings).not.toHaveBeenCalled();
  });
});
