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

## 4. Submitting to the community list

Getting listed is milestone 2 ([ROADMAP.md](ROADMAP.md)) and its own decision
([ADR 0001](adr/0001-community-plugin-distribution.md)). **The product owner
submits**; agents never publish ([AGENTS.md](../AGENTS.md) §6). What follows was
read off Obsidian's developer documentation on 2026-09-14; where the pages have
since moved on, the pages win.

### It is a form, not a pull request

["Submit your plugin"][submit] asks you to submit through the community
directory at [community.obsidian.md](https://community.obsidian.md). It does not
ask for a pull request against `obsidianmd/obsidian-releases`, so there is no PR
title to match and no reviewer bot on a PR to satisfy; the directory's own scan
is the review. That repository still holds `community-plugins.json`, the list
Obsidian reads, but the directory writes the entry into it, and its
`plugin-review.md` now only points back at the [plugin guidelines][guidelines].

### Before you open the form

- `README.md`, `LICENSE` and `manifest.json` sit at the repository root. An
  excerpt of the README is what the listing page shows ([Submit your
  plugin][submit], "Before you begin").
- The `manifest.json` on the default branch is the one submitted: the directory
  reads it from the HEAD of `main`, and the `id` must be unique among published
  plugins and must not contain `obsidian`.
- A GitHub release tagged with the bare manifest version carries `main.js`,
  `manifest.json` and `styles.css`. Sections 1 and 2 above are how that release
  is made; without it, an installed plugin has nothing to download.

### The entry

`community-plugins.json` is what Obsidian reads, and the directory writes this
into it. Its `name`, `author` and `description` are the fields the plugin
browser searches (the `obsidian-releases` README):

```json
{
  "id": "skiss",
  "name": "Skiss",
  "author": "Erik Naslund",
  "description": "Renders Skiss code blocks as diagrams and exports them to LinkML.",
  "repo": "erik-naslund/obsidian-skiss"
}
```

Every field but `repo` is copied from `manifest.json`, so a correction belongs
in the manifest and reaches the list through a new release.

### The form

1. Sign in at [community.obsidian.md](https://community.obsidian.md) with an
   Obsidian account.
2. Under **GitHub**, select **Connect**. That is how the directory verifies the
   repository is yours ("Set up and claim").
3. **Plugins → New**. It asks for the repository URL —
   `https://github.com/erik-naslund/obsidian-skiss` — and for the owner, which
   is yourself rather than an organisation.
4. Confirm the developer policies and submit.

### What the review checks

The directory scans `manifest.json`, the release assets, the source, and whether
the build matches what is committed, rating each finding error, warning,
recommendation or pass ("Manage your plugin or theme"). Errors keep the plugin
from being installable; warnings do not block it. To clear one, push the fix and
publish a new release with an incremented version. **Request review** forces a
recheck instead of waiting for the periodic one, and **Review branch** previews
the scan before a release exists.

What it is looking for, and where this plugin stood at the guideline pass
(issue #23):

| Requirement | Stated in | Skiss |
| --- | --- | --- |
| `README.md`, `LICENSE`, `manifest.json` at the root | [Submit your plugin][submit] | all three |
| `id` lowercase letters and hyphens, not containing `obsidian`, not ending in `plugin` | Manifest reference | `skiss` |
| Description at most 250 characters, ending in a period, no emoji | [Submission requirements][requirements] | 65 characters |
| `minAppVersion` is the lowest version that works | [Submission requirements][requirements] | `1.13.1` |
| `fundingUrl` only when donations are accepted | [Submission requirements][requirements] | omitted |
| `isDesktopOnly` true only with Node.js or Electron APIs | [Submission requirements][requirements] | `false`; the plugin uses neither |
| The sample plugin's code is gone | [Submission requirements][requirements] | none of it was ever here |
| The plugin id is not repeated in a command id | [Submission requirements][requirements] | `export-linkml`, which Obsidian registers as `skiss:export-linkml` |
| A `LICENSE` file, and the licence named | Developer policies | MIT |
| No obfuscation, no ads, no telemetry, no self-updating | Developer policies | none of them |
| Network use, an account, files outside the vault, all disclosed in the README | Developer policies | nothing to disclose: the plugin reads and writes only the vault |
| Not a fork | Developer policies | its own repository |
| The name does not trade on "Obsidian" | Developer policies | "Skiss" |

The source scan reads the [plugin guidelines][guidelines] too — sentence case in
the UI, no top-level heading in the settings tab, no `innerHTML`, resources
released on unload, styling through CSS classes. Issue #23 went through them
once; its pull request lists each one and how it was met.

[submit]: https://docs.obsidian.md/plugins/releasing/submit-plugin
[guidelines]: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
[requirements]: https://docs.obsidian.md/community-directory/submission-requirements-for-plugins
