package api

import (
	"context"
	"net/http"

	"github.com/gorilla/mux"
)

// AppletRouter parses URL paths into RouteContext.
type AppletRouter interface {
	ParseRoute(r *http.Request, basePath string) RouteContext
}

// AppletController registers applet routes and serves the applet UI and RPC.
// Implementations are created by NewAppletController in the root package.
type AppletController interface {
	Register(router *mux.Router)
	RegisterRoutes(router *mux.Router)
	Key() string
}

// StreamWriter is the interface for SSE writing (implemented by internal/stream).
type StreamWriter interface {
	WriteEvent(event, data string) error
	WriteJSON(event string, data interface{}) error
	WriteDone() error
	WriteError(msg string) error
	WriteErrorJSON(data interface{}) error
	WriteComment(comment string) error
}

// StreamContextBuilder builds lightweight StreamContext for SSE endpoints (implemented by internal/stream).
type StreamContextBuilder interface {
	Build(ctx context.Context, r *http.Request) (*StreamContext, error)
}
