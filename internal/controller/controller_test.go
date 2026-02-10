package controller

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

	"github.com/iota-uz/applets/internal/api"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
		"manifest.json":      {Data: []byte(manifest)},
		"assets/main-123.js": {Data: []byte("console.log('x')")},
		"assets/main-123.css": {Data: []byte("body{}")},
	}
	cfs := &countingFS{fs: mapFS}

	a := &testApplet{
		name:     "t",
		basePath: "/t",
		config: api.Config{
			WindowGlobal: "__T__",
			Shell: api.ShellConfig{
				Mode:  api.ShellModeStandalone,
				Title: "t",
			},
			Assets: api.AssetConfig{
				FS:           cfs,
				BasePath:     "/assets",
				ManifestPath: "manifest.json",
				Entrypoint:   "index.html",
			},
		},
	}

	_, err := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	assert.Equal(t, 1, cfs.n)
}

func TestAppletController_DevProxy_SkipsManifestRequirements(t *testing.T) {
	t.Parallel()

	a := &testApplet{
		name:     "t",
		basePath: "/t",
		config: api.Config{
			WindowGlobal: "__T__",
			Shell: api.ShellConfig{
				Mode:  api.ShellModeStandalone,
				Title: "t",
			},
			Assets: api.AssetConfig{
				BasePath: "/assets",
				Dev: &api.DevAssetConfig{
					Enabled:     true,
					TargetURL:   "http://localhost:5173",
					EntryModule: "/src/main.tsx",
				},
			},
		},
	}

	c, err := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	_, scripts, err := c.buildAssetTags()
	require.NoError(t, err)
	assert.Contains(t, scripts, "@react-refresh")
	assert.Contains(t, scripts, "/@vite/client")
	assert.Contains(t, scripts, "/src/main.tsx")
}

func TestAppletController_RPC(t *testing.T) {
	t.Parallel()

	baseApplet := func(rpcCfg *api.RPCConfig) *testApplet {
		return &testApplet{
			name:     "t",
			basePath: "/t",
			config: api.Config{
				WindowGlobal: "__T__",
				Shell:        api.ShellConfig{Mode: api.ShellModeStandalone},
				Assets: api.AssetConfig{
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
		rpcCfg                 *api.RPCConfig
		req                    func() *http.Request
		ctx                    func(context.Context) context.Context
		wantHTTP               int
		wantRPCError           string
		wantRPCMessageContains string
		wantResultKey          string // if set, assert resp.Result contains this key
	}{
		{
			name: "SuccessfulCall",
			rpcCfg: &api.RPCConfig{
				Path: "/rpc",
				Methods: map[string]api.RPCMethod{
					"echo": {Handler: func(ctx context.Context, params json.RawMessage) (any, error) {
						return map[string]any{"msg": "hello"}, nil
					}},
				},
			},
			req: func() *http.Request {
				r := httptest.NewRequest(http.MethodPost, "/t/rpc", bytes.NewBufferString(`{"id":"42","method":"echo","params":{}}`))
				r.Host = "example.com"
				return r
			},
			wantHTTP:      http.StatusOK,
			wantResultKey: "msg",
		},
		{
			name: "MethodNotFound",
			rpcCfg: &api.RPCConfig{
				Path: "/rpc",
				Methods: map[string]api.RPCMethod{
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
			rpcCfg: &api.RPCConfig{
				Path: "/rpc",
				Methods: map[string]api.RPCMethod{
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
				mockU := &mockUser{id: 1, email: "t@example.com", firstName: "T", lastName: "U"}
				return context.WithValue(ctx, testUserKey, api.AppletUser(mockU))
			},
			wantHTTP:     http.StatusOK,
			wantRPCError: "forbidden",
		},
		{
			name: "WrappedPermissionDeniedPreserved",
			rpcCfg: &api.RPCConfig{
				Path: "/rpc",
				Methods: map[string]api.RPCMethod{
					"wrapped": {
						Handler: func(ctx context.Context, params json.RawMessage) (any, error) {
							inner := fmt.Errorf("wrapped.inner: %w: access denied", api.ErrPermissionDenied)
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
			rpcCfg: &api.RPCConfig{
				Path: "/rpc",
				Methods: map[string]api.RPCMethod{
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
			rpcCfg: &api.RPCConfig{
				Path: "/rpc",
				ExposeInternalErrors: func() *bool { v := true; return &v }(),
				Methods: map[string]api.RPCMethod{
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
			rpcCfg: &api.RPCConfig{
				Path:         "/rpc",
				MaxBodyBytes: 32,
				Methods: map[string]api.RPCMethod{
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
			c, err := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
			require.NoError(t, err)
			req := tc.req()
			if tc.ctx != nil {
				req = req.WithContext(tc.ctx(req.Context()))
			}
			w := httptest.NewRecorder()

			c.handleRPC(w, req)
			require.Equal(t, tc.wantHTTP, w.Code)

			var resp rpcResponse
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

			if tc.wantRPCError == "" {
				require.Nil(t, resp.Error, "expected no RPC error")
				if tc.wantResultKey != "" {
					result, ok := resp.Result.(map[string]any)
					require.True(t, ok, "expected result to be a map")
					assert.Contains(t, result, tc.wantResultKey)
				}
				return
			}

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
	ctx := context.WithValue(context.Background(), testUserKey, api.AppletUser(mockU))

	a := &testApplet{name: "t", basePath: "/t", config: api.Config{
		WindowGlobal: "__T__",
		Shell:        api.ShellConfig{Mode: api.ShellModeStandalone},
		Assets:       api.AssetConfig{Dev: &api.DevAssetConfig{Enabled: true, TargetURL: "http://localhost:5173"}},
	}}
	c, err := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, err)
	require.NoError(t, c.requirePermissions(ctx, []string{"test.secret"}))
}

