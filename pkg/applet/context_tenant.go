package applet

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// getTenantName returns the tenant name using multi-layer fallback:
// 1. Try TenantNameResolver (if provided via WithTenantNameResolver)
// 2. Try direct database query (if pool extractor available)
// 3. Fall back to "Tenant {short-uuid}" format (first 8 chars)
func (b *ContextBuilder) getTenantName(ctx context.Context, tenantID uuid.UUID) string {
	tenantIDStr := tenantID.String()

	// Layer 1: Custom resolver
	if b.tenantNameResolver != nil {
		name, err := b.tenantNameResolver.ResolveTenantName(tenantIDStr)
		if err == nil && name != "" {
			return name
		}
		if b.logger != nil {
			b.logger.WithError(err).WithField("tenant_id", tenantIDStr).Warn("Tenant resolver failed, trying database")
		}
	}

	// Layer 2: Direct database query
	pool, err := b.host.ExtractPool(ctx)
	if err == nil && pool != nil {
		name := queryTenantNameFromDB(ctx, pool, tenantID)
		if name != "" {
			return name
		}
		if b.logger != nil {
			b.logger.WithField("tenant_id", tenantIDStr).Warn("Database tenant query failed, using fallback")
		}
	}

	// Layer 3: Default format with short UUID (first 8 chars)
	return fmt.Sprintf("Tenant %s", tenantIDStr[:8])
}

// queryTenantNameFromDB queries tenant name directly from database.
// Returns empty string on error (caller will use fallback).
func queryTenantNameFromDB(ctx context.Context, pool *pgxpool.Pool, tenantID uuid.UUID) string {
	const query = "SELECT name FROM tenants WHERE id = $1"
	var name string
	if err := pool.QueryRow(ctx, query, tenantID).Scan(&name); err != nil {
		return ""
	}
	return name
}
