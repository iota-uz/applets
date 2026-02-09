package applet

import (
	"fmt"
	"net/http"
	"path"
	"strings"

	"github.com/gorilla/mux"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"github.com/sirupsen/logrus"
)

type AppletController struct {
	applet  Applet
	builder *ContextBuilder
	logger  *logrus.Logger

	assetsBasePath string
	resolvedAssets *ResolvedAssets

	devAssets *DevAssetConfig
}

func NewAppletController(
	applet Applet,
	bundle *i18n.Bundle,
	sessionConfig SessionConfig,
	logger *logrus.Logger,
	metrics MetricsRecorder,
	host HostServices,
	opts ...BuilderOption,
) (*AppletController, error) {
	if applet == nil {
		return nil, fmt.Errorf("NewAppletController: applet is nil: %w", ErrInvalid)
	}
	if err := ValidateAppletName(applet.Name()); err != nil {
		return nil, fmt.Errorf("NewAppletController: %w: %s", ErrValidation, err.Error())
	}
	if err := ValidateConfig(applet.Config()); err != nil {
		return nil, fmt.Errorf("NewAppletController: %w: %s", ErrValidation, err.Error())
	}

	config := applet.Config()
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, host, opts...)

	c := &AppletController{
		applet:  applet,
		builder: builder,
		logger:  logger,
	}
	if err := c.initAssets(); err != nil {
		return nil, fmt.Errorf("NewAppletController: %w", err)
	}
	return c, nil
}

func (c *AppletController) Register(router *mux.Router) {
	c.RegisterRoutes(router)
}

func (c *AppletController) Key() string {
	return "applet_" + c.applet.Name()
}

func (c *AppletController) RegisterRoutes(router *mux.Router) {
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
		for _, middleware := range config.Middleware {
			appletRouter.Use(middleware)
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
