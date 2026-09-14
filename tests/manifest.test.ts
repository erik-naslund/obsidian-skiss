import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The release workflow matches the tag against manifest.json, and Obsidian reads
// versions.json to decide whether a vault is new enough. Keep the three in step.
function readJson(name: string): Record<string, unknown> {
  const path = new URL(`../${name}`, import.meta.url);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('plugin metadata', () => {
  it('declares the plugin id and version Obsidian installs under', () => {
    const manifest = readJson('manifest.json');

    expect(manifest.id).toBe('skiss');
    expect(manifest.version).toBe('0.1.1');
    expect(manifest.isDesktopOnly).toBe(false);
  });

  it('maps the manifest version to its minimum Obsidian version', () => {
    const manifest = readJson('manifest.json');
    const versions = readJson('versions.json');

    expect(versions[String(manifest.version)]).toBe(manifest.minAppVersion);
  });

  it('keeps package.json on the same version as the manifest', () => {
    expect(readJson('package.json').version).toBe(readJson('manifest.json').version);
  });
});

// Obsidian's "Submission requirements for plugins" and the manifest reference,
// as the community directory's scanner reads them off manifest.json. They are
// checked here so a release never breaks one of them unnoticed.
describe('the community directory requirements', () => {
  const manifest = readJson('manifest.json');

  it('describes the plugin in a sentence the directory accepts', () => {
    const description = String(manifest.description);

    expect(description.length).toBeLessThanOrEqual(250);
    expect(description.endsWith('.')).toBe(true);
    // No emoji and no special characters: plain printable ASCII.
    expect(description).toMatch(/^[\x20-\x7e]+$/);
  });

  it('uses an id the directory allows', () => {
    const id = String(manifest.id);

    expect(id).toMatch(/^[a-z-]+$/);
    expect(id).not.toContain('obsidian');
    expect(id.endsWith('plugin')).toBe(false);
  });

  it('names an author and where to find them', () => {
    expect(manifest.author).toBe('Erik Naslund');
    expect(manifest.authorUrl).toBe('https://github.com/erik-naslund');
  });

  it('claims no funding, because the plugin asks for none', () => {
    expect('fundingUrl' in manifest).toBe(false);
  });

  it('ships the licence the directory requires at the root', () => {
    expect(existsSync(new URL('../LICENSE', import.meta.url))).toBe(true);
  });
});
