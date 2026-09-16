import { type App, type Plugin, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';

/**
 * What a reader can quiet down when presenting a note. Errors are not one of
 * them: a block that fails to parse must never look fine.
 */
export interface SkissSettings {
  showWarnings: boolean;
  showQuestions: boolean;
  showComments: boolean;
}

export const DEFAULT_SETTINGS: SkissSettings = {
  showWarnings: true,
  showQuestions: true,
  showComments: true,
};

interface Option {
  key: keyof SkissSettings;
  name: string;
  description: string;
}

/** One toggle per setting, in the order the tab lists them. */
const OPTIONS: readonly Option[] = [
  {
    key: 'showWarnings',
    name: 'Show warnings',
    description: "List the compiler's warnings below the diagram. Errors are always listed.",
  },
  {
    key: 'showQuestions',
    name: 'Show open questions',
    description: 'List the ? questions of the block under an "Open questions" heading.',
  },
  {
    key: 'showComments',
    name: 'Show comments',
    description: 'List the # descriptions of the block under a "Comments" heading.',
  },
];

/** The plugin as the tab uses it: the settings it edits and the way to persist them. */
export interface SkissSettingsOwner extends Plugin {
  settings: SkissSettings;
  saveSettings(): Promise<void>;
}

/**
 * The settings held in `data.json`. `loadData` hands back whatever that file
 * holds, so a flag is taken only when it is there and is a boolean; anything
 * else leaves the default standing, which is what makes a first run and a
 * hand-edited file behave the same.
 */
export function readSettings(stored: unknown): SkissSettings {
  const settings = { ...DEFAULT_SETTINGS };
  if (typeof stored !== 'object' || stored === null) {
    return settings;
  }
  const fields: Record<string, unknown> = { ...stored };
  for (const { key } of OPTIONS) {
    const value = fields[key];
    if (typeof value === 'boolean') {
      settings[key] = value;
    }
  }
  return settings;
}

export class SkissSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: SkissSettingsOwner,
  ) {
    super(app, plugin);
  }

  /**
   * The tab, described rather than built. Obsidian 1.13 renders a tab from what
   * this returns and indexes it for the settings search, which a hand-built
   * `display()` is not in; it does not call `display()` at all while this
   * returns definitions. `minAppVersion` is 1.13.1, so there is no older
   * Obsidian left to keep a second, imperative tab in step with.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return OPTIONS.map(
      (option): SettingDefinitionItem => ({
        name: option.name,
        desc: option.description,
        control: {
          type: 'toggle',
          key: option.key,
          defaultValue: DEFAULT_SETTINGS[option.key],
        },
      }),
    );
  }

  /** What a toggle opens at. A key the plugin does not know has no value. */
  getControlValue(key: string): unknown {
    return isSettingKey(key) ? this.plugin.settings[key] : undefined;
  }

  /**
   * What a flipped toggle leaves behind. It goes through the plugin's own
   * `saveSettings`, which persists the file *and* re-renders the open notes;
   * the inherited implementation writes the file and leaves every block on
   * screen showing what was just turned off.
   */
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!isSettingKey(key) || typeof value !== 'boolean') {
      return;
    }
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }
}

/** Obsidian hands a control key back as a string; this is the narrowing. */
function isSettingKey(key: string): key is keyof SkissSettings {
  return OPTIONS.some((option) => option.key === key);
}
