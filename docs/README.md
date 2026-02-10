# Applets

Go library and CLI for the applet framework, plus the **@iota-uz/sdk** npm package (applet context, host, UI components, Tailwind helpers). Consumed by [iota-sdk](https://github.com/iota-uz/iota-sdk) and EAI to build and run applets (e.g. BiChat).

Full architecture and development guides live in [iota-sdk docs](https://github.com/iota-uz/iota-sdk).

---

## Go

Add the module to your project:

```bash
go get github.com/iota-uz/applets@latest
```

Import the public API from the root package:

```go
import "github.com/iota-uz/applets"
```

Use `Registry`, `Controller`, RPC types, context helpers, and options as needed. For local development with a clone of this repo, use a [Go workspace](https://go.dev/ref/mod#workspaces) in your project with `use` pointing at the applets directory.

---

## NPM

Install the SDK in your applet frontend (e.g. Vite/React):

```bash
pnpm add @iota-uz/sdk
```

Use applet context, host utilities, BiChat UI components, and Tailwind configuration from the package.

---

## Applet CLI

Install the CLI (ensure `$GOBIN` is on your PATH):

```bash
go install github.com/iota-uz/applets/cmd/applet@latest
```

From a repo that contains an applet (e.g. iota-sdk or EAI):

```bash
applet doctor              # environment and config diagnostics
applet rpc gen --name <applet-name>
applet rpc check --name <applet-name>
applet deps check
applet check               # deps + RPC drift for all applets
applet dev [name]          # start dev environment
applet build [name]        # build production bundle
applet list                # list configured applets
```

- **Specific version:** `go install github.com/iota-uz/applets/cmd/applet@v0.4.4`
- **Shell completion:** `applet completion bash`, `applet completion zsh`, or `applet completion fish` — see `applet completion --help` for install instructions.

---

## Configuration

The CLI expects a project root where `.applets/config.toml` exists (or, for `applet deps check`, a repo with a `go.mod` for `github.com/iota-uz/iota-sdk` or `github.com/iota-uz/eai`).

### Schema (`.applets/config.toml`)

| Section | Field | Required | Default | Description |
|--------|--------|----------|---------|-------------|
| `dev` | `backend_port` | no | 3200 | Backend port for dev manifest. |
| `dev` | `processes` | yes | — | List of `{ name, command, args?, critical?, env? }` for project-level processes (e.g. air, templ). |
| `applets.<name>` | `base_path` | yes | — | URL base path for the applet (e.g. `/bi-chat`). |
| `applets.<name>` | `module` | no | `modules/<name>` | Go module path relative to root. |
| `applets.<name>` | `web` | no | `modules/<name>/presentation/web` | Frontend directory. |
| `applets.<name>` | `entry` | no | `/src/main.tsx` | Vite entry path. |
| `applets.<name>.dev` | `vite_port` | no | unique per applet (5173, 5174, …) | Vite dev server port. |
| `applets.<name>.rpc` | `router_func` | no | `Router` | Go function name for RPC codegen. |
| `applets.<name>.rpc` | `needs_reexport_shim` | no | false | If true, the applet module re-exports the RPC contract from the SDK package. |

Defaults are applied in sorted applet name order; `vite_port` is made unique when not set to avoid conflicts. Run `applet doctor` to validate config and environment.
