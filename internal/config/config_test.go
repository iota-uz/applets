package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoad(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, ".applets")
	require.NoError(t, os.MkdirAll(dir, 0755))

	content := `
version = 2

[[dev.processes]]
name = "air"
command = "air"
critical = true

[[dev.processes]]
name = "templ"
command = "templ"
args = ["generate", "--watch"]

[applets.bichat]
base_path = "/bi-chat"
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "config.toml"), []byte(content), 0644))

	cfg, err := Load(root)
	require.NoError(t, err)

	assert.Len(t, cfg.Dev.Processes, 2)
	assert.Equal(t, "air", cfg.Dev.Processes[0].Name)
	assert.True(t, cfg.Dev.Processes[0].Critical)
	assert.Equal(t, "templ", cfg.Dev.Processes[1].Name)
	assert.Equal(t, []string{"generate", "--watch"}, cfg.Dev.Processes[1].Args)

	require.Contains(t, cfg.Applets, "bichat")
	bichat := cfg.Applets["bichat"]
	assert.Equal(t, "/bi-chat", bichat.BasePath)
	assert.Equal(t, filepath.Join("modules", "bichat", "presentation", "web"), bichat.Web)
	assert.Equal(t, 5173, bichat.Dev.VitePort)
}

func TestApplyDefaults(t *testing.T) {
	cfg := &ProjectConfig{
		Version: ConfigVersion,
		Applets: map[string]*AppletConfig{
			"alpha": {BasePath: "/alpha"},
			"beta":  {BasePath: "/beta", Web: "custom/web"},
			"gamma": {BasePath: "/gamma"},
		},
	}

	ApplyDefaults(cfg)

	// Sequential ports in sorted name order
	assert.Equal(t, 5173, cfg.Applets["alpha"].Dev.VitePort)
	assert.Equal(t, 5174, cfg.Applets["beta"].Dev.VitePort)
	assert.Equal(t, 5175, cfg.Applets["gamma"].Dev.VitePort)

	// Convention-derived web path
	assert.Equal(t, filepath.Join("modules", "alpha", "presentation", "web"), cfg.Applets["alpha"].Web)

	// Explicit web override is preserved
	assert.Equal(t, "custom/web", cfg.Applets["beta"].Web)

	// RPC config initialized
	assert.NotNil(t, cfg.Applets["alpha"].RPC)
}

func TestValidate_MissingBasePath(t *testing.T) {
	cfg := &ProjectConfig{
		Version: ConfigVersion,
		Applets: map[string]*AppletConfig{
			"myapp": {},
		},
	}
	ApplyDefaults(cfg)
	err := Validate(cfg)
	assert.ErrorContains(t, err, "base_path is required")
}

func TestValidate_DuplicateVitePorts(t *testing.T) {
	cfg := &ProjectConfig{
		Version: ConfigVersion,
		Applets: map[string]*AppletConfig{
			"app1": {BasePath: "/a", Dev: &AppletDevConfig{VitePort: 5173}},
			"app2": {BasePath: "/b", Dev: &AppletDevConfig{VitePort: 5173}},
		},
	}
	err := Validate(cfg)
	assert.ErrorContains(t, err, "vite_port 5173 conflicts")
}

func TestProcessEnv(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, ".applets")
	require.NoError(t, os.MkdirAll(dir, 0755))

	content := `
version = 2

[[dev.processes]]
name = "air"
command = "air"
critical = true
env = { MY_VAR = "hello" }

[applets.test]
base_path = "/test"
`
	require.NoError(t, os.WriteFile(filepath.Join(dir, "config.toml"), []byte(content), 0644))

	cfg, err := Load(root)
	require.NoError(t, err)

	assert.Equal(t, map[string]string{"MY_VAR": "hello"}, cfg.Dev.Processes[0].Env)
}
