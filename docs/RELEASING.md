# Releasing

Obsidian installs a plugin from a GitHub release tagged with the **bare
version** in `manifest.json` — `0.1.0`, not `v0.1.0` — carrying `main.js`,
`manifest.json` and `styles.css`. This page is how that release gets made.

Two halves, and they belong to different people. An agent prepares the release
in a PR. **Only the product owner tags and pushes** ([AGENTS.md](../AGENTS.md)
§6); agents never publish.

## 1. Prepare the release (a PR)

One PR, on a branch named for the version (`release/0.1.0`).

1. **Bump the version in three files, together.** They must agree, and a test
   checks that they do.
   - `manifest.json` — `version`. This is the one the release workflow matches
     the tag against.
   - `versions.json` — add a `"<version>": "<minAppVersion>"` entry, keeping the
     existing ones. Obsidian reads this to decide whether a vault is new enough.
   - `package.json` — `version`.
   - `tests/manifest.test.ts` asserts the manifest version and that the three
     files are in step, so it changes with them.
2. **Write the changelog.** A new section in `CHANGELOG.md`
   ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)), dated, listing
   what the release contains in words a plugin user reads — what they can now
   do, not which modules moved.
3. **Check the `@eriknaslund/skiss` pin.** A release always pins a *published*
   version of the package, never a local link to an unpublished build
   ([ADR 0004](adr/0004-depend-on-published-skiss.md)).
4. **`pnpm verify` green**, then open the PR against `main` and let CI pass.
   `main` is reached only through a PR.

## 2. Tag it (the product owner)

Once the release PR is merged and CI on `main` is green:

```sh
git fetch origin main
git tag 0.1.0 main        # the bare version, no leading v
git push origin 0.1.0
```

Pushing the tag is the whole release. The `Release` workflow
(`.github/workflows/release.yml`) fires on any tag shaped `1.2.3` and:

1. **Checks the tag against `manifest.json`.** A tag that does not match the
   manifest version fails here and never becomes a release. This is the
   safeguard that makes a mistyped tag harmless.
2. **Runs `pnpm install --frozen-lockfile` and `pnpm verify`** — lint,
   typecheck, tests, build. A release is never cut from a red gate, and the
   build is what produces `main.js`.
3. **Creates the GitHub release** with generated notes and the three assets
   attached: `main.js`, `manifest.json`, `styles.css`.

Nothing is ever uploaded by hand. `main.js` is never committed; it exists only
as a release asset.

If the workflow fails on the tag check, delete the tag
(`git push origin :0.1.0`), fix the manifest through a PR, and tag again.

## 3. Install it with BRAT

The plugin is not in the community plugin list yet, so it installs through
[BRAT](https://github.com/TfTHacker/obsidian42-brat), which installs plugins
straight from a GitHub release.

1. **Settings → Community plugins**, turn off Restricted mode if it is on,
   **Browse**, find **BRAT** (*Obsidian42 - BRAT*), install it and enable it.
2. **Settings → BRAT → "Add beta plugin"**.
3. Enter the repository: **`erik-naslund/obsidian-skiss`**. BRAT takes the
   latest release, downloads the three assets into the vault and installs the
   plugin.
4. **Settings → Community plugins**, enable **Skiss**.
5. Check it: put a `skiss` block in a note and look at it in Reading view.

BRAT keeps the plugin up to date with later releases from the same repository.

## 4. Afterwards

Getting into the community plugin list is a separate milestone
([ROADMAP.md](ROADMAP.md), milestone 2) and a separate decision
([ADR 0001](adr/0001-community-plugin-distribution.md)).
