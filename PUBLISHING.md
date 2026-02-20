# Publishing

This document describes the release workflow for `@github-ui/storybook-addon-performance-panel`.

## Overview

Releases are automated through [Changesets](https://github.com/changesets/changesets) and GitHub Actions. The end-to-end flow is:

1. Contributor opens a PR with a changeset file
2. PR is merged to `main`
3. A "Version Packages" PR is automatically created (or updated)
4. A maintainer merges the version PR
5. The package is published to npm with provenance attestation

---

## 1. Changeset Workflow

Every PR that changes the published package must include a changeset file describing the change and the semver bump it warrants.

### Adding a changeset

From the repo root, run:

```sh
npx changeset
```

The interactive prompt will ask you to:

1. Select the package(s) affected (`@github-ui/storybook-addon-performance-panel`)
2. Choose a bump type:
   - `patch` — backwards-compatible bug fixes
   - `minor` — backwards-compatible new features
   - `major` — breaking changes
3. Write a short summary of the change

This creates a Markdown file in `.changeset/` that must be committed and pushed with your PR.

### CI enforcement

The `changeset-check.yml` workflow runs on every PR targeting `main` and fails if no changeset file is present. To bypass the check for PRs that don't affect the published package (e.g., documentation updates, CI changes), apply the **`skip changeset`** label to the PR.

---

## 2. Provenance / OIDC Pipeline

The publish workflow uses GitHub Actions OIDC to generate [npm provenance attestations](https://docs.npmjs.com/generating-provenance-statements) — no manually managed npm tokens are required.

Key details:

- **`id-token: write` permission** — grants the workflow an OIDC token that npm uses to verify the package was built in this repository.
- **`NPM_CONFIG_PROVENANCE: true`** — instructs npm to cryptographically link the published package to the exact source repository and commit. Consumers can verify the attestation with `npm audit signatures`.
- **`production` environment** — the workflow runs in the `production` GitHub environment, which may have environment protection rules (e.g., required reviewers) configured in the repository settings.
- **No `NPM_TOKEN` secret needed** — the OIDC token handles authentication automatically when provenance is enabled and the package registry is `https://registry.npmjs.org/`.

---

## 3. Versioning and Publishing

### What happens when a changeset lands on `main`

The `publish.yml` workflow triggers on every push to `main` and runs `changesets/action`, which does one of two things depending on the state of pending changesets:

**If there are pending changesets:**

The action opens (or updates) a **"Version Packages" PR** that:
- Bumps the version in `package.json` according to the accumulated changesets
- Updates `CHANGELOG.md` with entries from each changeset
- Deletes the consumed changeset files

The PR is automatically labeled **`skip changeset`** and given a synthetic CI success status so it is never blocked by the changeset check or other CI gates.

**If no pending changesets remain (i.e., the version PR was just merged):**

The action publishes the package to npm using `npx changeset publish`, with provenance attestation enabled.

### Maintainer steps

1. Review the open "Version Packages" PR — confirm the version bump and changelog look correct.
2. Merge the PR into `main`.
3. The publish workflow runs automatically and publishes the new version to npm.

### Step-by-step summary

```
Contributor PR (with changeset)
        │
        ▼
   Merge to main
        │
        ▼
publish.yml detects pending changesets
        │
        ▼
"Version Packages" PR created/updated
        │
        ▼
  Maintainer merges version PR
        │
        ▼
publish.yml detects no pending changesets
        │
        ▼
Package published to npm (with provenance)
```
