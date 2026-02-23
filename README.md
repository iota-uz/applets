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
applet rpc watch --name <applet-name>
applet deps check
applet sdk link --sdk-root ../../applets
applet sdk unlink
applet check               # deps + RPC drift for all applets
applet schema export --name <applet>
applet dev                 # start dev environment (all configured applets)
applet dev --rpc-watch     # include RPC codegen watch during dev
applet build [name]        # build production bundle
applet list                # list configured applets
applet secrets set --name <applet> --key OPENAI_API_KEY --value ...
applet secrets list --name <applet>
applet secrets delete --name <applet> --key OPENAI_API_KEY
```

- **Specific version:** `go install github.com/iota-uz/applets/cmd/applet@v0.4.4`
- **Shell completion:** `applet completion bash`, `applet completion zsh`, or `applet completion fish` — see `applet completion --help` for install instructions.
- **Local SDK overrides:** `applet sdk link` writes local-only settings to `.applets/local.env` (gitignored) and avoids committing link overrides into package manifests/lockfiles.

---

## DX Migration Notes (Breaking)

- `applets/` is the canonical source of `@iota-uz/sdk`; `iota-sdk/package.json` is no longer the publish source.
- Local SDK iteration should use `applet sdk link --sdk-root ../../applets` and `applet sdk unlink` instead of committing `pnpm` overrides/workspace links.
- `applet dev` now detects `go.work` dependencies and automatically watches/restarts critical processes when dependency code changes.
- Keep `.applets/local.env` local-only. It is intentionally gitignored and must not be committed.

### Release flow

1. Publish SDK changes from `applets/` (bump `applets/package.json` version and release).
2. Upgrade consumers (`eai/back`, applet web packages, etc.) to the published version.
3. Commit only version upgrades in consumer repos; never commit local-link overrides.

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
hosts = ["chat.example.com"] # optional

[applets.bichat.engine]
runtime = "off"

[applets.bichat.engine.backends]
kv = "memory"
db = "memory"
jobs = "memory"
files = "local"
secrets = "env"

[applets.bichat.frontend]
type = "static" # static|ssr
```

**Convention defaults:**
- `web` = `modules/<name>/presentation/web`
- `vite_port` = auto-assigned (5173, 5174, …) by sorted name order
- RPC router function = `Router` (hardcoded convention)
- Entry point = `/src/main.tsx` (Vite standard)

**Optional overrides:**
- `web` — custom web directory path (rare)
- `[applets.<name>.rpc] needs_reexport_shim = true` — for SDK applets that re-export RPC contracts
- `hosts` — additional host-based mounts (subdomain/custom-domain)
- `[applets.<name>.frontend] type = "static"|"ssr"` — SSR mode requires `engine.runtime = "bun"`
- `[applets.<name>.engine.s3]` — required when `engine.backends.files = "s3"`
- `[applets.<name>.engine.secrets] required = ["OPENAI_API_KEY"]` — startup-required secret keys

Run `applet doctor` to validate config and environment.
