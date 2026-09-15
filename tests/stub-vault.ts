import type { MarkdownView, TFile, Vault } from 'obsidian';

/**
 * The vault `export.ts` touches, and no more: read a note, look a path up,
 * create a file or process one that is there. Obsidian's API cannot run
 * headless, so the command is tested against this double and checked by hand in
 * a vault.
 *
 * `export.ts` narrows what a path holds with `instanceof TFile`, so the tests
 * register `StubFile` as the `TFile` of the mocked `obsidian` module and the
 * narrowing is the real one rather than a shape check.
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

/** A folder of the vault: what `getAbstractFileByPath` hands back that is not a file. */
export class StubFolder {
  constructor(readonly path: string) {}
}

export class StubVault {
  readonly files = new Map<string, StubFile>();
  readonly folders = new Map<string, StubFolder>();
  readonly created: string[] = [];
  readonly processed: string[] = [];

  add(path: string, content = ''): StubFile {
    const file = new StubFile(path, content);
    this.files.set(path, file);
    return file;
  }

  addFolder(path: string): StubFolder {
    const folder = new StubFolder(path);
    this.folders.set(path, folder);
    return folder;
  }

  read(file: StubFile): Promise<string> {
    return Promise.resolve(file.content);
  }

  /** As the real one: a path a folder occupies is not a file, so it is `null`. */
  getFileByPath(path: string): StubFile | null {
    return this.files.get(path) ?? null;
  }

  /** Files and folders alike, which is the difference that makes the folder visible. */
  getAbstractFileByPath(path: string): StubFile | StubFolder | null {
    return this.files.get(path) ?? this.folders.get(path) ?? null;
  }

  /**
   * A real vault refuses to create over a path it already holds, folder or
   * file, rather than replacing it; so does this, or the create-versus-process
   * branch would have nothing honest to fail against.
   */
  create(path: string, data: string): Promise<StubFile> {
    if (this.files.has(path) || this.folders.has(path)) {
      return Promise.reject(new Error(`File already exists: ${path}`));
    }
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
