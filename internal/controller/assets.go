package controller

import (
	"fmt"
	"html/template"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"
	"github.com/iota-uz/applets/internal/api"
	"github.com/iota-uz/applets/internal/manifest"
)

var mimeTypes = map[string]string{
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
	".woff": "font/woff", ".woff2": "font/woff2",
}

func (c *Controller) initAssets() error {
	config := c.applet.Config()
	assetsPath := strings.TrimSpace(config.Assets.BasePath)
	if assetsPath == "" {
		assetsPath = "/assets"
	}
	if !strings.HasPrefix(assetsPath, "/") {
		assetsPath = "/" + assetsPath
	}
	c.assetsBasePath = path.Join("/", strings.TrimPrefix(c.applet.BasePath(), "/"), strings.TrimPrefix(assetsPath, "/"))
	if config.Assets.Dev != nil && config.Assets.Dev.Enabled {
		dev := *config.Assets.Dev
		if dev.ClientModule == "" {
			dev.ClientModule = "/@vite/client"
		}
		if dev.StripPrefix == nil {
			v := true
			dev.StripPrefix = &v
		}
		c.devAssets = &dev
		return nil
	}
	m, err := manifest.LoadManifest(config.Assets.FS, config.Assets.ManifestPath)
	if err != nil {
		return err
	}
	resolved, err := manifest.ResolveAssets(m, config.Assets.Entrypoint, c.assetsBasePath)
	if err != nil {
		return err
	}
	c.resolvedAssets = resolved
	return nil
}

func (c *Controller) registerAssetRoutes(router *mux.Router, fullAssetsPath string) {
	if c.devAssets != nil {
		c.registerDevProxy(router, fullAssetsPath, c.devAssets)
		return
	}
	config := c.applet.Config()
	fileServer := http.FileServer(http.FS(config.Assets.FS))
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if mimeType, ok := mimeTypes[filepath.Ext(r.URL.Path)]; ok {
			w.Header().Set("Content-Type", mimeType)
		}
		fileServer.ServeHTTP(w, r)
	})
	router.PathPrefix(fullAssetsPath).Handler(http.StripPrefix(fullAssetsPath, handler))
}

func (c *Controller) registerDevProxy(router *mux.Router, fullAssetsPath string, dev *api.DevAssetConfig) {
	targetURL, _ := url.Parse(strings.TrimSpace(dev.TargetURL))
	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		if r.Context().Err() != nil {
			return
		}
		w.WriteHeader(http.StatusBadGateway)
	}
	origDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalHost := req.Host
		p := req.URL.Path
		if dev.StripPrefix == nil || *dev.StripPrefix {
			p = strings.TrimPrefix(p, fullAssetsPath)
			if p == "" {
				p = "/"
			}
			if !strings.HasPrefix(p, "/") {
				p = "/" + p
			}
		}
		req.URL.Path = p
		req.URL.RawPath = p
		origDirector(req)
		if req.Header.Get("X-Forwarded-Host") == "" && originalHost != "" {
			req.Header.Set("X-Forwarded-Host", originalHost)
		}
	}
	router.PathPrefix(fullAssetsPath).Handler(proxy)
}

func (c *Controller) buildAssetTags() (cssLinks, jsScripts string, err error) {
	if c.devAssets != nil {
		clientModule := strings.TrimSpace(c.devAssets.ClientModule)
		if clientModule == "" {
			clientModule = "/@vite/client"
		}
		entryModule := strings.TrimSpace(c.devAssets.EntryModule)
		if entryModule == "" {
			return "", "", fmt.Errorf("controller: %w: dev EntryModule is required", api.ErrInvalid)
		}
		var preamble string
		if ext := strings.ToLower(path.Ext(entryModule)); ext == ".tsx" || ext == ".jsx" {
			refreshSrc := joinURLPath(c.assetsBasePath, "/@react-refresh")
			preamble = fmt.Sprintf(`<script type="module">import { injectIntoGlobalHook } from "%s";injectIntoGlobalHook(window);window.$RefreshReg$ = () => {};window.$RefreshSig$ = () => (type) => type;</script>`, template.HTMLEscapeString(refreshSrc))
		}
		clientSrc := joinURLPath(c.assetsBasePath, clientModule)
		entrySrc := joinURLPath(c.assetsBasePath, entryModule)
		jsScripts = fmt.Sprintf(`%s<script type="module" src="%s"></script><script type="module" src="%s"></script>`, preamble, template.HTMLEscapeString(clientSrc), template.HTMLEscapeString(entrySrc))
		return "", jsScripts, nil
	}
	if c.resolvedAssets == nil {
		return "", "", fmt.Errorf("controller: %w: assets not resolved", api.ErrInternal)
	}
	return buildCSSLinks(c.resolvedAssets.CSSFiles), buildJSScripts(c.resolvedAssets.JSFiles), nil
}

func buildCSSLinks(cssFiles []string) string {
	var b strings.Builder
	for _, f := range cssFiles {
		b.WriteString(fmt.Sprintf(`<link rel="stylesheet" href="%s">`, template.HTMLEscapeString(f)))
	}
	return b.String()
}

func buildJSScripts(jsFiles []string) string {
	var b strings.Builder
	for _, f := range jsFiles {
		b.WriteString(fmt.Sprintf(`<script type="module" src="%s"></script>`, template.HTMLEscapeString(f)))
	}
	return b.String()
}

func joinURLPath(base string, p string) string {
	base = strings.TrimRight(base, "/")
	if base == "" {
		base = "/"
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	return base + p
}
