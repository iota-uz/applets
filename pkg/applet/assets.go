package applet

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
)

var mimeTypes = map[string]string{
	".js":    "application/javascript; charset=utf-8",
	".css":   "text/css; charset=utf-8",
	".json":  "application/json; charset=utf-8",
	".svg":   "image/svg+xml",
	".png":   "image/png",
	".jpg":   "image/jpeg",
	".jpeg":  "image/jpeg",
	".gif":   "image/gif",
	".woff":  "font/woff",
	".woff2": "font/woff2",
}

func (c *AppletController) initAssets() error {
	const op = "applet.Controller.initAssets"

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

	// ValidateConfig already checked FS/ManifestPath/Entrypoint, so these are safe to use.
	manifest, err := loadManifest(config.Assets.FS, config.Assets.ManifestPath)
	if err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}
	resolved, err := resolveAssetsFromManifest(manifest, config.Assets.Entrypoint, c.assetsBasePath)
	if err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}
	c.resolvedAssets = resolved
	return nil
}

func (c *AppletController) registerAssetRoutes(router *mux.Router, fullAssetsPath string) {
	config := c.applet.Config()

	if c.devAssets != nil {
		c.registerDevProxy(router, fullAssetsPath, c.devAssets)
		return
	}

	fileServer := http.FileServer(http.FS(config.Assets.FS))
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if mimeType, ok := mimeTypes[filepath.Ext(r.URL.Path)]; ok {
			w.Header().Set("Content-Type", mimeType)
		}
		fileServer.ServeHTTP(w, r)
	})

	router.PathPrefix(fullAssetsPath).Handler(
		http.StripPrefix(fullAssetsPath, handler),
	)
}

func (c *AppletController) registerDevProxy(router *mux.Router, fullAssetsPath string, dev *DevAssetConfig) {
	// TargetURL already validated by ValidateConfig; parse is safe.
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

func (c *AppletController) buildAssetTags() (string, string, error) {
	const op = "applet.Controller.buildAssetTags"

	if c.devAssets != nil {
		clientModule := strings.TrimSpace(c.devAssets.ClientModule)
		if clientModule == "" {
			clientModule = "/@vite/client"
		}
		entryModule := strings.TrimSpace(c.devAssets.EntryModule)
		if entryModule == "" {
			return "", "", fmt.Errorf("%s: %w: assets dev proxy EntryModule is required", op, ErrInvalid)
		}

		var preamble string
		if looksLikeReactEntrypoint(entryModule) {
			refreshSrc := joinURLPath(c.assetsBasePath, "/@react-refresh")
			preamble = fmt.Sprintf(
				`<script type="module">import { injectIntoGlobalHook } from "%s";injectIntoGlobalHook(window);window.$RefreshReg$ = () => {};window.$RefreshSig$ = () => (type) => type;</script>`,
				template.HTMLEscapeString(refreshSrc),
			)
		}

		clientSrc := joinURLPath(c.assetsBasePath, clientModule)
		entrySrc := joinURLPath(c.assetsBasePath, entryModule)
		js := fmt.Sprintf(
			`%s<script type="module" src="%s"></script><script type="module" src="%s"></script>`,
			preamble,
			template.HTMLEscapeString(clientSrc),
			template.HTMLEscapeString(entrySrc),
		)
		return "", js, nil
	}

	if c.resolvedAssets == nil {
		return "", "", fmt.Errorf("%s: %w: assets not resolved", op, ErrInternal)
	}
	return buildCSSLinks(c.resolvedAssets.CSSFiles), buildJSScripts(c.resolvedAssets.JSFiles), nil
}

func looksLikeReactEntrypoint(entryModule string) bool {
	switch strings.ToLower(path.Ext(entryModule)) {
	case ".tsx", ".jsx":
		return true
	default:
		return false
	}
}

func buildCSSLinks(cssFiles []string) string {
	if len(cssFiles) == 0 {
		return ""
	}

	var links strings.Builder
	for _, cssFile := range cssFiles {
		links.WriteString(fmt.Sprintf(`<link rel="stylesheet" href="%s">`, template.HTMLEscapeString(cssFile)))
	}
	return links.String()
}

func buildJSScripts(jsFiles []string) string {
	if len(jsFiles) == 0 {
		return ""
	}

	var scripts strings.Builder
	for _, jsFile := range jsFiles {
		scripts.WriteString(fmt.Sprintf(`<script type="module" src="%s"></script>`, template.HTMLEscapeString(jsFile)))
	}
	return scripts.String()
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
