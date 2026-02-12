// Package config keeps backwards-compatible aliases for the public applets config package.
package config

import public "github.com/iota-uz/applets/config"

const (
	DefaultViteBasePort = public.DefaultViteBasePort
	ConfigVersion       = public.ConfigVersion
)

type ProjectConfig = public.ProjectConfig
type DevConfig = public.DevConfig
type ProcessConfig = public.ProcessConfig
type AppletConfig = public.AppletConfig
type AppletDevConfig = public.AppletDevConfig
type AppletRPCConfig = public.AppletRPCConfig
type AppletEngineConfig = public.AppletEngineConfig
type AppletEngineBackendsConfig = public.AppletEngineBackendsConfig
type AppletEngineRedisConfig = public.AppletEngineRedisConfig
type AppletEngineFilesConfig = public.AppletEngineFilesConfig
type AppletEngineSecretsConfig = public.AppletEngineSecretsConfig

var ErrConfigNotFound = public.ErrConfigNotFound

func FindRoot() (string, error) {
	return public.FindRoot()
}

func LoadFromCWD() (root string, cfg *ProjectConfig, err error) {
	return public.LoadFromCWD()
}

func ResolveApplet(cfg *ProjectConfig, name string) (*AppletConfig, error) {
	return public.ResolveApplet(cfg, name)
}

func Load(root string) (*ProjectConfig, error) {
	return public.Load(root)
}

func ApplyDefaults(cfg *ProjectConfig) {
	public.ApplyDefaults(cfg)
}

func Validate(cfg *ProjectConfig) error {
	return public.Validate(cfg)
}
