package cli

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devrunner"
)

func TestAppendRPCWatchProcesses_Enabled(t *testing.T) {
	base := []devrunner.ProcessSpec{
		{Name: "vite", Command: "pnpm", Args: []string{"exec", "vite"}},
	}

	got := appendRPCWatchProcesses(base, "/repo", []string{"bichat", "sales"}, true, "applet")
	require.Len(t, got, 3)

	assert.Equal(t, "rpc:bichat", got[1].Name)
	assert.Equal(t, "applet", got[1].Command)
	assert.Equal(t, []string{"rpc", "watch", "--name", "bichat"}, got[1].Args)
	assert.Equal(t, "/repo", got[1].Dir)
	assert.False(t, got[1].Critical)

	assert.Equal(t, "rpc:sales", got[2].Name)
	assert.Equal(t, []string{"rpc", "watch", "--name", "sales"}, got[2].Args)
}

func TestAppendRPCWatchProcesses_Disabled(t *testing.T) {
	base := []devrunner.ProcessSpec{
		{Name: "vite", Command: "pnpm", Args: []string{"exec", "vite"}},
	}

	got := appendRPCWatchProcesses(base, "/repo", []string{"bichat"}, false, "applet")
	require.Len(t, got, 1)
	assert.Equal(t, "vite", got[0].Name)
}

func TestDetectLocalSDKRoot_AutoDetectsLocalSDKForConsumers(t *testing.T) {
	tmp := t.TempDir()

	root := filepath.Join(tmp, "eai")
	require.NoError(t, os.MkdirAll(root, 0o755))
	writePackageJSON(t, root, `{"name":"@eai/project"}`)

	webDir := filepath.Join(root, "modules", "ali", "presentation", "web")
	require.NoError(t, os.MkdirAll(webDir, 0o755))
	writePackageJSON(t, webDir, `{"name":"@eai/ali-web","dependencies":{"@iota-uz/sdk":"0.4.29"}}`)

	localSDK := filepath.Join(root, "applets")
	require.NoError(t, os.MkdirAll(localSDK, 0o755))
	writePackageJSON(t, localSDK, `{"name":"@iota-uz/sdk"}`)

	cfg := &config.ProjectConfig{
		Applets: map[string]*config.AppletConfig{
			"ali": {Web: "modules/ali/presentation/web"},
		},
	}

	alias, err := detectLocalSDKRoot(root, cfg, "")
	require.NoError(t, err)
	require.NotNil(t, alias)
	assert.True(t, alias.Auto)

	absSDK, err := filepath.Abs(localSDK)
	require.NoError(t, err)
	assert.Equal(t, absSDK, alias.Root)
	assert.Equal(t, filepath.Join(absSDK, "dist"), alias.Dist)
}
