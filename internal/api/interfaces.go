package api

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/text/language"
)

// ErrorContextEnricher enriches error context for frontend error boundaries.
type ErrorContextEnricher interface {
	EnrichContext(ctx context.Context, r *http.Request) (*ErrorContext, error)
}

// MetricsRecorder records metrics for context building operations.
type MetricsRecorder interface {
	RecordDuration(name string, duration time.Duration, labels map[string]string)
	IncrementCounter(name string, labels map[string]string)
}

// SessionStore reads session expiry from the session backend.
type SessionStore interface {
	GetSessionExpiry(r *http.Request) time.Time
}

// HostServices provides context extraction from the host application.
type HostServices interface {
	ExtractUser(ctx context.Context) (AppletUser, error)
	ExtractTenantID(ctx context.Context) (uuid.UUID, error)
	ExtractPool(ctx context.Context) (*pgxpool.Pool, error)
	ExtractPageLocale(ctx context.Context) language.Tag
}

// TenantNameResolver resolves a tenant ID to a tenant name.
type TenantNameResolver interface {
	ResolveTenantName(tenantID string) (string, error)
}

// ContextBuilderConfigurator is implemented by the context builder for optional configuration.
// Used by WithTenantNameResolver, WithErrorEnricher, WithSessionStore.
type ContextBuilderConfigurator interface {
	SetTenantNameResolver(TenantNameResolver)
	SetErrorEnricher(ErrorContextEnricher)
	SetSessionStore(SessionStore)
}

// BuilderOption configures a context builder (e.g. WithTenantNameResolver).
type BuilderOption func(ContextBuilderConfigurator)

// ContextBuilder builds InitialContext for applets (implemented by internal/context).
type ContextBuilder interface {
	Build(ctx context.Context, r *http.Request, basePath string) (*InitialContext, error)
}
