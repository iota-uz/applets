package cli

import (
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/iota-uz/applets/internal/config"
)

func TestResolveSDKRoot_PrefersFlagOverEnv(t *testing.T) {
	tmp := t.TempDir()

	root := filepath.Join(tmp, "project")
	require.NoError(t, os.MkdirAll(root, 0o755))
	writePackageJSON(t, root, `{"name":"@eai/project"}`)

	flagSDK := filepath.Join(tmp, "flag-applets")
	require.NoError(t, os.MkdirAll(flagSDK, 0o755))
	writePackageJSON(t, flagSDK, `{"name":"@iota-uz/sdk"}`)

	envSDK := filepath.Join(tmp, "env-applets")
	require.NoError(t, os.MkdirAll(envSDK, 0o755))
	writePackageJSON(t, envSDK, `{"name":"@iota-uz/sdk"}`)

	t.Setenv("APPLET_SDK_ROOT", envSDK)
	got, err := resolveSDKRoot(root, flagSDK)
	require.NoError(t, err)

	absFlagSDK, err := filepath.Abs(flagSDK)
	require.NoError(t, err)
	assert.Equal(t, absFlagSDK, got)
}

func TestResolveSDKRoot_UsesEnvWhenFlagMissing(t *testing.T) {
	tmp := t.TempDir()

	root := filepath.Join(tmp, "project")
	require.NoError(t, os.MkdirAll(root, 0o755))
	writePackageJSON(t, root, `{"name":"@eai/project"}`)

	envSDK := filepath.Join(tmp, "applets")
	require.NoError(t, os.MkdirAll(envSDK, 0o755))
	writePackageJSON(t, envSDK, `{"name":"@iota-uz/sdk"}`)

	t.Setenv("APPLET_SDK_ROOT", envSDK)
	got, err := resolveSDKRoot(root, "")
	require.NoError(t, err)

	absEnvSDK, err := filepath.Abs(envSDK)
	require.NoError(t, err)
	assert.Equal(t, absEnvSDK, got)
}

func TestResolveSDKRoot_AutoDiscoveryFindsSiblingApplets(t *testing.T) {
	tmp := t.TempDir()

	root := filepath.Join(tmp, "workspace", "eai", "back")
	require.NoError(t, os.MkdirAll(root, 0o755))
	writePackageJSON(t, root, `{"name":"@eai/back"}`)

	siblingSDK := filepath.Join(tmp, "workspace", "applets")
	require.NoError(t, os.MkdirAll(siblingSDK, 0o755))
	writePackageJSON(t, siblingSDK, `{"name":"@iota-uz/sdk"}`)

	t.Setenv("APPLET_SDK_ROOT", "")
	got, err := resolveSDKRoot(root, "")
	require.NoError(t, err)

	absSiblingSDK, err := filepath.Abs(siblingSDK)
	require.NoError(t, err)
	assert.Equal(t, absSiblingSDK, got)
}

func TestDiscoverSDKConsumerDirs_FindsRootAndAppletWebConsumers(t *testing.T) {
	tmp := t.TempDir()

	root := filepath.Join(tmp, "project")
	require.NoError(t, os.MkdirAll(root, 0o755))
	writePackageJSON(t, root, `{"name":"@eai/root","dependencies":{"@iota-uz/sdk":"0.4.0"}}`)

	aliWeb := filepath.Join(root, "modules", "ali", "presentation", "web")
	require.NoError(t, os.MkdirAll(aliWeb, 0o755))
	writePackageJSON(t, aliWeb, `{"name":"@eai/ali-web","devDependencies":{"@iota-uz/sdk":"0.4.0"}}`)

	salesWeb := filepath.Join(root, "modules", "sales", "presentation", "web")
	require.NoError(t, os.MkdirAll(salesWeb, 0o755))
	writePackageJSON(t, salesWeb, `{"name":"@eai/sales-web"}`)

	cfg := &config.ProjectConfig{
		Applets: map[string]*config.AppletConfig{
			"ali": {
				Web: "modules/ali/presentation/web",
			},
			"sales": {
				Web: "modules/sales/presentation/web",
			},
		},
	}

	got, err := discoverSDKConsumerDirs(root, cfg)
	require.NoError(t, err)

	absRoot, err := filepath.Abs(root)
	require.NoError(t, err)
	absAliWeb, err := filepath.Abs(aliWeb)
	require.NoError(t, err)

	want := []string{absRoot, absAliWeb}
	sort.Strings(want)
	assert.Equal(t, want, got)
}

func writePackageJSON(t *testing.T, dir, content string) {
	t.Helper()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "package.json"), []byte(content), 0o644))
}

