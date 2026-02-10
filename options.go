package applets

import "github.com/iota-uz/applets/internal/api"

func WithTenantNameResolver(resolver TenantNameResolver) BuilderOption {
	return api.WithTenantNameResolver(resolver)
}

func WithErrorEnricher(enricher ErrorContextEnricher) BuilderOption {
	return api.WithErrorEnricher(enricher)
}

func WithSessionStore(store SessionStore) BuilderOption {
	return api.WithSessionStore(store)
}
