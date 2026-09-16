import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The rules that live outside the source and are enforced outside the test run:
 * `main.js` is built, never committed (AGENTS.md §2), a tag that does not match
 * `manifest.json` never becomes a release, and what a release carries is
 * attested (`release.yml`). All of them hold today; these are what notices a
 * careless edit to either file.
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

describe('the provenance of what a release carries', () => {
  const workflow = read('.github/workflows/release.yml');
  const attestation = workflow.slice(
    workflow.indexOf('Attest the release assets'),
    workflow.indexOf('- name: Create the release'),
  );

  it('attests with an action pinned by commit SHA, as the rest of the job is', () => {
    expect(attestation).toMatch(
      /uses: actions\/attest-build-provenance@[0-9a-f]{40} # v\d+\.\d+\.\d+/,
    );
  });

  it('attests the three files the release carries, and no others', () => {
    // The same three `gh release create` attaches below; an asset left out of
    // the subjects is an asset a reader cannot check the provenance of.
    expect(entriesOf(attestation.slice(attestation.indexOf('subject-path:')))).toEqual([
      'subject-path: |',
      'main.js',
      'manifest.json',
      'styles.css',
    ]);
  });

  it('attests before the release is created', () => {
    // An attestation is of what was built here; attaching the assets first
    // would leave a window where the release carries unattested files.
    expect(workflow.indexOf('Attest the release assets')).toBeLessThan(
      workflow.indexOf('Create the release'),
    );
  });

  it('gives the job what minting and persisting an attestation needs', () => {
    const permissions = entriesOf(workflow.slice(workflow.indexOf('permissions:')));

    expect(permissions).toContain('id-token: write');
    expect(permissions).toContain('attestations: write');
  });
});
