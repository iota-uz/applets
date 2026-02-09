# Applets library docs

Short reference for contributors working in this repo. Full applet and SDK documentation lives in [iota-sdk](https://github.com/iota-uz/iota-sdk) (`docs/`).

## Repo layout

- **Go**: `pkg/applet/` (public API), `internal/applet/rpccodegen/` (RPC codegen), `cmd/applet/` (CLI).
- **NPM**: Root `package.json` builds `@iota-uz/sdk` from `ui/`. Scripts in `scripts/`, Tailwind in `tailwind/` and `styles/`.

## Build and test

- **Go**: `go build ./...` and `go test ./pkg/... ./internal/... ./cmd/...`. Local dev uses `replace github.com/iota-uz/iota-sdk => ../iota-sdk` when this repo is next to `iota-sdk`.
- **NPM**: `pnpm install --frozen-lockfile` then `pnpm run build`. Storybook: `pnpm run storybook`.

## Consuming the library

- **Go**: Add `require github.com/iota-uz/applets v0.4.0` (or later). For local iteration, use `go.work` with `use ../../applets`.
- **NPM**: Publish is triggered by tag `iota-sdk-v*`. For **local development use `pnpm link`**: from this repo run `pnpm build` then `pnpm link --global`. In the consumer (e.g. EAI ali web or iota-sdk `modules/bichat/presentation/web`) run `pnpm link @iota-uz/sdk`.

## Applet CLI

Run from the repo that contains the applet (iota-sdk or eai):

```bash
go run github.com/iota-uz/applets/cmd/applet rpc gen --name bichat
go run github.com/iota-uz/applets/cmd/applet rpc check --name bichat
go run github.com/iota-uz/applets/cmd/applet deps check
```

Or build the binary: `go build -o applet ./cmd/applet` then `./applet rpc gen --name bichat`.

## Full docs

- [iota-sdk docs](https://github.com/iota-uz/iota-sdk) — architecture, development guides, applet runtime.
