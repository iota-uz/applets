package applet

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"

	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testApplet struct {
	name     string
	basePath string
	config   Config
}

func (a *testApplet) Name() string     { return a.name }
func (a *testApplet) BasePath() string { return a.basePath }
func (a *testApplet) Config() Config   { return a.config }

type countingFS struct {
	fs fs.FS
	n  int
}

func (c *countingFS) Open(name string) (fs.File, error) {
	if name == "manifest.json" {
		c.n++
	}
	return c.fs.Open(name)
}

func TestAppletController_ManifestLoadedOnce(t *testing.T) {
	t.Parallel()

	manifest := `{"index.html":{"file":"assets/main-123.js","css":["assets/main-123.css"],"isEntry":true}}`
	mapFS := fstest.MapFS{
		"manifest.json":       {Data: []byte(manifest)},
		"assets/main-123.js":  {Data: []byte("console.log('x')")},
		"assets/main-123.css": {Data: []byte("body{}")},
	}
	cfs := &countingFS{fs: mapFS}

	a := &testApplet{
		name:     "t",
		basePath: "/t",
		config: Config{
			WindowGlobal: "__T__",
			Shell: ShellConfig{
				Mode:  ShellModeStandalone,
				Title: "t",
			},
			Assets: AssetConfig{
				FS:           cfs,
				BasePath:     "/assets",
				ManifestPath: "manifest.json",
				Entrypoint:   "index.html",
			},
		},
	}

	_, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	assert.Equal(t, 1, cfs.n)
}

func TestAppletController_DevProxy_SkipsManifestRequirements(t *testing.T) {
	t.Parallel()

	a := &testApplet{
		name:     "t",
		basePath: "/t",
		config: Config{
			WindowGlobal: "__T__",
			Shell: ShellConfig{
				Mode:  ShellModeStandalone,
				Title: "t",
			},
			Assets: AssetConfig{
				BasePath: "/assets",
				Dev: &DevAssetConfig{
					Enabled:     true,
					TargetURL:   "http://localhost:5173",
					EntryModule: "/src/main.tsx",
				},
			},
		},
	}

	c, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	_, scripts, err := c.buildAssetTags()
	require.NoError(t, err)
	assert.Contains(t, scripts, "@react-refresh")
	assert.Contains(t, scripts, "/@vite/client")
	assert.Contains(t, scripts, "/src/main.tsx")
}

func TestAppletController_RPC(t *testing.T) {
	t.Parallel()

	baseApplet := func(rpcCfg *RPCConfig) *testApplet {
		return &testApplet{
			name:     "t",
			basePath: "/t",
			config: Config{
				WindowGlobal: "__T__",
				Shell:        ShellConfig{Mode: ShellModeStandalone},
				Assets: AssetConfig{
					FS:           fstest.MapFS{"manifest.json": {Data: []byte(`{"index.html":{"file":"a.js","isEntry":true}}`)}},
					BasePath:     "/assets",
					ManifestPath: "manifest.json",
					Entrypoint:   "index.html",
				},
				RPC: rpcCfg,
			},
		}
	}

	cases := []struct {
		name                   string
		rpcCfg                 *RPCConfig
		req                    func() *http.Request
		ctx                    func(context.Context) context.Context
		wantHTTP               int
		wantRPCError           string
		wantRPCMessageContains string
	}{
		{
			name: "MethodNotFound",
			rpcCfg: &RPCConfig{
				Path: "/rpc",
				Methods: map[string]RPCMethod{
					"ok": {Handler: func(ctx context.Context, params json.RawMessage) (any, error) { return map[string]any{"ok": true}, nil }},
				},
			},
			req: func() *http.Request {
				body := bytes.NewBufferString(`{"id":"1","method":"missing","params":{}}`)
				r := httptest.NewRequest(http.MethodPost, "/t/rpc", body)
				r.Host = "example.com"
				return r
			},
			wantHTTP:     http.StatusOK,
			wantRPCError: "method_not_found",
		},
		{
			name: "PermissionDenied",
			rpcCfg: &RPCConfig{
				Path: "/rpc",
				Methods: map[string]RPCMethod{
					"secret": {
						RequirePermissions: []string{"test.secret"},
						Handler:            func(ctx context.Context, params json.RawMessage) (any, error) { return "ok", nil },
					},
				},
			},
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodPost, "/t/rpc", bytes.NewBufferString(`{"id":"1","method":"secret","params":{}}`))
				r.Host = "example.com"
				return r
			},
			ctx: func(ctx context.Context) context.Context {
				// User with no permissions
				mockU := &mockUser{id: 1, email: "t@example.com", firstName: "T", lastName: "U"}
				return context.WithValue(ctx, testUserKey, AppletUser(mockU))
			},
			wantHTTP:     http.StatusOK,
			wantRPCError: "forbidden",
		},
		{
			name: "WrappedPermissionDeniedPreserved",
			rpcCfg: &RPCConfig{
				Path: "/rpc",
				Methods: map[string]RPCMethod{
					"wrapped": {
						Handler: func(ctx context.Context, params json.RawMessage) (any, error) {
							inner := fmt.Errorf("wrapped.inner: %w: access denied", ErrPermissionDenied)
							return nil, fmt.Errorf("wrapped.outer: %w", inner)
						},
					},
				},
			},
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodPost, "/t/rpc", bytes.NewBufferString(`{"id":"1","method":"wrapped","params":{}}`))
				r.Host = "example.com"
				return r
			},
			wantHTTP:     http.StatusOK,
			wantRPCError: "forbidden",
		},
		{
			name: "GenericErrorMessageSanitizedByDefault",
			rpcCfg: &RPCConfig{
				Path: "/rpc",
				Methods: map[string]RPCMethod{
					"explode": {
						Handler: func(ctx context.Context, params json.RawMessage) (any, error) {
							return nil, errors.New("chat service not registered")
						},
					},
				},
			},
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodPost, "/t/rpc", bytes.NewBufferString(`{"id":"1","method":"explode","params":{}}`))
				r.Host = "example.com"
				return r
			},
			wantHTTP:               http.StatusOK,
			wantRPCError:           "error",
			wantRPCMessageContains: "request failed",
		},
		{
			name: "GenericErrorMessageExposedWhenEnabled",
			rpcCfg: &RPCConfig{
				Path: "/rpc",
				ExposeInternalErrors: func() *bool {
					v := true
					return &v
				}(),
				Methods: map[string]RPCMethod{
					"explode": {
						Handler: func(ctx context.Context, params json.RawMessage) (any, error) {
							return nil, errors.New("chat service not registered")
						},
					},
				},
			},
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodPost, "/t/rpc", bytes.NewBufferString(`{"id":"1","method":"explode","params":{}}`))
				r.Host = "example.com"
				return r
			},
			wantHTTP:               http.StatusOK,
			wantRPCError:           "error",
			wantRPCMessageContains: "chat service not registered",
		},
		{
			name: "PayloadTooLarge",
			rpcCfg: &RPCConfig{
				Path:         "/rpc",
				MaxBodyBytes: 32,
				Methods: map[string]RPCMethod{
					"ok": {Handler: func(ctx context.Context, params json.RawMessage) (any, error) { return "ok", nil }},
				},
			},
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodPost, "/t/rpc", bytes.NewBufferString(`{"id":"1","method":"ok","params":{"x":"this is too long"}}`))
				r.Host = "example.com"
				return r
			},
			wantHTTP:     http.StatusRequestEntityTooLarge,
			wantRPCError: "payload_too_large",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			a := baseApplet(tc.rpcCfg)
			c, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
			require.NoError(t, err)

			req := tc.req()
			if tc.ctx != nil {
				req = req.WithContext(tc.ctx(req.Context()))
			}
			w := httptest.NewRecorder()

			c.handleRPC(w, req)
			require.Equal(t, tc.wantHTTP, w.Code)

			if tc.wantRPCError == "" {
				return
			}

			var resp rpcResponse
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
			require.NotNil(t, resp.Error)
			assert.Equal(t, tc.wantRPCError, resp.Error.Code)
			if tc.wantRPCError == "forbidden" {
				assert.Equal(t, "permission denied", resp.Error.Message)
			}
			if tc.wantRPCMessageContains != "" {
				assert.Contains(t, resp.Error.Message, tc.wantRPCMessageContains)
			}
		})
	}
}

func TestRequirePermissions_Allows(t *testing.T) {
	t.Parallel()

	mockU := &mockUser{
		id:          1,
		email:       "t@example.com",
		permissions: []string{"test.secret"},
	}

	ctx := context.WithValue(context.Background(), testUserKey, AppletUser(mockU))

	a := &testApplet{name: "t", basePath: "/t", config: Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	}}
	c, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	require.NoError(t, c.requirePermissions(ctx, []string{"test.secret"}))
}

func TestRequirePermissions_AllowsPascalCase(t *testing.T) {
	t.Parallel()

	mockU := &mockUser{
		id:          1,
		email:       "t@example.com",
		permissions: []string{"Test.Secret"},
	}

	ctx := context.WithValue(context.Background(), testUserKey, AppletUser(mockU))

	a := &testApplet{name: "t", basePath: "/t", config: Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	}}
	c, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	require.NoError(t, c.requirePermissions(ctx, []string{"Test.Secret"}))
}

func TestRequirePermissions_AllowsViaPermissionNames(t *testing.T) {
	t.Parallel()

	mockU := &mockUser{
		id:          1,
		email:       "t@example.com",
		permissions: []string{"BiChat.Access"},
	}

	ctx := context.WithValue(context.Background(), testUserKey, AppletUser(mockU))

	a := &testApplet{name: "t", basePath: "/t", config: Config{
		WindowGlobal: "__T__",
		Shell:        ShellConfig{Mode: ShellModeStandalone},
		Assets:       AssetConfig{Dev: &DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	}}
	c, err := NewAppletController(a, nil, DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	require.NoError(t, c.requirePermissions(ctx, []string{"BiChat.Access"}))
}
