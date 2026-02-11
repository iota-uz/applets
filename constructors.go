package applets

import (
	"net/http"

	"github.com/iota-uz/applets/internal/context"
	"github.com/iota-uz/applets/internal/controller"
	"github.com/iota-uz/applets/internal/registry"
	"github.com/iota-uz/applets/internal/router"
	"github.com/iota-uz/applets/internal/rpc"
	"github.com/iota-uz/applets/internal/stream"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"github.com/sirupsen/logrus"
)

func NewAppletController(
	applet Applet,
	bundle *i18n.Bundle,
	sessionConfig SessionConfig,
	logger *logrus.Logger,
	metrics MetricsRecorder,
	host HostServices,
	opts ...BuilderOption,
) (AppletController, error) {
	return controller.New(applet, bundle, sessionConfig, logger, metrics, host, opts...)
}

func NewContextBuilder(
	config Config,
	bundle *i18n.Bundle,
	sessionConfig SessionConfig,
	logger *logrus.Logger,
	metrics MetricsRecorder,
	host HostServices,
	opts ...BuilderOption,
) ContextBuilder {
	return context.NewContextBuilder(config, bundle, sessionConfig, logger, metrics, host, opts...)
}

func NewStreamWriter(w http.ResponseWriter) (StreamWriter, error) {
	return stream.NewStreamWriter(w)
}

func NewStreamContextBuilder(
	config Config,
	sessionConfig SessionConfig,
	logger *logrus.Logger,
	host HostServices,
) StreamContextBuilder {
	return stream.NewStreamContextBuilder(config, sessionConfig, logger, host)
}

func NewTypedRPCRouter() *TypedRPCRouter {
	return rpc.NewTypedRPCRouter()
}

func AddProcedure[P any, R any](r *TypedRPCRouter, name string, p Procedure[P, R]) error {
	return rpc.AddProcedure(r, name, p)
}

func DescribeTypedRPCRouter(r *TypedRPCRouter) (*TypedRouterDescription, error) {
	return rpc.DescribeTypedRPCRouter(r)
}

func NewDefaultRouter() AppletRouter {
	return router.NewDefaultRouter()
}

func NewMuxRouter() AppletRouter {
	return router.NewMuxRouter()
}

func NewRegistry() Registry {
	return registry.New()
}
