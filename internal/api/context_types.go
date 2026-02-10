package api

import "time"

// InitialContext is serialized and injected into the frontend (e.g. window.__BICHAT_CONTEXT__).
type InitialContext struct {
	User       UserContext
	Tenant     TenantContext
	Locale     LocaleContext
	Config     AppConfig
	Route      RouteContext
	Session    SessionContext
	Error      *ErrorContext
	Extensions map[string]interface{}
}

// UserContext contains user information for the frontend.
type UserContext struct {
	ID          int64
	Email       string
	FirstName   string
	LastName    string
	Permissions []string
}

// TenantContext contains tenant information.
type TenantContext struct {
	ID   string
	Name string
}

// LocaleContext contains locale and translation data.
type LocaleContext struct {
	Language     string
	Translations map[string]string
}

// AppConfig contains application config passed to the frontend.
type AppConfig struct {
	GraphQLEndpoint string `json:"graphQLEndpoint,omitempty"`
	StreamEndpoint  string `json:"streamEndpoint,omitempty"`
	RESTEndpoint    string `json:"restEndpoint,omitempty"`
	BasePath        string `json:"basePath,omitempty"`
	AssetsBasePath  string `json:"assetsBasePath,omitempty"`
	RPCUIEndpoint   string `json:"rpcUIEndpoint,omitempty"`
	ShellMode       string `json:"shellMode,omitempty"`
}

// RouteContext contains URL routing information.
type RouteContext struct {
	Path   string
	Params map[string]string
	Query  map[string]string
}

// SessionContext contains session/CSRF info for the frontend.
type SessionContext struct {
	ExpiresAt  int64
	RefreshURL string
	CSRFToken  string
}

// ErrorContext provides error handling metadata for frontend error boundaries.
type ErrorContext struct {
	SupportEmail string
	DebugMode   bool
	ErrorCodes  map[string]string
	RetryConfig *RetryConfig
}

// RetryConfig configures frontend retry behavior.
type RetryConfig struct {
	MaxAttempts int
	BackoffMs   int64
}

// StreamContext is a lightweight context for SSE streaming endpoints.
type StreamContext struct {
	UserID      int64
	TenantID    string
	Permissions []string
	CSRFToken   string
	Session     SessionContext
	Extensions  map[string]interface{}
}

// SessionConfig configures session expiry and refresh.
type SessionConfig struct {
	ExpiryDuration time.Duration
	RefreshURL     string
	RenewBefore    time.Duration
}

// DefaultSessionConfig provides sensible defaults for SessionConfig.
var DefaultSessionConfig = SessionConfig{
	ExpiryDuration: 24 * time.Hour,
	RefreshURL:     "/auth/refresh",
	RenewBefore:    5 * time.Minute,
}
