# iota-uz/applets — Claude instructions

This repository is the **applet framework and @iota-uz/sdk UI library**. It is **library-only**: no runnable applets (e.g. BiChat) live here. Consumed by iota-sdk and EAI.

## Repo map

- **Go module**: `github.com/iota-uz/applets` (this repo)
  - **Public API**: `pkg/applet/` — Registry, Applet interface, Controller, RPC, stream, context, types. Consumers (iota-sdk, eai/back) import only this.
  - **Internal**: `internal/applet/rpccodegen/` — RPC TypeScript codegen; used only by `cmd/applet`.
  - **CLI**: `cmd/applet/` — RPC codegen and deps checks. **Install** (recommended): `go install github.com/iota-uz/applets/cmd/applet@latest`. Then run `applet rpc gen --name bichat`, `applet rpc check`, `applet deps check` from any repo. Alternatively: `go run github.com/iota-uz/applets/cmd/applet` from this repo or a consumer with applets in go.work.
- **NPM package**: `@iota-uz/sdk` — built and published from this repo (root `package.json`, `ui/`). Contains applet context/host/vite/devtools, BiChat UI components, Tailwind helpers. Consumed by applet frontends (e.g. iota-sdk `modules/bichat/presentation/web`, EAI ali) via npm.

## Dependencies

- **Applets has NO Go dependency on `iota-sdk`**. The dependency is one-way: `iota-sdk → applets`.
  - Applets defines its own local types: `AppletUser`, `AppletPermission`, `AppletRole` (interfaces in `pkg/applet/user.go`), error types `Op`, `Kind`, `Error`, `E()` (in `pkg/applet/errors.go`), and context extractors (`UserExtractorFunc`, `TenantIDExtractorFunc`, etc. in `pkg/applet/options.go`).
  - The host application (iota-sdk) provides adapter implementations via `BuilderOption` functions: `WithUserExtractor()`, `WithTenantIDExtractor()`, `WithPoolExtractor()`, `WithPageLocaleExtractor()`.
- **Local Go development**: Use `go.work` in the consumer (e.g. `eai/back/go.work`) with `use ../../applets` so the local applets repo is used.
- **NPM package local development**: Use **`pnpm link`**. From this repo: run `pnpm build` then `pnpm link --global`. In the consumer (EAI ali web, or iota-sdk `modules/bichat/presentation/web`): run `pnpm link @iota-uz/sdk`.

## Ownership

- Put **applet framework** (Go) and **SDK UI library** (TypeScript/React) code in this repo.
- Applet **implementations** (e.g. BiChat module, EAI Ali) stay in iota-sdk or eai; they consume this library.

## Common commands (just)

```bash
just install    # Install applet CLI from local source (go install ./cmd/applet)
just test       # Run all Go tests
just vet        # Run go vet
just check      # Run vet + test
just build-npm  # Build the @iota-uz/sdk package
just deps-npm   # Install npm dependencies
just watch-npm  # Build npm package in watch mode
```

## Workflows

- **CI** (`.github/workflows/ci.yml`): on push/PR — Go test, `pnpm install --frozen-lockfile`, `pnpm run build`, optionally lint.
- **Publish** (`.github/workflows/publish-iota-sdk.yml`): on tag `iota-sdk-v*` — build and publish `@iota-uz/sdk` to npm. Tag must match `package.json` version.
- **Applet CLI**: Install with `go install github.com/iota-uz/applets/cmd/applet@latest` (ensure `$GOBIN` is on PATH), then run `applet rpc gen --name bichat` etc. from any repo. When developing this repo: `go run ./cmd/applet rpc gen --name bichat`.

## Full docs

Full applet and SDK documentation (architecture, development guides) lives in **iota-sdk** (`docs/`). This repo’s `docs/` is a short summary for applets-only contributors.
