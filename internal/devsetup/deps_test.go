package devsetup

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRefreshAppletDeps_EnsuresManagedLocalSDKPackage(t *testing.T) {
	tmp := t.TempDir()

	webDir := filepath.Join(tmp, "modules", "ali", "presentation", "web")
	require.NoError(t, os.MkdirAll(filepath.Join(webDir, "node_modules", "@iota-uz"), 0o755))
	require.NoError(t, os.MkdirAll(filepath.Join(webDir, "node_modules", ".vite"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(webDir, "package.json"), []byte(`{"name":"ali-web","dependencies":{"@iota-uz/sdk":"0.4.29"}}`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(webDir, "node_modules", "@iota-uz", "sdk"), []byte(""), 0o644))

	localSDKRoot := filepath.Join(tmp, "applets")
	require.NoError(t, os.MkdirAll(filepath.Join(localSDKRoot, "dist", "applet"), 0o755))
	require.NoError(t, os.MkdirAll(filepath.Join(localSDKRoot, "dist", "bichat"), 0o755))
	require.NoError(t, os.MkdirAll(filepath.Join(localSDKRoot, "tailwind"), 0o755))
	require.NoError(t, os.MkdirAll(filepath.Join(localSDKRoot, "assets"), 0o755))
	require.NoError(t, os.MkdirAll(filepath.Join(localSDKRoot, "node_modules", "date-fns"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(localSDKRoot, "package.json"), []byte(`{"name":"@iota-uz/sdk","version":"0.4.29"}`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(localSDKRoot, "dist", "index.mjs"), []byte("export {}"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(localSDKRoot, "dist", "applet", "vite.mjs"), []byte("export {}"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(localSDKRoot, "dist", "bichat", "index.mjs"), []byte("export {}"), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(localSDKRoot, "node_modules", "date-fns", "package.json"), []byte(`{"name":"date-fns"}`), 0o644))

	err := RefreshAppletDeps(context.Background(), tmp, webDir, localSDKRoot)
	require.NoError(t, err)

	pkgDir := filepath.Join(webDir, "node_modules", "@iota-uz", "sdk")
	markerPath := filepath.Join(pkgDir, localSDKMarkerFile)
	markerData, err := os.ReadFile(markerPath)
	require.NoError(t, err)

	absSDKRoot, err := filepath.Abs(localSDKRoot)
	require.NoError(t, err)
	assert.Equal(t, absSDKRoot, string(markerData))

	distInfo, err := os.Lstat(filepath.Join(pkgDir, "dist"))
	require.NoError(t, err)
	assert.NotEqual(t, distInfo.Mode()&os.ModeSymlink, os.FileMode(0))
	nodeModulesInfo, err := os.Lstat(filepath.Join(pkgDir, "node_modules"))
	require.NoError(t, err)
	assert.NotEqual(t, nodeModulesInfo.Mode()&os.ModeSymlink, os.FileMode(0))

	_, err = os.Stat(filepath.Join(pkgDir, "dist", "applet", "vite.mjs"))
	require.NoError(t, err)
	_, err = os.Stat(filepath.Join(pkgDir, "node_modules", "date-fns", "package.json"))
	require.NoError(t, err)

	_, err = os.Stat(filepath.Join(webDir, "node_modules", ".vite"))
	assert.Error(t, err)
	assert.True(t, os.IsNotExist(err))
}

func TestRefreshAppletDeps_SkipsManagedLocalSDKPackageForNonConsumers(t *testing.T) {
	tmp := t.TempDir()

	webDir := filepath.Join(tmp, "modules", "sales", "presentation", "web")
	require.NoError(t, os.MkdirAll(filepath.Join(webDir, "node_modules"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(webDir, "package.json"), []byte(`{"name":"sales-web"}`), 0o644))

	localSDKRoot := filepath.Join(tmp, "applets")
	require.NoError(t, os.MkdirAll(filepath.Join(localSDKRoot, "dist"), 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(localSDKRoot, "package.json"), []byte(`{"name":"@iota-uz/sdk","version":"0.4.29"}`), 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(localSDKRoot, "dist", "index.mjs"), []byte("export {}"), 0o644))

	err := RefreshAppletDeps(context.Background(), tmp, webDir, localSDKRoot)
	require.NoError(t, err)

	_, err = os.Stat(filepath.Join(webDir, "node_modules", "@iota-uz", "sdk", localSDKMarkerFile))
	assert.Error(t, err)
	assert.True(t, os.IsNotExist(err))
}
