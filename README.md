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
applet dev                 # start dev environment (all configured applets)
applet build [name]        # build production bundle
applet list                # list configured applets
```

- **Specific version:** `go install github.com/iota-uz/applets/cmd/applet@v0.4.4`
- **Shell completion:** `applet completion bash`, `applet completion zsh`, or `applet completion fish` — see `applet completion --help` for install instructions.

---

## Configuration

The CLI expects a project root where `.applets/config.toml` exists.

Minimal `.applets/config.toml` (schema v2):

```toml
version = 2

# Project-level dev processes
[[dev.processes]]
name = "air"
command = "air"
critical = true

[[dev.processes]]
name = "templ"
command = "templ"
args = ["generate", "--watch"]

# Applets: only base_path is required. Everything else is convention.
[applets.bichat]
base_path = "/bi-chat"

[applets.bichat.engine]
runtime = "off"

[applets.bichat.engine.backends]
kv = "memory"
db = "memory"
jobs = "memory"
files = "local"
secrets = "env"
```

**Convention defaults:**
- `web` = `modules/<name>/presentation/web`
- `vite_port` = auto-assigned (5173, 5174, …) by sorted name order
- RPC router function = `Router` (hardcoded convention)
- Entry point = `/src/main.tsx` (Vite standard)

**Optional overrides:**
- `web` — custom web directory path (rare)
- `[applets.<name>.rpc] needs_reexport_shim = true` — for SDK applets that re-export RPC contracts

Run `applet doctor` to validate config and environment.
