import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Two rules that live outside the source and are enforced outside the test run:
 * `main.js` is built, never committed (AGENTS.md §2), and a tag that does not
 * match `manifest.json` never becomes a release (`release.yml`). Both hold
 * today; these are what notices a careless edit to either file.
 */
function read(name: string): string {
  return readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
}

/** The lines of a file, comments and blank lines dropped. */
function entriesOf(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

describe('what git is told to ignore', () => {
  it('keeps the built main.js out of the repository', () => {
    // The release workflow builds it and attaches it to the release; a
    // committed one would go stale against the source the moment either moves.
    expect(entriesOf(read('.gitignore'))).toContain('main.js');
  });

  it('keeps node_modules out of it too', () => {
    expect(entriesOf(read('.gitignore'))).toContain('node_modules/');
  });
});

describe('the tag the release workflow accepts', () => {
  const workflow = read('.github/workflows/release.yml');

  it('releases only on a bare x.y.z tag', () => {
    // Obsidian installs from a release tagged with the bare version: no `v`.
    expect(workflow).toContain("- '[0-9]+.[0-9]+.[0-9]+'");
    expect(String(JSON.parse(read('manifest.json')).version)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('fails the job when the tag and manifest.json disagree', () => {
    // The step is shell in a workflow, so what can be checked here is that the
    // comparison is still there: the tag read against the manifest's version,
    // and a non-zero exit when they differ.
    const step = workflow.slice(workflow.indexOf('Check the tag matches manifest.json'));

    expect(step).toContain('manifest_version="$(jq -r .version manifest.json)"');
    expect(step).toContain('if [ "$GITHUB_REF_NAME" != "$manifest_version" ]; then');
    expect(step.slice(0, step.indexOf('fi'))).toContain('exit 1');
  });
});
