// Package config handles .applets/config.toml loading, defaults, and validation.
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/BurntSushi/toml"
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

// ErrConfigNotFound is returned by FindRoot when .applets/config.toml is not found.
var ErrConfigNotFound = errors.New("could not find .applets/config.toml")

// FindRoot walks up from the current working directory looking for .applets/config.toml.
// Returns the project root (the directory containing .applets/).
// Use errors.Is(err, ErrConfigNotFound) to detect "not found" vs other errors (e.g. permission denied).
func FindRoot() (string, error) {
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
func ApplyDefaults(cfg *ProjectConfig) {
	if cfg.Dev.BackendPort == 0 {
		cfg.Dev.BackendPort = 3200
	}
	for name, applet := range cfg.Applets {
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
			applet.Dev.VitePort = 5173
		}
		if applet.RPC == nil {
			applet.RPC = &AppletRPCConfig{}
		}
		if applet.RPC.RouterFunc == "" {
			applet.RPC.RouterFunc = "Router"
		}
	}
}

// Validate checks required fields, unique ports, and non-empty process names.
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
	for name, applet := range cfg.Applets {
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
