package controller

import (
	"fmt"
	"net/http"
	"path"
	"strings"

	"github.com/gorilla/mux"
	"github.com/iota-uz/applets/internal/api"
	"github.com/iota-uz/applets/internal/context"
	"github.com/iota-uz/applets/internal/validate"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"github.com/sirupsen/logrus"
)

// Controller implements api.AppletController.
type Controller struct {
	applet         api.Applet
	builder        *context.ContextBuilder
	logger         *logrus.Logger
	host           api.HostServices
	assetsBasePath string
	resolvedAssets *api.ResolvedAssets
	devAssets      *api.DevAssetConfig
}

var _ api.AppletController = (*Controller)(nil)

// New creates a new Controller for the given applet.
func New(
	applet api.Applet,
	bundle *i18n.Bundle,
	sessionConfig api.SessionConfig,
	logger *logrus.Logger,
	metrics api.MetricsRecorder,
	host api.HostServices,
	opts ...api.BuilderOption,
) (*Controller, error) {
	if applet == nil {
		return nil, fmt.Errorf("controller: applet is nil: %w", api.ErrInvalid)
	}
	if err := validate.AppletName(applet.Name()); err != nil {
		return nil, fmt.Errorf("controller: %w: %s", api.ErrValidation, err.Error())
	}
	if err := validate.Config(applet.Config()); err != nil {
		return nil, fmt.Errorf("controller: %w: %s", api.ErrValidation, err.Error())
	}
	if logger == nil {
		logger = logrus.StandardLogger()
	}
	cfg := applet.Config()
	builder := context.NewContextBuilder(cfg, bundle, sessionConfig, logger, metrics, host, opts...)
	c := &Controller{
		applet:  applet,
		builder: builder,
		logger:  logger,
		host:    host,
	}
	if err := c.initAssets(); err != nil {
		return nil, fmt.Errorf("controller: %w", err)
	}
	return c, nil
}

func (c *Controller) Register(router *mux.Router) {
	c.RegisterRoutes(router)
}

func (c *Controller) Key() string {
	return "applet_" + c.applet.Name()
}

func (c *Controller) RegisterRoutes(router *mux.Router) {
	config := c.applet.Config()
	if config.Assets.BasePath == "" {
		config.Assets.BasePath = "/assets"
	}
	if !strings.HasPrefix(config.Assets.BasePath, "/") {
		config.Assets.BasePath = "/" + config.Assets.BasePath
	}
	fullAssetsPath := path.Join(c.applet.BasePath(), config.Assets.BasePath)
	if c.devAssets != nil || config.Assets.FS != nil {
		c.registerAssetRoutes(router, fullAssetsPath)
	}
	excludedPrefixes := appRouteExcludedPrefixes(c.applet.BasePath(), config)
	pathRouter := router.PathPrefix(c.applet.BasePath()).Subrouter()
	c.applyMiddleware(pathRouter, config.Middleware)
	c.registerAppRoutes(pathRouter, config.RoutePatterns, excludedPrefixes)

	for _, host := range config.Hosts {
		host = strings.TrimSpace(host)
		if host == "" {
			continue
		}
		hostRouter := router.Host(host).Subrouter()
		if c.devAssets != nil || config.Assets.FS != nil {
			c.registerAssetRoutes(hostRouter, config.Assets.BasePath)
		}
		c.applyMiddleware(hostRouter, config.Middleware)
		c.registerAppRoutes(hostRouter, config.RoutePatterns, excludedPrefixes)
	}
}

func (c *Controller) applyMiddleware(router *mux.Router, middleware []mux.MiddlewareFunc) {
	for _, mw := range middleware {
		router.Use(mw)
	}
}

func (c *Controller) registerAppRoutes(router *mux.Router, routePatterns []string, excludedPrefixes []string) {
	for _, p := range routePatterns {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		router.HandleFunc(p, c.RenderApp).Methods(http.MethodGet, http.MethodHead)
	}
	router.HandleFunc("", c.RenderApp).Methods(http.MethodGet, http.MethodHead)
	router.HandleFunc("/", c.RenderApp).Methods(http.MethodGet, http.MethodHead)
	router.MatcherFunc(func(r *http.Request, _ *mux.RouteMatch) bool {
		return shouldRenderAppRoute(r.URL.Path, excludedPrefixes)
	}).HandlerFunc(c.RenderApp).Methods(http.MethodGet, http.MethodHead)
}

func appRouteExcludedPrefixes(basePath string, config api.Config) []string {
	candidates := []string{
		config.Assets.BasePath,
		config.Endpoints.GraphQL,
		config.Endpoints.Stream,
		config.Endpoints.REST,
	}
	if config.RPC != nil {
		candidates = append(candidates, config.RPC.Path)
	}

	seen := make(map[string]struct{}, len(candidates)*2)
	excluded := make([]string, 0, len(candidates)*2)
	for _, candidate := range candidates {
		for _, prefix := range normalizeExcludedRoutePrefixes(basePath, candidate) {
			if prefix == "" {
				continue
			}
			if _, exists := seen[prefix]; exists {
				continue
			}
			seen[prefix] = struct{}{}
			excluded = append(excluded, prefix)
		}
	}

	return excluded
}

func normalizeExcludedRoutePrefixes(basePath, raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}

	basePath = strings.TrimSpace(basePath)
	if basePath == "" {
		basePath = "/"
	}
	if !strings.HasPrefix(basePath, "/") {
		basePath = "/" + basePath
	}
	basePath = path.Clean(basePath)
	absolute := path.Clean(raw)

	prefixes := make([]string, 0, 2)
	prefixes = append(prefixes, absolute)

	if absolute == basePath {
		prefixes = append(prefixes, "/")
		return prefixes
	}

	if strings.HasPrefix(absolute, basePath+"/") {
		relative := strings.TrimPrefix(absolute, basePath)
		if relative == "" {
			relative = "/"
		}
		prefixes = append(prefixes, path.Clean(relative))
	}

	return prefixes
}

func shouldRenderAppRoute(requestPath string, excludedPrefixes []string) bool {
	cleanPath := path.Clean("/" + strings.TrimPrefix(strings.TrimSpace(requestPath), "/"))
	for _, prefix := range excludedPrefixes {
		if pathHasPrefix(cleanPath, prefix) {
			return false
		}
	}
	return true
}

func pathHasPrefix(requestPath, prefix string) bool {
	if prefix == "" {
		return false
	}
	if prefix == "/" {
		return requestPath == "/"
	}
	return requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/")
}
