package api

import (
	"fmt"
	"time"
)

// InitialContext is serialized and injected into the frontend (e.g. window.__APPLET_CONTEXT__).
type InitialContext struct {
	User       UserContext            `json:"user"`
	Tenant     TenantContext          `json:"tenant"`
	Locale     LocaleContext          `json:"locale"`
	Config     AppConfig              `json:"config"`
	Route      RouteContext           `json:"route"`
	Session    SessionContext         `json:"session"`
	Error      *ErrorContext          `json:"error,omitempty"`
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// UserContext contains user information for the frontend.
type UserContext struct {
	ID          int64    `json:"id"`
	Email       string   `json:"email"`
	FirstName   string   `json:"firstName"`
	LastName    string   `json:"lastName"`
	Permissions []string `json:"permissions"`
}

// TenantContext contains tenant information.
type TenantContext struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// LocaleContext contains locale and translation data.
type LocaleContext struct {
	Language     string            `json:"language"`
	Translations map[string]string `json:"translations"`
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
	Path   string            `json:"path"`
	Params map[string]string `json:"params"`
	Query  map[string]string `json:"query"`
}

// SessionContext contains session/CSRF info for the frontend.
type SessionContext struct {
	ExpiresAt  int64  `json:"expiresAt"`
	RefreshURL string `json:"refreshURL"`
	CSRFToken  string `json:"csrfToken"`
}

// ErrorContext provides error handling metadata for frontend error boundaries.
type ErrorContext struct {
	SupportEmail string            `json:"supportEmail"`
	DebugMode    bool              `json:"debugMode"`
	ErrorCodes   map[string]string `json:"errorCodes,omitempty"`
	RetryConfig  *RetryConfig      `json:"retryConfig,omitempty"`
}

// RetryConfig configures frontend retry behavior.
type RetryConfig struct {
	MaxAttempts int   `json:"maxAttempts"`
	BackoffMs   int64 `json:"backoffMs"`
}

// StreamContext is a lightweight context for SSE streaming endpoints.
type StreamContext struct {
	UserID      int64                  `json:"userID"`
	TenantID    string                 `json:"tenantID"`
	Permissions []string               `json:"permissions"`
	CSRFToken   string                 `json:"csrfToken"`
	Session     SessionContext         `json:"session"`
	Extensions  map[string]interface{} `json:"extensions,omitempty"`
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

// Validate checks the InitialContext contract before JSON serialization.
// It returns an error if any required field is missing or if a slice/map
// would serialize as null instead of an empty collection.
func (c *InitialContext) Validate() error {
	if c.User.Permissions == nil {
		return fmt.Errorf("InitialContext.User.Permissions must not be nil (use []string{} for no permissions)")
	}
	if c.Locale.Language == "" {
		return fmt.Errorf("InitialContext.Locale.Language must not be empty")
	}
	if c.Config.BasePath == "" {
		return fmt.Errorf("InitialContext.Config.BasePath must not be empty")
	}
	return nil
}
