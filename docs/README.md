# Applets library docs

Short reference for contributors working in this repo. Full applet and SDK documentation lives in [iota-sdk](https://github.com/iota-uz/iota-sdk) (`docs/`).

## Repo layout

- **Go**: Root package `github.com/iota-uz/applets` (public API), `internal/*` (implementation), `internal/applet/rpccodegen/` (RPC codegen), `cmd/applet/` (CLI).
- **NPM**: Root `package.json` builds `@iota-uz/sdk` from `ui/`. Scripts in `scripts/`, Tailwind in `tailwind/` and `styles/`.

## Build and test

- **Go**: `go build ./...` and `go test ./...` (root has no tests; tests live in `internal/` and `cmd/`). Local dev uses `go.work` in consumers with `use ../../applets`.
- **NPM**: `pnpm install --frozen-lockfile` then `pnpm run build`. Storybook: `pnpm run storybook`.

## Consuming the library

- **Go**: Add `require github.com/iota-uz/applets v0.4.0` (or later). For local iteration, use `go.work` with `use ../../applets`.
- **NPM**: Publish is triggered by tag `v*` (e.g. v0.4.0). For **local development use `pnpm link`**: from this repo run `pnpm build` then `pnpm link --global`. In the consumer (e.g. EAI ali web or iota-sdk `modules/bichat/presentation/web`) run `pnpm link @iota-uz/sdk`.

## Applet CLI

**Install** (recommended; no clone needed, ensure `$GOBIN` is on PATH):

```bash
go install github.com/iota-uz/applets/cmd/applet@latest
```

Then from the repo that contains the applet (iota-sdk or eai):

```bash
applet rpc gen --name bichat
applet rpc check --name bichat
applet deps check
```

- **Version**: `applet version` prints the CLI version (set at build time via `-ldflags`, or "dev").
- **Shell completion**: `applet completion bash`, `applet completion zsh`, or `applet completion fish` generates a completion script; see `applet completion --help` for install instructions.

To use a specific version: `go install github.com/iota-uz/applets/cmd/applet@v0.4.0`.

**Alternatives:** From a clone, `go run ./cmd/applet rpc gen --name bichat` or `go run github.com/iota-uz/applets/cmd/applet rpc gen --name bichat`; or `go build -o applet ./cmd/applet` then `./applet rpc gen --name bichat`.

## Releasing (Go + npm in sync)

To release X.Y.Z: set `version` in package.json to X.Y.Z, commit, push, then push tag **vX.Y.Z**. The workflow publishes the npm package and creates the GitHub release. Go module version is the same tag (vX.Y.Z). Use the same version for Go and npm. See `.github/workflows/publish-iota-sdk.yml`.

## Full docs

- [iota-sdk docs](https://github.com/iota-uz/iota-sdk) — architecture, development guides, applet runtime.
