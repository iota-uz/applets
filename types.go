// Package applets: public types re-exported from internal/api and internal/rpc.
package applets

import (
	"github.com/iota-uz/applets/internal/api"
	"github.com/iota-uz/applets/internal/rpc"
)

type (
	Applet          = api.Applet
	ShellMode       = api.ShellMode
	ShellConfig     = api.ShellConfig
	Config          = api.Config
	LayoutFactory   = api.LayoutFactory
	MountConfig     = api.MountConfig
	EndpointConfig  = api.EndpointConfig
	AssetConfig     = api.AssetConfig
	DevAssetConfig  = api.DevAssetConfig
	RPCConfig       = api.RPCConfig
	RPCMethod       = api.RPCMethod
	ContextExtender = api.ContextExtender
)

type (
	TranslationMode = api.TranslationMode
	I18nConfig      = api.I18nConfig
)

type (
	InitialContext = api.InitialContext
	UserContext    = api.UserContext
	TenantContext  = api.TenantContext
	LocaleContext  = api.LocaleContext
	AppConfig      = api.AppConfig
	RouteContext   = api.RouteContext
	SessionContext = api.SessionContext
	ErrorContext   = api.ErrorContext
	RetryConfig    = api.RetryConfig
	StreamContext  = api.StreamContext
	SessionConfig  = api.SessionConfig
)

type (
	ErrorContextEnricher = api.ErrorContextEnricher
	MetricsRecorder      = api.MetricsRecorder
	SessionStore         = api.SessionStore
	HostServices         = api.HostServices
	TenantNameResolver   = api.TenantNameResolver
	BuilderOption        = api.BuilderOption
)

type (
	AppletUser     = api.AppletUser
	DetailedUser   = api.DetailedUser
	ContextBuilder = api.ContextBuilder
)

type (
	ViteManifest      = api.ViteManifest
	ViteManifestEntry = api.ViteManifestEntry
	ResolvedAssets    = api.ResolvedAssets
)

type (
	AppletRouter     = api.AppletRouter
	AppletController = api.AppletController
)

type (
	Procedure[P any, R any] = api.Procedure[P, R]
	TypedRPCRouter          = rpc.TypedRPCRouter
	TypedRouterDescription  = api.TypedRouterDescription
	TypedMethodDescription  = api.TypedMethodDescription
	TypedTypeObject         = api.TypedTypeObject
	TypedField              = api.TypedField
	TypeRef                 = api.TypeRef
)

type (
	Registry             = api.Registry
	StreamWriter         = api.StreamWriter
	StreamContextBuilder = api.StreamContextBuilder
)

const (
	ShellModeEmbedded   = api.ShellModeEmbedded
	ShellModeStandalone = api.ShellModeStandalone
)

const (
	TranslationModeAll      = api.TranslationModeAll
	TranslationModePrefixes = api.TranslationModePrefixes
	TranslationModeNone     = api.TranslationModeNone
)

var (
	ErrInvalid           = api.ErrInvalid
	ErrValidation        = api.ErrValidation
	ErrNotFound          = api.ErrNotFound
	ErrPermissionDenied  = api.ErrPermissionDenied
	ErrInternal          = api.ErrInternal
	DefaultSessionConfig = api.DefaultSessionConfig
)
