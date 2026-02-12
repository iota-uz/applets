// Package api defines the public types and interfaces for the applets library.
// Implementation lives in other internal packages; the root package re-exports these.
package api

import (
	"context"
	"encoding/json"
	"io/fs"

	"github.com/a-h/templ"
	"github.com/gorilla/mux"
)

// Applet represents a React/Next.js application that integrates with the host runtime.
type Applet interface {
	Name() string
	BasePath() string
	Config() Config
}

// ShellMode is the rendering mode for the applet shell.
type ShellMode string

const (
	ShellModeEmbedded   ShellMode = "embedded"
	ShellModeStandalone ShellMode = "standalone"
)

// ShellConfig configures the applet shell (embedded vs standalone).
type ShellConfig struct {
	Mode   ShellMode
	Layout LayoutFactory
	Title  string
}

// TranslationMode controls which translations are included in context.
type TranslationMode string

const (
	TranslationModeAll      TranslationMode = "all"
	TranslationModePrefixes TranslationMode = "prefixes"
	TranslationModeNone     TranslationMode = "none"
)

// I18nConfig configures i18n for the applet context.
type I18nConfig struct {
	Mode         TranslationMode
	Prefixes     []string
	RequiredKeys []string
}

// Config holds all configuration for integrating an applet with the host.
type Config struct {
	WindowGlobal  string
	Endpoints     EndpointConfig
	Assets        AssetConfig
	Shell         ShellConfig
	Router        AppletRouter
	I18n          I18nConfig
	Hosts         []string
	RoutePatterns []string
	CustomContext ContextExtender
	Middleware    []mux.MiddlewareFunc
	Mount         MountConfig
	RPC           *RPCConfig
}

// LayoutFactory produces a layout component for an applet request.
type LayoutFactory func(title string) templ.Component

// MountConfig describes the DOM element the frontend mounts into.
type MountConfig struct {
	Tag        string
	ID         string
	Attributes map[string]string
}

// EndpointConfig contains URL paths for applet API endpoints.
type EndpointConfig struct {
	GraphQL string
	Stream  string
	REST    string
}

// AssetConfig configures serving of applet static assets.
type AssetConfig struct {
	FS           fs.FS
	BasePath     string
	ManifestPath string
	Entrypoint   string
	Dev          *DevAssetConfig
}

// DevAssetConfig configures the dev proxy for local frontend development.
type DevAssetConfig struct {
	Enabled      bool
	TargetURL    string
	EntryModule  string
	ClientModule string
}

// RPCConfig configures the applet RPC endpoint.
type RPCConfig struct {
	Path                 string
	ExposeInternalErrors *bool
	MaxBodyBytes         int64
	Methods              map[string]RPCMethod
}

// RPCMethod describes a single RPC method (used internally when building from TypedRPCRouter).
type RPCMethod struct {
	RequirePermissions []string
	Handler            func(ctx context.Context, params json.RawMessage) (any, error)
}

// ContextExtender adds custom fields to InitialContext.Extensions.
type ContextExtender func(ctx context.Context) (map[string]interface{}, error)
