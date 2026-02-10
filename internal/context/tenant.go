package context

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func (b *ContextBuilder) getTenantName(ctx context.Context, tenantID uuid.UUID) string {
	tenantIDStr := tenantID.String()
	if b.tenantNameResolver != nil {
		name, err := b.tenantNameResolver.ResolveTenantName(tenantIDStr)
		if err == nil && name != "" {
			return name
		}
		if b.logger != nil {
			b.logger.WithError(err).WithField("tenant_id", tenantIDStr).Warn("Tenant resolver failed, trying database")
		}
	}
	pool, err := b.host.ExtractPool(ctx)
	if err == nil && pool != nil {
		if name := queryTenantNameFromDB(ctx, pool, tenantID); name != "" {
			return name
		}
		if b.logger != nil {
			b.logger.WithField("tenant_id", tenantIDStr).Warn("Database tenant query failed, using fallback")
		}
	}
	if len(tenantIDStr) >= 8 {
		return fmt.Sprintf("Tenant %s", tenantIDStr[:8])
	}
	return fmt.Sprintf("Tenant %s", tenantIDStr)
}

func queryTenantNameFromDB(ctx context.Context, pool *pgxpool.Pool, tenantID uuid.UUID) string {
	const query = "SELECT name FROM tenants WHERE id = $1"
	var name string
	if err := pool.QueryRow(ctx, query, tenantID).Scan(&name); err != nil {
		return ""
	}
	return name
}
