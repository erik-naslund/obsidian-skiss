import { type App, type Plugin, PluginSettingTab, Setting } from 'obsidian';

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

  display(): void {
    this.containerEl.empty();
    for (const option of OPTIONS) {
      new Setting(this.containerEl)
        .setName(option.name)
        .setDesc(option.description)
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings[option.key]).onChange(async (value) => {
            this.plugin.settings[option.key] = value;
            await this.plugin.saveSettings();
          }),
        );
    }
  }
}
