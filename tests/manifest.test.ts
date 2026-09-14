import { readFileSync } from 'node:fs';
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
    expect(manifest.version).toBe('0.0.0');
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
