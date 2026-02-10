---
name: publish-release
description: Use when publishing applets releases. npm (`@iota-uz/sdk`) and Go/CLI releases are independent and must be run separately.
---

# Publish releases (separate npm and Go)

Use this when releasing either npm or Go/CLI artifacts. Do not couple them.

## npm release (`@iota-uz/sdk`)

1. **Bump npm version**  
   Use npm without creating a git tag:
   ```bash
   npm version patch --no-git-tag-version
   ```
   Read the new version from `package.json` as `X.Y.Z`.

2. **Commit and push**
   ```bash
   git add package.json && git commit -m "release(npm): bump @iota-uz/sdk to X.Y.Z" && git push origin main
   ```

3. **Run npm publish pipeline**
   Trigger `.github/workflows/publish-npm.yml` (manual `workflow_dispatch`) only:
   ```bash
   gh workflow run publish-npm.yml --ref main
   gh run list --workflow publish-npm.yml --limit 1
   gh run watch "$(gh run list --workflow publish-npm.yml --limit 1 --json databaseId -q '.[0].databaseId')"
   ```

## Go/CLI release (`github.com/iota-uz/applets`)

1. **Choose Go release version**  
   Pick `vX.Y.Z` for Go module/CLI. It is independent from npm version.

2. **Ensure Go release config is ready**
   - Verify `.goreleaser.yaml` targets linux/darwin only (no windows).
   - Verify CLI version resolution is correct for `go install`.

3. **Tag and push Go release**
   ```bash
   git tag vX.Y.Z -m "release(go): vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. **Run Go release pipeline**
   Push the tag to trigger `.github/workflows/publish.yml` (GoReleaser only), then monitor:
   ```bash
   gh run list --workflow publish.yml --limit 1
   gh run watch "$(gh run list --workflow publish.yml --limit 1 --json databaseId -q '.[0].databaseId')"
   ```

## Notes

- npm and Go versions can diverge.
- Do not block one release type on the other.
- Go consumers: `go get github.com/iota-uz/applets@vX.Y.Z` or `go install .../cmd/applet@vX.Y.Z`.
- npm consumers: `npm install @iota-uz/sdk@X.Y.Z`.
