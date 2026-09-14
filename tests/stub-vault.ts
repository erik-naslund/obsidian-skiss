import type { MarkdownView, TFile, Vault } from 'obsidian';

/**
 * The vault `export.ts` touches, and no more: read a note, look a path up,
 * create a file or process one that is there. Obsidian's API cannot run
 * headless, so the command is tested against this double and checked by hand in
 * a vault.
 */
export class StubFile {
  content: string;

  constructor(
    readonly path: string,
    content = '',
  ) {
    this.content = content;
  }

  /** Obsidian derives it from the path; the command gates on it. */
  get extension(): string {
    const name = this.path.slice(this.path.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1) : '';
  }
}

export class StubVault {
  readonly files = new Map<string, StubFile>();
  readonly created: string[] = [];
  readonly processed: string[] = [];

  add(path: string, content = ''): StubFile {
    const file = new StubFile(path, content);
    this.files.set(path, file);
    return file;
  }

  read(file: StubFile): Promise<string> {
    return Promise.resolve(file.content);
  }

  getFileByPath(path: string): StubFile | null {
    return this.files.get(path) ?? null;
  }

  create(path: string, data: string): Promise<StubFile> {
    this.created.push(path);
    return Promise.resolve(this.add(path, data));
  }

  /** `Vault.process` hands the current contents in and writes what it returns. */
  process(file: StubFile, fn: (data: string) => string): Promise<string> {
    this.processed.push(file.path);
    file.content = fn(file.content);
    return Promise.resolve(file.content);
  }

  contentOf(path: string): string | undefined {
    return this.files.get(path)?.content;
  }
}

/**
 * The markdown view an export command is handed: the note it holds and the
 * editor buffer the export reads instead of the file on disk.
 */
export class StubView {
  constructor(
    readonly file: StubFile | null,
    private readonly buffer: string | null = null,
  ) {}

  readonly editor = {
    getValue: (): string => this.buffer ?? this.file?.content ?? '',
  };
}

/** `exportToLinkML` takes Obsidian's own types; the doubles stand in for them. */
export function asVault(vault: StubVault): Vault {
  return vault as unknown as Vault;
}

export function asFile(file: StubFile): TFile {
  return file as unknown as TFile;
}

export function asView(view: StubView): MarkdownView {
  return view as unknown as MarkdownView;
}
