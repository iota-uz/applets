package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad_V2(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, ".applets")
	require.NoError(t, os.MkdirAll(dir, 0o755))

	content := `
version = 2

[[dev.processes]]
name = "air"
command = "air"
critical = true

[applets.bichat]
base_path = "/bi-chat"

[applets.bichat.engine]
runtime = "bun"

[applets.bichat.engine.backends]
kv = "redis"
db = "postgres"
jobs = "memory"
files = "local"
secrets = "env"

[applets.bichat.engine.redis]
url = "redis://localhost:6379"
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "config.toml"), []byte(content), 0o644))

	cfg, err := Load(root)
	require.NoError(t, err)

	assert.Equal(t, ConfigVersion, cfg.Version)
	require.Contains(t, cfg.Applets, "bichat")
	assert.Equal(t, "/bi-chat", cfg.Applets["bichat"].BasePath)
	assert.Equal(t, EngineRuntimeBun, cfg.Applets["bichat"].Engine.Runtime)
	assert.Equal(t, "redis://localhost:6379", cfg.Applets["bichat"].Engine.Redis.URL)
}

func TestEffectiveEngineConfig_DefaultsWhenMissing(t *testing.T) {
	cfg := &ProjectConfig{
		Version: ConfigVersion,
		Applets: map[string]*AppletConfig{
			"alpha": {BasePath: "/alpha"},
		},
	}
	ApplyDefaults(cfg)

	engine := cfg.EffectiveEngineConfig("alpha")
	assert.Equal(t, EngineRuntimeOff, engine.Runtime)
	assert.Equal(t, "bun", engine.BunBin)
	assert.Equal(t, KVBackendMemory, engine.Backends.KV)
	assert.Equal(t, DBBackendMemory, engine.Backends.DB)
	assert.Equal(t, JobsBackendMemory, engine.Backends.Jobs)
	assert.Equal(t, FilesBackendLocal, engine.Backends.Files)
	assert.Equal(t, SecretsBackendEnv, engine.Backends.Secrets)
}

func TestValidate_InvalidVersion(t *testing.T) {
	cfg := &ProjectConfig{
		Version: 1,
		Applets: map[string]*AppletConfig{"app": {BasePath: "/app"}},
	}
	ApplyDefaults(cfg)
	err := Validate(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "version must be 2")
}

func TestValidate_SecretsPostgresRequiresMasterKeyFile(t *testing.T) {
	cfg := &ProjectConfig{
		Version: ConfigVersion,
		Applets: map[string]*AppletConfig{
			"bichat": {
				BasePath: "/bi-chat",
				Engine: &AppletEngineConfig{
					Runtime: EngineRuntimeBun,
					Backends: AppletEngineBackendsConfig{
						KV:      KVBackendMemory,
						DB:      DBBackendMemory,
						Jobs:    JobsBackendMemory,
						Files:   FilesBackendLocal,
						Secrets: SecretsBackendPostgres,
					},
				},
			},
		},
	}
	ApplyDefaults(cfg)
	err := Validate(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "master_key_file is required")
}

func TestValidate_KVRedisRequiresURL(t *testing.T) {
	cfg := &ProjectConfig{
		Version: ConfigVersion,
		Applets: map[string]*AppletConfig{
			"bichat": {
				BasePath: "/bi-chat",
				Engine: &AppletEngineConfig{
					Backends: AppletEngineBackendsConfig{KV: KVBackendRedis},
				},
			},
		},
	}
	ApplyDefaults(cfg)
	err := Validate(cfg)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "redis.url is required")
}

func TestLoadFromCWD_WalksUpToConfig(t *testing.T) {
	root := t.TempDir()
	configDir := filepath.Join(root, ".applets")
	require.NoError(t, os.MkdirAll(configDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(configDir, "config.toml"), []byte(`
version = 2
[applets.demo]
base_path = "/demo"
`), 0o644))

	nested := filepath.Join(root, "a", "b", "c")
	require.NoError(t, os.MkdirAll(nested, 0o755))

	oldWD, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(nested))
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})

	foundRoot, cfg, err := LoadFromCWD()
	require.NoError(t, err)
	expectedRoot, err := filepath.EvalSymlinks(root)
	require.NoError(t, err)
	actualRoot, err := filepath.EvalSymlinks(foundRoot)
	require.NoError(t, err)
	assert.Equal(t, expectedRoot, actualRoot)
	assert.Equal(t, ConfigVersion, cfg.Version)
}

func TestLoadFromCWD_NoConfigFound(t *testing.T) {
	emptyRoot := t.TempDir()
	oldWD, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(emptyRoot))
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})

	_, _, err = LoadFromCWD()
	require.Error(t, err)
	assert.Contains(t, err.Error(), ".applets/config.toml")
}
