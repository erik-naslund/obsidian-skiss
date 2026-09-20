import type { App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  type HighlightColours,
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
interface Control {
  name: string;
  desc: string | DocumentFragment | undefined;
  type: string;
  key: string;
  defaultValue: unknown;
  /** What a dropdown offers, in the order it offers it. A toggle has none. */
  options: Record<string, string> | undefined;
}

/**
 * Every row the tab describes, in order. A definition carrying no control
 * fails here rather than quietly reading as one: every row of this tab edits a
 * setting.
 */
function controls(tab: SkissSettingTab): Control[] {
  return tab.getSettingDefinitions().map((definition) => {
    if (!('control' in definition) || definition.control === undefined) {
      throw new Error('the tab describes an item that carries no control');
    }
    const control = definition.control;
    return {
      name: definition.name,
      desc: definition.desc,
      type: control.type,
      key: control.key,
      defaultValue: control.defaultValue,
      options: control.type === 'dropdown' ? control.options : undefined,
    };
  });
}

/** The toggles among them, in the order the tab lists them. */
function toggles(tab: SkissSettingTab): Control[] {
  return controls(tab).filter((control) => control.type === 'toggle');
}

/** The row the tab shows under `name`, whatever kind of control it carries. */
function toggle(tab: SkissSettingTab, name: string): Control {
  const found = controls(tab).find((candidate) => candidate.name === name);
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
      highlightColours: 'calm',
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
      highlightColours: 'calm',
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

describe('the palette a vault holds', () => {
  it('is calm for an install whose data.json predates the setting', () => {
    // The file of a 0.3.1 vault: three flags and no palette at all.
    expect(readSettings({ showWarnings: false, showQuestions: true, showComments: true })).toEqual({
      showWarnings: false,
      showQuestions: true,
      showComments: true,
      highlightColours: 'calm',
    });
  });

  it.each<[HighlightColours]>([['calm'], ['vivid'], ['off']])(
    'keeps %s, which is a palette the dropdown offers',
    (colours) => {
      expect(readSettings({ highlightColours: colours }).highlightColours).toBe(colours);
    },
  );

  it.each<[string, unknown]>([
    ['a string that names no palette', 'muted'],
    ['a palette that was renamed away', 'vivid-dark'],
    ['a value that is not a string', true],
    ['a null', null],
    // `hasOwn` rather than a lookup: an inherited name is not an option.
    ['a name Object.prototype carries', 'constructor'],
  ])('leaves calm standing for %s', (_name, stored) => {
    expect(readSettings({ highlightColours: stored }).highlightColours).toBe('calm');
  });

  it('takes the palette and the flags together', () => {
    expect(readSettings({ showComments: false, highlightColours: 'off' })).toEqual({
      showWarnings: true,
      showQuestions: true,
      showComments: false,
      highlightColours: 'off',
    });
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
    const { tab } = openTab({
      showWarnings: false,
      showQuestions: true,
      showComments: false,
      highlightColours: 'calm',
    });

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
      highlightColours: 'calm',
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

describe('the palette dropdown', () => {
  /** The row the palette is edited from: the fourth, after the three toggles. */
  function palette(tab: SkissSettingTab): Control {
    return toggle(tab, 'Highlight colours');
  }

  it('is a dropdown, and comes after the three toggles', () => {
    const { tab } = openTab();

    expect(controls(tab).map((each) => [each.name, each.type])).toEqual([
      ['Show warnings', 'toggle'],
      ['Show open questions', 'toggle'],
      ['Show comments', 'toggle'],
      ['Highlight colours', 'dropdown'],
    ]);
  });

  it('offers the three palettes, calm first and by default', () => {
    const { tab } = openTab();

    expect(palette(tab).options).toEqual({ calm: 'Calm', vivid: 'Vivid', off: 'Off' });
    // The order the dropdown lists them in, which the object's own order is.
    expect(Object.keys(palette(tab).options ?? {})).toEqual(['calm', 'vivid', 'off']);
    expect(palette(tab).key).toBe('highlightColours');
    expect(palette(tab).defaultValue).toBe('calm');
  });

  it('says where a reader goes for colours of their own', () => {
    const { tab } = openTab();

    expect(palette(tab).desc).toContain('.cm-skiss-*');
    expect(palette(tab).desc).toContain('CSS snippet');
  });

  it('opens at the palette the plugin holds', () => {
    const { tab } = openTab({ ...DEFAULT_SETTINGS, highlightColours: 'off' });

    expect(tab.getControlValue('highlightColours')).toBe('off');
  });

  it.each<[HighlightColours]>([['vivid'], ['off'], ['calm']])(
    'writes %s to the plugin and saves it',
    async (colours) => {
      const { tab, owner } = openTab();

      await tab.setControlValue('highlightColours', colours);

      expect(owner.settings.highlightColours).toBe(colours);
      // Saving is what puts the body class and the extension in step with it.
      expect(owner.saveSettings).toHaveBeenCalledTimes(1);
    },
  );

  it('leaves the flags alone', async () => {
    const { tab, owner } = openTab();

    await tab.setControlValue('highlightColours', 'vivid');

    expect(owner.settings).toEqual({ ...DEFAULT_SETTINGS, highlightColours: 'vivid' });
  });

  it.each<[string, unknown]>([
    ['a palette it does not offer', 'muted'],
    ['a value that is not a string', true],
    ['nothing at all', undefined],
  ])('writes nothing and saves nothing for %s', async (_name, value) => {
    const { tab, owner } = openTab();

    await tab.setControlValue('highlightColours', value);

    expect(owner.settings).toEqual(DEFAULT_SETTINGS);
    expect(owner.saveSettings).not.toHaveBeenCalled();
  });
});
