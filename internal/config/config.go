// Package config handles .applets/config.toml loading, defaults, and validation.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/BurntSushi/toml"
)

// Canonical default values for applet config.
const (
	DefaultRouterFunc   = "Router"
	DefaultViteBasePort = 5173
)

// ProjectConfig is the top-level config from .applets/config.toml.
type ProjectConfig struct {
	Dev     DevConfig                `toml:"dev"`
	Applets map[string]*AppletConfig `toml:"applets"`
}

// DevConfig holds project-level dev process definitions.
type DevConfig struct {
	Processes   []ProcessConfig `toml:"processes"`
	BackendPort int             `toml:"backend_port"`
}

// ProcessConfig describes a dev process to run.
type ProcessConfig struct {
	Name     string            `toml:"name"`
	Command  string            `toml:"command"`
	Args     []string          `toml:"args"`
	Critical bool              `toml:"critical"`
	Env      map[string]string `toml:"env"`
}

// AppletConfig holds per-applet configuration.
type AppletConfig struct {
	BasePath string          `toml:"base_path"`
	Module   string          `toml:"module"`
	Web      string          `toml:"web"`
	Entry    string          `toml:"entry"`
	Dev      *AppletDevConfig `toml:"dev"`
	RPC      *AppletRPCConfig `toml:"rpc"`
}

// AppletDevConfig holds applet-specific dev settings.
type AppletDevConfig struct {
	VitePort int `toml:"vite_port"`
}

// AppletRPCConfig holds applet-specific RPC codegen settings.
type AppletRPCConfig struct {
	RouterFunc        string `toml:"router_func"`
	NeedsReexportShim bool   `toml:"needs_reexport_shim"`
}

const configDir = ".applets"
const configFile = "config.toml"

// ErrConfigNotFound is returned when neither .applets/config.toml nor a known go.mod project root was found.
var ErrConfigNotFound = errors.New("could not find .applets/config.toml or project root (go.mod for github.com/iota-uz/iota-sdk or github.com/iota-uz/eai)")

// FindRoot returns the project root: first tries .applets/config.toml walking up from cwd,
// then falls back to a directory containing go.mod for a known applet host (iota-sdk or eai).
func FindRoot() (string, error) {
	root, err := findRootAppletsConfig()
	if err == nil {
		return root, nil
	}
	if !errors.Is(err, ErrConfigNotFound) {
		return "", err
	}
	return findRootGoMod()
}

func findRootAppletsConfig() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for {
		candidate := filepath.Join(dir, configDir, configFile)
		_, err := os.Stat(candidate)
		if err == nil {
			return dir, nil
		}
		if err != nil && !os.IsNotExist(err) {
			return "", fmt.Errorf("stat %s: %w", candidate, err)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("%w (walked up from %s)", ErrConfigNotFound, cwd)
		}
		dir = parent
	}
}

func findRootGoMod() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := cwd
	for {
		modPath := filepath.Join(dir, "go.mod")
		data, readErr := os.ReadFile(modPath)
		if readErr == nil {
			s := string(data)
			if strings.Contains(s, "module github.com/iota-uz/iota-sdk") || strings.Contains(s, "module github.com/iota-uz/eai") {
				return dir, nil
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", ErrConfigNotFound
		}
		dir = parent
	}
}

// LoadFromCWD discovers the project root (FindRoot), loads .applets/config.toml, applies defaults, and validates.
// Use this as the single entrypoint for commands that need both root and config.
func LoadFromCWD() (root string, cfg *ProjectConfig, err error) {
	root, err = FindRoot()
	if err != nil {
		return "", nil, err
	}
	cfg, err = Load(root)
	if err != nil {
		return "", nil, err
	}
	return root, cfg, nil
}

// ResolveApplet returns the applet config for name or a consistent error listing available applets.
func ResolveApplet(cfg *ProjectConfig, name string) (*AppletConfig, error) {
	if a, ok := cfg.Applets[name]; ok {
		return a, nil
	}
	return nil, fmt.Errorf("unknown applet %q (available: %s)", name, strings.Join(cfg.AppletNames(), ", "))
}

// Load parses .applets/config.toml from the given root, applies defaults, and validates.
func Load(root string) (*ProjectConfig, error) {
	path := filepath.Join(root, configDir, configFile)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg ProjectConfig
	if err := toml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}

	ApplyDefaults(&cfg)

	if err := Validate(&cfg); err != nil {
		return nil, fmt.Errorf("config validation: %w", err)
	}

	return &cfg, nil
}

// ApplyDefaults fills convention-derived fields for each applet.
// Applets with vite_port unset get a unique default (DefaultViteBasePort + index) to avoid port conflicts.
func ApplyDefaults(cfg *ProjectConfig) {
	if cfg.Dev.BackendPort == 0 {
		cfg.Dev.BackendPort = 3200
	}
	names := make([]string, 0, len(cfg.Applets))
	for name := range cfg.Applets {
		names = append(names, name)
	}
	sort.Strings(names)
	for i, name := range names {
		applet := cfg.Applets[name]
		if applet.Module == "" {
			applet.Module = filepath.Join("modules", name)
		}
		if applet.Web == "" {
			applet.Web = filepath.Join("modules", name, "presentation", "web")
		}
		if applet.Entry == "" {
			applet.Entry = "/src/main.tsx"
		}
		if applet.Dev == nil {
			applet.Dev = &AppletDevConfig{}
		}
		if applet.Dev.VitePort == 0 {
			applet.Dev.VitePort = DefaultViteBasePort + i
		}
		if applet.RPC == nil {
			applet.RPC = &AppletRPCConfig{}
		}
		if applet.RPC.RouterFunc == "" {
			applet.RPC.RouterFunc = DefaultRouterFunc
		}
	}
}

// Validate checks required fields, unique ports, and non-empty process names.
// Iteration over applets uses sorted names for deterministic error messages.
func Validate(cfg *ProjectConfig) error {
	for i, p := range cfg.Dev.Processes {
		if p.Name == "" {
			return fmt.Errorf("dev.processes[%d]: name is required", i)
		}
		if p.Command == "" {
			return fmt.Errorf("dev.processes[%d] (%s): command is required", i, p.Name)
		}
	}

	usedPorts := make(map[int]string)
	for _, name := range cfg.AppletNames() {
		applet := cfg.Applets[name]
		if applet.BasePath == "" {
			return fmt.Errorf("applets.%s: base_path is required", name)
		}
		if applet.Dev != nil && applet.Dev.VitePort != 0 {
			if other, ok := usedPorts[applet.Dev.VitePort]; ok {
				return fmt.Errorf("applets.%s: vite_port %d conflicts with applet %s", name, applet.Dev.VitePort, other)
			}
			usedPorts[applet.Dev.VitePort] = name
		}
	}

	return nil
}

// AppletNames returns sorted applet names from the config.
func (c *ProjectConfig) AppletNames() []string {
	names := make([]string, 0, len(c.Applets))
	for name := range c.Applets {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// FirstCriticalProcess returns the name of the first critical process, or empty string.
func (c *ProjectConfig) FirstCriticalProcess() string {
	for _, p := range c.Dev.Processes {
		if p.Critical {
			return p.Name
		}
	}
	return ""
}
