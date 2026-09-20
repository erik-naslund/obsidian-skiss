import { type App, type Plugin, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';

/** Which colours the lines of a block take, or none at all. */
export type HighlightColours = 'calm' | 'vivid' | 'off';

/**
 * What a reader can quiet down when presenting a note. Errors are not one of
 * them: a block that fails to parse must never look fine.
 */
export interface SkissSettings {
  showWarnings: boolean;
  showQuestions: boolean;
  showComments: boolean;
  highlightColours: HighlightColours;
}

export const DEFAULT_SETTINGS: SkissSettings = {
  showWarnings: true,
  showQuestions: true,
  showComments: true,
  highlightColours: 'calm',
};

/**
 * The class `main.ts` puts on `document.body` while the vivid palette is
 * chosen, and `styles.css` scopes that palette under. Calm needs no class: it
 * is what the stylesheet says unscoped, so a fresh vault is calm before the
 * plugin has said anything.
 */
export const VIVID_BODY_CLASS = 'skiss-vivid';

/** The settings a toggle edits: every flag, and nothing that is not one. */
type ToggleKey = {
  [K in keyof SkissSettings]: SkissSettings[K] extends boolean ? K : never;
}[keyof SkissSettings];

/** The setting the dropdown edits, as Obsidian hands the key back. */
const HIGHLIGHT_KEY = 'highlightColours';

interface Option {
  key: ToggleKey;
  name: string;
  description: string;
}

/** One toggle per flag, in the order the tab lists them. */
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

/** The palettes as the dropdown lists them: the stored value, then its label. */
const HIGHLIGHT_OPTIONS: Record<HighlightColours, string> = {
  calm: 'Calm',
  vivid: 'Vivid',
  off: 'Off',
};

/** The plugin as the tab uses it: the settings it edits and the way to persist them. */
export interface SkissSettingsOwner extends Plugin {
  settings: SkissSettings;
  saveSettings(): Promise<void>;
}

/**
 * The settings held in `data.json`. `loadData` hands back whatever that file
 * holds, so a flag is taken only when it is there and is a boolean, and the
 * palette only when it is one of the three the dropdown offers; anything else
 * leaves the default standing, which is what makes a first run, an install
 * that predates a setting and a hand-edited file behave the same.
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
  const colours = fields[HIGHLIGHT_KEY];
  if (isHighlightColours(colours)) {
    settings.highlightColours = colours;
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
    const toggles = OPTIONS.map(
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
    return [
      ...toggles,
      {
        name: 'Highlight colours',
        desc: 'Colours the lines of a skiss block in Live Preview and source mode. For your own colours, override the .cm-skiss-* classes in a CSS snippet (Settings → Appearance).',
        control: {
          type: 'dropdown',
          key: HIGHLIGHT_KEY,
          options: HIGHLIGHT_OPTIONS,
          defaultValue: DEFAULT_SETTINGS.highlightColours,
        },
      },
    ];
  }

  /** What a control opens at. A key the plugin does not know has no value. */
  getControlValue(key: string): unknown {
    if (isToggleKey(key)) {
      return this.plugin.settings[key];
    }
    return key === HIGHLIGHT_KEY ? this.plugin.settings.highlightColours : undefined;
  }

  /**
   * What a flipped toggle or a chosen palette leaves behind. It goes through
   * the plugin's own `saveSettings`, which persists the file *and* re-renders
   * the open notes; the inherited implementation writes the file and leaves
   * every block on screen showing what was just turned off.
   */
  async setControlValue(key: string, value: unknown): Promise<void> {
    if (isToggleKey(key) && typeof value === 'boolean') {
      this.plugin.settings[key] = value;
    } else if (key === HIGHLIGHT_KEY && isHighlightColours(value)) {
      this.plugin.settings.highlightColours = value;
    } else {
      return;
    }
    await this.plugin.saveSettings();
  }
}

/** Obsidian hands a control key back as a string; this is the narrowing. */
function isToggleKey(key: string): key is ToggleKey {
  return OPTIONS.some((option) => option.key === key);
}

/** A stored or chosen palette, taken only when it is one the plugin offers. */
function isHighlightColours(value: unknown): value is HighlightColours {
  return typeof value === 'string' && Object.hasOwn(HIGHLIGHT_OPTIONS, value);
}
