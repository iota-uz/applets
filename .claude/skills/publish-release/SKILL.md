---
name: publish-release
description: Use when publishing a new version of the applets package (Go module + npm @iota-uz/sdk). Covers version bump, tag, and release workflow.
---

# Publish new version (applets)

Use this when releasing a new version of this package. Go and npm share the same version (X.Y.Z).

## Steps

1. **Bump version**  
   In `package.json`, set `"version": "X.Y.Z"` (e.g. 0.4.6).

2. **Commit and push**  
   Commit all changes (including the version bump) and push to `main`:
   ```bash
   git add -A && git commit -m "Release vX.Y.Z" && git push origin main
   ```

3. **Tag and push**  
   Tag must match `package.json` exactly. Pushing the tag triggers the publish workflow:
   ```bash
   git tag vX.Y.Z -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   ```

4. **Workflow**  
   `.github/workflows/publish-iota-sdk.yml` runs on tag push `v*`. It:
   - Validates tag matches `package.json`
   - Builds and publishes **@iota-uz/sdk** to npm (requires `NPM_TOKEN` secret)
   - Creates a GitHub release

## Notes

- **Go**: Consumers use `go get github.com/iota-uz/applets@vX.Y.Z` or `go install .../cmd/applet@vX.Y.Z`.
- **npm**: Published as `@iota-uz/sdk@X.Y.Z`.
- If the tag doesn’t match `package.json`, the workflow fails.
