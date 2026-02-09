# iota-uz/applets — Claude instructions

This repository is the **applet framework and @iota-uz/sdk UI library**. It is **library-only**: no runnable applets (e.g. BiChat) live here. Consumed by iota-sdk and EAI.

## Repo map

- **Go module**: `github.com/iota-uz/applets` (this repo)
  - **Public API**: `pkg/applet/` — Registry, Applet interface, Controller, RPC, stream, context, types. Consumers (iota-sdk, eai/back) import only this.
  - **Internal**: `internal/applet/rpccodegen/` — RPC TypeScript codegen; used only by `cmd/applet`.
  - **CLI**: `cmd/applet/` — `applet gen`, `applet check`, `applet deps` (run from this repo or `go run github.com/iota-uz/applets/cmd/applet`).
- **NPM package**: `@iota-uz/sdk` — built and published from this repo (root `package.json`, `ui/`). Contains applet context/host/vite/devtools, BiChat UI components, Tailwind helpers. Consumed by applet frontends (e.g. iota-sdk `modules/bichat/presentation/web`, EAI ali) via npm.

## Dependencies

- **Applets depends on** `github.com/iota-uz/iota-sdk` for shared packages: `pkg/serrors`, `pkg/composables`, `pkg/constants`, `pkg/i18nutil`, `pkg/types`, and `modules/core/domain/...` as needed. No circular dependency: SDK imports applets only for `pkg/applet`.
- **Local Go development**: Use `go.work` in the consumer (e.g. `eai/back/go.work`) with `use ../../applets` so the local applets repo is used.
- **NPM package local development**: Use **`pnpm link`**. From this repo: run `pnpm build` then `pnpm link --global`. In the consumer (EAI ali web, or iota-sdk `modules/bichat/presentation/web`): run `pnpm link @iota-uz/sdk`.

## Ownership

- Put **applet framework** (Go) and **SDK UI library** (TypeScript/React) code in this repo.
- Applet **implementations** (e.g. BiChat module, EAI Ali) stay in iota-sdk or eai; they consume this library.

## Workflows

- **CI** (`.github/workflows/ci.yml`): on push/PR — Go test, `pnpm install --frozen-lockfile`, `pnpm run build`, optionally lint.
- **Publish** (`.github/workflows/publish-iota-sdk.yml`): on tag `iota-sdk-v*` — build and publish `@iota-uz/sdk` to npm. Tag must match `package.json` version.
- **Applet CLI**: Run from this repo, e.g. `go run ./cmd/applet gen --name bichat` (or from consumer repo with applets in go.work).

## Full docs

Full applet and SDK documentation (architecture, development guides) lives in **iota-sdk** (`docs/`). This repo’s `docs/` is a short summary for applets-only contributors.
