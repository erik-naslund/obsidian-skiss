import type { TFile, Vault } from 'obsidian';

/**
 * The vault `export.ts` touches, and no more: read a note, look a path up,
 * create or overwrite a file. Obsidian's API cannot run headless, so the
 * command is tested against this double and checked by hand in a vault.
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
  readonly modified: string[] = [];

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

  modify(file: StubFile, data: string): Promise<void> {
    this.modified.push(file.path);
    file.content = data;
    return Promise.resolve();
  }

  contentOf(path: string): string | undefined {
    return this.files.get(path)?.content;
  }
}

/** `exportToLinkML` takes Obsidian's own types; the doubles stand in for them. */
export function asVault(vault: StubVault): Vault {
  return vault as unknown as Vault;
}

export function asFile(file: StubFile): TFile {
  return file as unknown as TFile;
}
