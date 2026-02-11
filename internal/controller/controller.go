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
	appletRouter := router.PathPrefix(c.applet.BasePath()).Subrouter()
	if config.Middleware != nil {
		for _, mw := range config.Middleware {
			appletRouter.Use(mw)
		}
	}
	if config.RPC != nil {
		rpcPath := strings.TrimSpace(config.RPC.Path)
		if rpcPath == "" {
			rpcPath = "/rpc"
		}
		if !strings.HasPrefix(rpcPath, "/") {
			rpcPath = "/" + rpcPath
		}
		appletRouter.HandleFunc(rpcPath, c.handleRPC).Methods(http.MethodPost)
	}
	for _, p := range config.RoutePatterns {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		appletRouter.HandleFunc(p, c.RenderApp).Methods(http.MethodGet, http.MethodHead)
	}
	appletRouter.HandleFunc("", c.RenderApp).Methods(http.MethodGet, http.MethodHead)
	appletRouter.HandleFunc("/", c.RenderApp).Methods(http.MethodGet, http.MethodHead)
	appletRouter.PathPrefix("/").HandlerFunc(c.RenderApp).Methods(http.MethodGet, http.MethodHead)
}
