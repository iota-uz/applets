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

// DefaultViteBasePort is the base port for applet Vite dev servers.
// Applets are assigned ports sequentially: 5173, 5174, 5175, etc.
const DefaultViteBasePort = 5173

const (
	// ConfigVersion is the only supported schema version for .applets/config.toml.
	ConfigVersion = 2

	EngineRuntimeOff = "off"
	EngineRuntimeBun = "bun"

	KVBackendMemory = "memory"
	KVBackendRedis  = "redis"

	DBBackendMemory   = "memory"
	DBBackendPostgres = "postgres"

	JobsBackendMemory   = "memory"
	JobsBackendPostgres = "postgres"

	FilesBackendLocal    = "local"
	FilesBackendPostgres = "postgres"

	SecretsBackendEnv      = "env"
	SecretsBackendPostgres = "postgres"
)

// ProjectConfig is the top-level config from .applets/config.toml.
type ProjectConfig struct {
	Version int                      `toml:"version"`
	Dev     DevConfig                `toml:"dev"`
	Applets map[string]*AppletConfig `toml:"applets"`
}

// DevConfig holds project-level dev process definitions.
type DevConfig struct {
	Processes []ProcessConfig `toml:"processes"`
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
	BasePath string              `toml:"base_path"`
	Web      string              `toml:"web"`
	Dev      *AppletDevConfig    `toml:"dev"`
	RPC      *AppletRPCConfig    `toml:"rpc"`
	Engine   *AppletEngineConfig `toml:"engine"`
}

// AppletDevConfig holds applet-specific dev settings.
type AppletDevConfig struct {
	VitePort int `toml:"vite_port"`
}

// AppletRPCConfig holds applet-specific RPC codegen settings.
type AppletRPCConfig struct {
	NeedsReexportShim bool `toml:"needs_reexport_shim"`
}

// AppletEngineConfig holds per-applet engine runtime and backend settings.
type AppletEngineConfig struct {
	Runtime  string                     `toml:"runtime"`
	BunBin   string                     `toml:"bun_bin"`
	Backends AppletEngineBackendsConfig `toml:"backends"`
	Redis    AppletEngineRedisConfig    `toml:"redis"`
	Files    AppletEngineFilesConfig    `toml:"files"`
	Secrets  AppletEngineSecretsConfig  `toml:"secrets"`
}

type AppletEngineBackendsConfig struct {
	KV      string `toml:"kv"`
	DB      string `toml:"db"`
	Jobs    string `toml:"jobs"`
	Files   string `toml:"files"`
	Secrets string `toml:"secrets"`
}

type AppletEngineRedisConfig struct {
	URL string `toml:"url"`
}

type AppletEngineFilesConfig struct {
	Dir string `toml:"dir"`
}

type AppletEngineSecretsConfig struct {
	MasterKeyFile string `toml:"master_key_file"`
}

const configDir = ".applets"
const configFile = "config.toml"

// ErrConfigNotFound is returned when .applets/config.toml was not found while walking up from cwd.
var ErrConfigNotFound = errors.New("could not find .applets/config.toml")

// FindRoot returns the project root by searching for .applets/config.toml walking up from cwd.
func FindRoot() (string, error) {
	return findRootAppletsConfig()
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
		if !os.IsNotExist(err) {
			return "", fmt.Errorf("stat %s: %w", candidate, err)
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("%w (walked up from %s)", ErrConfigNotFound, cwd)
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

func defaultEngineConfig() AppletEngineConfig {
	return AppletEngineConfig{
		Runtime: EngineRuntimeOff,
		BunBin:  "bun",
		Backends: AppletEngineBackendsConfig{
			KV:      KVBackendMemory,
			DB:      DBBackendMemory,
			Jobs:    JobsBackendMemory,
			Files:   FilesBackendLocal,
			Secrets: SecretsBackendEnv,
		},
	}
}

func withEngineDefaults(engine *AppletEngineConfig) AppletEngineConfig {
	effective := defaultEngineConfig()
	if engine == nil {
		return effective
	}
	if strings.TrimSpace(engine.Runtime) != "" {
		effective.Runtime = strings.TrimSpace(engine.Runtime)
	}
	if strings.TrimSpace(engine.BunBin) != "" {
		effective.BunBin = strings.TrimSpace(engine.BunBin)
	}
	if strings.TrimSpace(engine.Backends.KV) != "" {
		effective.Backends.KV = strings.TrimSpace(engine.Backends.KV)
	}
	if strings.TrimSpace(engine.Backends.DB) != "" {
		effective.Backends.DB = strings.TrimSpace(engine.Backends.DB)
	}
	if strings.TrimSpace(engine.Backends.Jobs) != "" {
		effective.Backends.Jobs = strings.TrimSpace(engine.Backends.Jobs)
	}
	if strings.TrimSpace(engine.Backends.Files) != "" {
		effective.Backends.Files = strings.TrimSpace(engine.Backends.Files)
	}
	if strings.TrimSpace(engine.Backends.Secrets) != "" {
		effective.Backends.Secrets = strings.TrimSpace(engine.Backends.Secrets)
	}
	effective.Redis.URL = strings.TrimSpace(engine.Redis.URL)
	effective.Files.Dir = strings.TrimSpace(engine.Files.Dir)
	effective.Secrets.MasterKeyFile = strings.TrimSpace(engine.Secrets.MasterKeyFile)
	return effective
}

// EffectiveEngineConfig returns the applet engine configuration with defaults applied.
// If the applet does not define an engine section, defaults are returned.
func (c *ProjectConfig) EffectiveEngineConfig(appletName string) AppletEngineConfig {
	if c == nil || appletName == "" || c.Applets == nil {
		return defaultEngineConfig()
	}
	applet := c.Applets[appletName]
	if applet == nil {
		return defaultEngineConfig()
	}
	return withEngineDefaults(applet.Engine)
}

// ApplyDefaults fills convention-derived fields for each applet.
// Applets with vite_port unset get a unique default (DefaultViteBasePort + index) to avoid port conflicts.
func ApplyDefaults(cfg *ProjectConfig) {
	if cfg.Applets == nil {
		cfg.Applets = make(map[string]*AppletConfig)
	}
	names := make([]string, 0, len(cfg.Applets))
	for name := range cfg.Applets {
		names = append(names, name)
	}
	sort.Strings(names)
	for i, name := range names {
		applet := cfg.Applets[name]
		if applet.Web == "" {
			applet.Web = filepath.Join("modules", name, "presentation", "web")
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
		if applet.Engine != nil {
			effective := withEngineDefaults(applet.Engine)
			applet.Engine = &effective
		}
	}
}

func validateEnum(fieldPath, value string, allowed ...string) error {
	for _, a := range allowed {
		if value == a {
			return nil
		}
	}
	return fmt.Errorf("%s must be one of [%s], got %q", fieldPath, strings.Join(allowed, ", "), value)
}

func validateAppletEngine(appletName string, cfg AppletEngineConfig) error {
	if err := validateEnum(fmt.Sprintf("applets.%s.engine.runtime", appletName), cfg.Runtime, EngineRuntimeOff, EngineRuntimeBun); err != nil {
		return err
	}
	if err := validateEnum(fmt.Sprintf("applets.%s.engine.backends.kv", appletName), cfg.Backends.KV, KVBackendMemory, KVBackendRedis); err != nil {
		return err
	}
	if err := validateEnum(fmt.Sprintf("applets.%s.engine.backends.db", appletName), cfg.Backends.DB, DBBackendMemory, DBBackendPostgres); err != nil {
		return err
	}
	if err := validateEnum(fmt.Sprintf("applets.%s.engine.backends.jobs", appletName), cfg.Backends.Jobs, JobsBackendMemory, JobsBackendPostgres); err != nil {
		return err
	}
	if err := validateEnum(fmt.Sprintf("applets.%s.engine.backends.files", appletName), cfg.Backends.Files, FilesBackendLocal, FilesBackendPostgres); err != nil {
		return err
	}
	if err := validateEnum(fmt.Sprintf("applets.%s.engine.backends.secrets", appletName), cfg.Backends.Secrets, SecretsBackendEnv, SecretsBackendPostgres); err != nil {
		return err
	}
	if cfg.Backends.KV == KVBackendRedis && cfg.Redis.URL == "" {
		return fmt.Errorf("applets.%s.engine.redis.url is required when backends.kv=redis", appletName)
	}
	if cfg.Backends.Secrets == SecretsBackendPostgres && cfg.Secrets.MasterKeyFile == "" {
		return fmt.Errorf("applets.%s.engine.secrets.master_key_file is required when backends.secrets=postgres", appletName)
	}
	return nil
}

// Validate checks required fields, unique ports, non-empty process names, and engine settings.
// Iteration over applets uses sorted names for deterministic error messages.
func Validate(cfg *ProjectConfig) error {
	if cfg.Version != ConfigVersion {
		return fmt.Errorf("version must be %d", ConfigVersion)
	}

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
		if applet.Engine != nil {
			if err := validateAppletEngine(name, withEngineDefaults(applet.Engine)); err != nil {
				return err
			}
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
