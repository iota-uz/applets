package router

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/iota-uz/applets/internal/api"
)

// baseParseRoute extracts the route path (with basePath stripped) and
// first-value query parameters from the request. Shared by all router
// implementations.
func baseParseRoute(r *http.Request, basePath string) (routePath string, query map[string]string) {
	routePath = strings.TrimPrefix(r.URL.Path, basePath)
	if routePath == "" {
		routePath = "/"
	}
	query = make(map[string]string)
	for key, values := range r.URL.Query() {
		if len(values) > 0 {
			query[key] = values[0]
		}
	}
	return routePath, query
}

// DefaultRouter implements api.AppletRouter with no parameter extraction.
type DefaultRouter struct{}

func (d *DefaultRouter) ParseRoute(r *http.Request, basePath string) api.RouteContext {
	routePath, query := baseParseRoute(r, basePath)
	return api.RouteContext{
		Path:   routePath,
		Params: make(map[string]string),
		Query:  query,
	}
}

// NewDefaultRouter returns a new DefaultRouter.
func NewDefaultRouter() *DefaultRouter {
	return &DefaultRouter{}
}

// MuxRouter implements api.AppletRouter using gorilla/mux Vars().
type MuxRouter struct{}

func (m *MuxRouter) ParseRoute(r *http.Request, basePath string) api.RouteContext {
	routePath, query := baseParseRoute(r, basePath)
	params := mux.Vars(r)
	if params == nil {
		params = make(map[string]string)
	}
	return api.RouteContext{
		Path:   routePath,
		Params: params,
		Query:  query,
	}
}

// NewMuxRouter returns a new MuxRouter.
func NewMuxRouter() *MuxRouter {
	return &MuxRouter{}
}
