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

[applets.bichat.dev]
vite_port = 5173
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
	assert.Equal(t, "modules/bichat", bichat.Module)
	assert.Equal(t, filepath.Join("modules", "bichat", "presentation", "web"), bichat.Web)
	assert.Equal(t, "/src/main.tsx", bichat.Entry)
	assert.Equal(t, 5173, bichat.Dev.VitePort)
	assert.Equal(t, "Router", bichat.RPC.RouterFunc)
}

func TestApplyDefaults(t *testing.T) {
	cfg := &ProjectConfig{
		Applets: map[string]*AppletConfig{
			"myapp": {BasePath: "/my-app"},
		},
	}

	ApplyDefaults(cfg)

	app := cfg.Applets["myapp"]
	assert.Equal(t, "modules/myapp", app.Module)
	assert.Equal(t, filepath.Join("modules", "myapp", "presentation", "web"), app.Web)
	assert.Equal(t, "/src/main.tsx", app.Entry)
	assert.Equal(t, 5173, app.Dev.VitePort)
	assert.Equal(t, "Router", app.RPC.RouterFunc)
}

func TestValidate_MissingBasePath(t *testing.T) {
	cfg := &ProjectConfig{
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
		Applets: map[string]*AppletConfig{
			"app1": {BasePath: "/a", Dev: &AppletDevConfig{VitePort: 5173}},
			"app2": {BasePath: "/b", Dev: &AppletDevConfig{VitePort: 5173}},
		},
	}
	err := Validate(cfg)
	assert.ErrorContains(t, err, "vite_port 5173 conflicts")
}

func TestValidate_EmptyProcessName(t *testing.T) {
	cfg := &ProjectConfig{
		Dev: DevConfig{
			Processes: []ProcessConfig{{Command: "air"}},
		},
	}
	err := Validate(cfg)
	assert.ErrorContains(t, err, "name is required")
}

func TestValidate_EmptyProcessCommand(t *testing.T) {
	cfg := &ProjectConfig{
		Dev: DevConfig{
			Processes: []ProcessConfig{{Name: "air"}},
		},
	}
	err := Validate(cfg)
	assert.ErrorContains(t, err, "command is required")
}

func TestAppletNames(t *testing.T) {
	cfg := &ProjectConfig{
		Applets: map[string]*AppletConfig{
			"charlie": {BasePath: "/c"},
			"alice":   {BasePath: "/a"},
			"bob":     {BasePath: "/b"},
		},
	}
	names := cfg.AppletNames()
	assert.Equal(t, []string{"alice", "bob", "charlie"}, names)
}

func TestFirstCriticalProcess(t *testing.T) {
	cfg := &ProjectConfig{
		Dev: DevConfig{
			Processes: []ProcessConfig{
				{Name: "templ", Command: "templ"},
				{Name: "air", Command: "air", Critical: true},
			},
		},
	}
	assert.Equal(t, "air", cfg.FirstCriticalProcess())
}

func TestFirstCriticalProcess_None(t *testing.T) {
	cfg := &ProjectConfig{
		Dev: DevConfig{
			Processes: []ProcessConfig{
				{Name: "templ", Command: "templ"},
			},
		},
	}
	assert.Equal(t, "", cfg.FirstCriticalProcess())
}

func TestProcessEnv(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, ".applets")
	require.NoError(t, os.MkdirAll(dir, 0755))

	content := `
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
