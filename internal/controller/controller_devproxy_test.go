package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/BurntSushi/toml"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/iota-uz/applets/internal/api"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/language"
)

func ptr(b bool) *bool { return &b }

func TestRegisterDevProxy_StripPrefix(t *testing.T) {
	t.Parallel()

	basePath := "/bi-chat"
	assetsPath := "/assets"
	fullAssetsPath := basePath + assetsPath

	var receivedPath string
	var mu sync.Mutex
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		receivedPath = r.URL.Path
		mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	for _, strip := range []*bool{nil, ptr(true), ptr(false)} {
		name := "StripPrefix_default_true"
		if strip != nil && !*strip {
			name = "StripPrefix_false"
		} else if strip != nil && *strip {
			name = "StripPrefix_true"
		}
		t.Run(name, func(t *testing.T) {
			mu.Lock()
			receivedPath = ""
			mu.Unlock()

			a := &testApplet{
				name:     "chat",
				basePath: basePath,
				config: api.Config{
					WindowGlobal: "__T__",
					Shell:        api.ShellConfig{Mode: api.ShellModeStandalone, Title: "t"},
					Assets: api.AssetConfig{
						BasePath: assetsPath,
						Dev: &api.DevAssetConfig{
							Enabled:     true,
							TargetURL:   backend.URL,
							StripPrefix: strip,
						},
					},
				},
			}
			c, cErr := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
			require.NoError(t, cErr)
			router := mux.NewRouter()
			c.RegisterRoutes(router)

			req := httptest.NewRequest(http.MethodGet, fullAssetsPath+"/@vite/client", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			require.Equal(t, http.StatusOK, rec.Code)
			mu.Lock()
			got := receivedPath
			mu.Unlock()

			expectStrip := strip == nil || (strip != nil && *strip)
			if expectStrip {
				require.Equal(t, "/@vite/client", got, "with StripPrefix true, backend should receive path without assets prefix")
			} else {
				require.Equal(t, fullAssetsPath+"/@vite/client", got, "with StripPrefix false, backend should receive full path")
			}
		})
	}
}

func TestRegisterDevProxy_502WhenTargetDown(t *testing.T) {
	t.Parallel()

	var lc net.ListenConfig
	listener, err := lc.Listen(context.Background(), "tcp", "127.0.0.1:0")
	require.NoError(t, err)
	port := listener.Addr().(*net.TCPAddr).Port
	require.NoError(t, listener.Close())

	targetURL := fmt.Sprintf("http://127.0.0.1:%d", port)
	a := &testApplet{
		name:     "chat",
		basePath: "/bi-chat",
		config: api.Config{
			WindowGlobal: "__T__",
			Shell:        api.ShellConfig{Mode: api.ShellModeStandalone, Title: "t"},
			Assets: api.AssetConfig{
				BasePath: "/assets",
				Dev: &api.DevAssetConfig{
					Enabled:   true,
					TargetURL: targetURL,
				},
			},
		},
	}
	c, cErr := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, cErr)
	router := mux.NewRouter()
	c.RegisterRoutes(router)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/bi-chat/assets/@vite/client", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadGateway, rec.Code, "proxy should return 502 when target is down")
}

func TestDevProxy_BlackBox_AssetRoutes(t *testing.T) {
	t.Parallel()

	viteBody := []byte("vite client js")
	mainBody := []byte("main tsx")
	vite := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/@vite/client":
			w.Header().Set("Content-Type", "application/javascript")
			_, _ = w.Write(viteBody)
		case "/src/main.tsx":
			w.Header().Set("Content-Type", "application/javascript")
			_, _ = w.Write(mainBody)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer vite.Close()

	a := &testApplet{
		name:     "chat",
		basePath: "/bi-chat",
		config: api.Config{
			WindowGlobal: "__T__",
			Shell:        api.ShellConfig{Mode: api.ShellModeStandalone, Title: "t"},
			Assets: api.AssetConfig{
				BasePath: "/assets",
				Dev: &api.DevAssetConfig{
					Enabled:   true,
					TargetURL: vite.URL,
				},
			},
		},
	}
	c, cErr := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, cErr)
	router := mux.NewRouter()
	c.RegisterRoutes(router)

	t.Run("vite_client", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/bi-chat/assets/@vite/client", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, viteBody, rec.Body.Bytes())
	})

	t.Run("main_tsx", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/bi-chat/assets/src/main.tsx", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, mainBody, rec.Body.Bytes())
	})
}

func TestDevProxy_HTMLShell(t *testing.T) {
	t.Parallel()

	basePath := "/bi-chat"
	assetsBasePath := basePath + "/assets"
	entryModule := "/src/main.tsx"

	vite := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer vite.Close()

	bundle := i18n.NewBundle(language.Russian)
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)
	bundle.RegisterUnmarshalFunc("toml", toml.Unmarshal)
	a := &testApplet{
		name:     "chat",
		basePath: basePath,
		config: api.Config{
			WindowGlobal: "__T__",
			Shell:        api.ShellConfig{Mode: api.ShellModeStandalone, Title: "Test"},
			Assets: api.AssetConfig{
				BasePath: "/assets",
				Dev: &api.DevAssetConfig{
					Enabled:     true,
					TargetURL:   vite.URL,
					EntryModule: entryModule,
				},
			},
		},
	}
	c, cErr := New(a, bundle, api.DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, cErr)
	router := mux.NewRouter()
	c.RegisterRoutes(router)

	tenantID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	mockU := &mockUser{id: 1, email: "test@example.com", firstName: "Test", lastName: "User"}
	ctx := context.Background()
	ctx = context.WithValue(ctx, testUserKey, api.AppletUser(mockU))
	ctx = context.WithValue(ctx, testTenantIDKey, tenantID)
	ctx = context.WithValue(ctx, testLocaleKey, language.English)

	req := httptest.NewRequest(http.MethodGet, basePath, nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, "GET %s should return 200", basePath)
	body := rec.Body.String()
	require.Contains(t, body, assetsBasePath+"/@vite/client", "HTML should contain script src for Vite client")
	require.Contains(t, body, assetsBasePath+"/src/main.tsx", "HTML should contain script src for entry module")
	require.True(t, strings.Contains(body, "<script") && strings.Contains(body, "src="), "HTML should contain at least one script tag with src")
}

func TestRegisterDevProxy_502WhenUpstreamReturns502(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer upstream.Close()

	a := &testApplet{
		name:     "chat",
		basePath: "/bi-chat",
		config: api.Config{
			WindowGlobal: "__T__",
			Shell:        api.ShellConfig{Mode: api.ShellModeStandalone, Title: "t"},
			Assets: api.AssetConfig{
				BasePath: "/assets",
				Dev: &api.DevAssetConfig{
					Enabled:   true,
					TargetURL: upstream.URL,
				},
			},
		},
	}
	c, cErr := New(a, nil, api.DefaultSessionConfig, nil, nil, &testHostServices{})
	require.NoError(t, cErr)
	router := mux.NewRouter()
	c.RegisterRoutes(router)

	req := httptest.NewRequest(http.MethodGet, "/bi-chat/assets/@vite/client", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadGateway, rec.Code, "proxy should pass through upstream 502")
}
