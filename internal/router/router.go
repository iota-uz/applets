package router

import (
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/iota-uz/applets/internal/api"
)

// DefaultRouter implements api.AppletRouter with no parameter extraction.
type DefaultRouter struct{}

func (d *DefaultRouter) ParseRoute(r *http.Request, basePath string) api.RouteContext {
	fullPath := r.URL.Path
	routePath := strings.TrimPrefix(fullPath, basePath)
	if routePath == "" {
		routePath = "/"
	}
	queryParams := make(map[string]string)
	for key, values := range r.URL.Query() {
		if len(values) > 0 {
			queryParams[key] = values[0]
		}
	}
	return api.RouteContext{
		Path:   routePath,
		Params: make(map[string]string),
		Query:  queryParams,
	}
}

// NewDefaultRouter returns a new DefaultRouter.
func NewDefaultRouter() *DefaultRouter {
	return &DefaultRouter{}
}

// MuxRouter implements api.AppletRouter using gorilla/mux Vars().
type MuxRouter struct{}

func (m *MuxRouter) ParseRoute(r *http.Request, basePath string) api.RouteContext {
	fullPath := r.URL.Path
	routePath := strings.TrimPrefix(fullPath, basePath)
	if routePath == "" {
		routePath = "/"
	}
	params := mux.Vars(r)
	if params == nil {
		params = make(map[string]string)
	}
	queryParams := make(map[string]string)
	for key, values := range r.URL.Query() {
		if len(values) > 0 {
			queryParams[key] = values[0]
		}
	}
	return api.RouteContext{
		Path:   routePath,
		Params: params,
		Query:  queryParams,
	}
}

// NewMuxRouter returns a new MuxRouter.
func NewMuxRouter() *MuxRouter {
	return &MuxRouter{}
}
