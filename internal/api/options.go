package api

// WithTenantNameResolver sets a custom tenant name resolver for the context builder.
func WithTenantNameResolver(resolver TenantNameResolver) BuilderOption {
	return func(c ContextBuilderConfigurator) {
		c.SetTenantNameResolver(resolver)
	}
}

// WithErrorEnricher sets a custom error context enricher.
func WithErrorEnricher(enricher ErrorContextEnricher) BuilderOption {
	return func(c ContextBuilderConfigurator) {
		c.SetErrorEnricher(enricher)
	}
}

// WithSessionStore sets a custom session store for reading session expiry.
func WithSessionStore(store SessionStore) BuilderOption {
	return func(c ContextBuilderConfigurator) {
		c.SetSessionStore(store)
	}
}
