package applet

import (
	"context"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateAppletName(t *testing.T) {
	t.Parallel()

	assert.NoError(t, ValidateAppletName("bichat"))
	assert.NoError(t, ValidateAppletName("bi-chat"))
	assert.Error(t, ValidateAppletName(""))
	assert.Error(t, ValidateAppletName("  "))
}

func TestValidateConfig_Valid(t *testing.T) {
	t.Parallel()

	// Standalone with dev proxy
	err := ValidateConfig(Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	})
	assert.NoError(t, err)

	// Standalone with FS
	err = ValidateConfig(Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets: AssetConfig{
			FS:           fstest.MapFS{"manifest.json": {Data: []byte(`{}`)}},
			ManifestPath: "manifest.json",
			Entrypoint:   "index.html",
		},
	})
	assert.NoError(t, err)
}

func TestValidateConfig_MissingWindowGlobal(t *testing.T) {
	t.Parallel()

	err := ValidateConfig(Config{
		Shell:  ShellConfig{Mode: ShellModeStandalone},
		Assets: AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "WindowGlobal")
}

func TestValidateConfig_MissingShellMode(t *testing.T) {
	t.Parallel()

	err := ValidateConfig(Config{
		WindowGlobal: "__T__",
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Mode is required")
}

func TestValidateConfig_UnknownShellMode(t *testing.T) {
	t.Parallel()

	err := ValidateConfig(Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: "invalid"},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unknown Mode")
}

func TestValidateConfig_EmbeddedWithoutLayout(t *testing.T) {
	t.Parallel()

	err := ValidateConfig(Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeEmbedded},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "Layout is required")
}

func TestValidateConfig_MissingAssetFS(t *testing.T) {
	t.Parallel()

	err := ValidateConfig(Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets:       AssetConfig{ManifestPath: "m.json", Entrypoint: "index.html"},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "FS is required")
}

func TestValidateConfig_MissingManifestPath(t *testing.T) {
	t.Parallel()

	err := ValidateConfig(Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets: AssetConfig{
			FS:         fstest.MapFS{},
			Entrypoint: "index.html",
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ManifestPath is required")
}

func TestValidateConfig_MissingDevTargetURL(t *testing.T) {
	t.Parallel()

	err := ValidateConfig(Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true}},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "TargetURL is required")
}

func TestNewAppletController_NilApplet(t *testing.T) {
	t.Parallel()

	_, err := NewAppletController(nil, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "applet is nil")
}

func TestNewAppletController_EmptyName(t *testing.T) {
	t.Parallel()

	a := &testApplet{name: "", basePath: "/t", config: Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	}}
	_, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "applet name is empty")
}

func TestNewAppletController_InvalidConfig(t *testing.T) {
	t.Parallel()

	a := &testApplet{name: "t", basePath: "/t", config: Config{
		// Missing WindowGlobal
		Shell:  ShellConfig{Mode: ShellModeStandalone},
		Assets: AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	}}
	_, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "WindowGlobal")
}

func TestAddProcedure_NilRouter(t *testing.T) {
	t.Parallel()

	err := AddProcedure(nil, "test", Procedure[struct{}, struct{}]{
		Handler: func(ctx context.Context, params struct{}) (struct{}, error) {
			return struct{}{}, nil
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")
}

func TestAddProcedure_EmptyName(t *testing.T) {
	t.Parallel()

	r := NewTypedRPCRouter()
	err := AddProcedure(r, "", Procedure[struct{}, struct{}]{
		Handler: func(ctx context.Context, params struct{}) (struct{}, error) {
			return struct{}{}, nil
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "name is empty")
}

func TestAddProcedure_NilHandler(t *testing.T) {
	t.Parallel()

	r := NewTypedRPCRouter()
	err := AddProcedure(r, "test", Procedure[struct{}, struct{}]{})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "handler is nil")
}
