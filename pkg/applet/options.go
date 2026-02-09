package applet

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/text/language"
)

// BuilderOption is a functional option for configuring ContextBuilder
type BuilderOption func(*ContextBuilder)

// HostServices provides required context extraction methods from the host application.
// All methods are required except ExtractPool which may return nil if unavailable.
type HostServices interface {
	// ExtractUser extracts the current user from request context.
	ExtractUser(ctx context.Context) (AppletUser, error)

	// ExtractTenantID extracts the tenant ID from request context.
	ExtractTenantID(ctx context.Context) (uuid.UUID, error)

	// ExtractPool extracts the database pool from request context.
	// May return (nil, nil) if database access is unavailable.
	ExtractPool(ctx context.Context) (*pgxpool.Pool, error)

	// ExtractPageLocale extracts the page locale from request context.
	// Returns language.English if locale cannot be determined.
	ExtractPageLocale(ctx context.Context) language.Tag
}

// TenantNameResolver is a function that resolves a tenant ID to a tenant name.
// This allows applets to inject custom tenant name resolution logic.
type TenantNameResolver interface {
	ResolveTenantName(tenantID string) (string, error)
}


// WithTenantNameResolver sets a custom tenant name resolver for the ContextBuilder.
// If not set, uses fallback: resolver → database → "Tenant {short-uuid}"
func WithTenantNameResolver(resolver TenantNameResolver) BuilderOption {
	return func(b *ContextBuilder) {
		b.tenantNameResolver = resolver
	}
}

// WithErrorEnricher sets a custom error context enricher for the ContextBuilder.
// If not set, returns minimal error context with empty support email and no debug mode.
func WithErrorEnricher(enricher ErrorContextEnricher) BuilderOption {
	return func(b *ContextBuilder) {
		b.errorEnricher = enricher
	}
}

// WithSessionStore sets a custom session store for reading actual session expiry.
// If not set, uses configured SessionConfig.ExpiryDuration as default.
func WithSessionStore(store SessionStore) BuilderOption {
	return func(b *ContextBuilder) {
		b.sessionStore = store
	}
}
