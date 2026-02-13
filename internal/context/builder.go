package context

import (
	"context"
	"fmt"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/csrf"
	"github.com/iota-uz/applets/internal/api"
	"github.com/iota-uz/applets/internal/router"
	"github.com/iota-uz/applets/internal/security"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"github.com/sirupsen/logrus"
)

// ContextBuilder builds InitialContext for applets.
type ContextBuilder struct {
	config             api.Config
	bundle             *i18n.Bundle
	sessionConfig      api.SessionConfig
	logger             *logrus.Logger
	metrics            api.MetricsRecorder
	host               api.HostServices
	tenantNameResolver api.TenantNameResolver
	errorEnricher      api.ErrorContextEnricher
	sessionStore       api.SessionStore

	translationsMu    sync.RWMutex
	translationsCache map[string]map[string]string
}

// Ensure ContextBuilder implements api.ContextBuilderConfigurator.
var _ api.ContextBuilderConfigurator = (*ContextBuilder)(nil)

func (b *ContextBuilder) SetTenantNameResolver(r api.TenantNameResolver) { b.tenantNameResolver = r }
func (b *ContextBuilder) SetErrorEnricher(e api.ErrorContextEnricher)    { b.errorEnricher = e }
func (b *ContextBuilder) SetSessionStore(s api.SessionStore)             { b.sessionStore = s }

// NewContextBuilder creates a new ContextBuilder.
func NewContextBuilder(
	config api.Config,
	bundle *i18n.Bundle,
	sessionConfig api.SessionConfig,
	logger *logrus.Logger,
	metrics api.MetricsRecorder,
	host api.HostServices,
	opts ...api.BuilderOption,
) *ContextBuilder {
	b := &ContextBuilder{
		config:            config,
		bundle:            bundle,
		sessionConfig:     sessionConfig,
		logger:            logger,
		metrics:           metrics,
		host:              host,
		translationsCache: make(map[string]map[string]string),
	}
	for _, opt := range opts {
		opt(b)
	}
	return b
}

// Build builds the InitialContext for the frontend.
func (b *ContextBuilder) Build(ctx context.Context, r *http.Request, basePath string) (*api.InitialContext, error) {
	const op = "ContextBuilder.Build"
	start := time.Now()

	user, err := b.host.ExtractUser(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).Error("Failed to extract user for applet context")
		}
		return nil, fmt.Errorf("%s: %w: user extraction failed: %w", op, api.ErrInternal, err)
	}

	tenantID, err := b.host.ExtractTenantID(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).WithField("user_id", user.ID()).Error("Failed to extract tenant ID")
		}
		return nil, fmt.Errorf("%s: %w: tenant extraction failed: %w", op, api.ErrInternal, err)
	}

	userLocale := b.host.ExtractPageLocale(ctx)
	permissions := security.CollectUserPermissionNames(user)
	translations := b.getAllTranslations(userLocale)
	tenantName := b.getTenantName(ctx, tenantID)
	routeRouter := b.config.Router
	if routeRouter == nil {
		routeRouter = router.NewDefaultRouter()
	}
	route := routeRouter.ParseRoute(r, basePath)
	session := BuildSessionContext(r, b.sessionConfig, b.sessionStore)
	errorCtx, err := b.buildErrorContext(ctx, r)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).Warn("Failed to enrich error context, using defaults")
		}
		errorCtx = &api.ErrorContext{DebugMode: false}
	}

	assetsPath := b.config.Assets.BasePath
	if assetsPath == "" {
		assetsPath = "/assets"
	}
	assetsBasePath := path.Join("/", strings.TrimPrefix(basePath, "/"), strings.TrimPrefix(assetsPath, "/"))
	rpcPath := ""
	if b.config.RPC != nil {
		// Global applet RPC endpoint is always exposed as /rpc.
		rpcPath = "/rpc"
	}

	userCtx := api.UserContext{
		ID:          int64(user.ID()),
		Permissions: permissions,
	}
	if du, ok := user.(api.DetailedUser); ok {
		userCtx.Email = du.Email()
		userCtx.FirstName = du.FirstName()
		userCtx.LastName = du.LastName()
	} else {
		userCtx.FirstName = user.DisplayName()
	}

	initial := &api.InitialContext{
		User: userCtx,
		Tenant: api.TenantContext{
			ID:   tenantID.String(),
			Name: tenantName,
		},
		Locale: api.LocaleContext{
			Language:     userLocale.String(),
			Translations: translations,
		},
		Config: api.AppConfig{
			GraphQLEndpoint: b.config.Endpoints.GraphQL,
			StreamEndpoint:  b.config.Endpoints.Stream,
			RESTEndpoint:    b.config.Endpoints.REST,
			BasePath:        basePath,
			AssetsBasePath:  assetsBasePath,
			RPCUIEndpoint:   rpcPath,
			ShellMode:       string(b.config.Shell.Mode),
		},
		Route:   route,
		Session: session,
		Error:   errorCtx,
	}

	if b.config.CustomContext != nil {
		customData, err := b.config.CustomContext(ctx)
		if err != nil && b.logger != nil {
			b.logger.WithError(err).Warn("Failed to build custom context")
		} else if customData != nil {
			initial.Extensions = security.SanitizeForJSON(customData)
		}
	}

	if err := initial.Validate(); err != nil {
		return nil, fmt.Errorf("%s: context contract violation: %w", op, err)
	}

	if b.logger != nil {
		b.logger.WithFields(logrus.Fields{
			"user_id":     user.ID(),
			"tenant_id":   tenantID.String(),
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("Built applet context")
	}
	if b.metrics != nil {
		b.metrics.RecordDuration("applet.context_build", time.Since(start), map[string]string{"tenant_id": tenantID.String()})
		b.metrics.IncrementCounter("applet.context_built", map[string]string{"tenant_id": tenantID.String()})
	}

	return initial, nil
}

// BuildSessionContext builds SessionContext from the request and config.
// Exported for use by internal/stream.
func BuildSessionContext(r *http.Request, config api.SessionConfig, store api.SessionStore) api.SessionContext {
	var expiresAt time.Time
	if store != nil {
		expiresAt = store.GetSessionExpiry(r)
	}
	if expiresAt.IsZero() {
		expiresAt = time.Now().Add(config.ExpiryDuration)
	}
	return api.SessionContext{
		ExpiresAt:  expiresAt.UnixMilli(),
		RefreshURL: config.RefreshURL,
		CSRFToken:  csrf.Token(r),
	}
}

func (b *ContextBuilder) buildErrorContext(ctx context.Context, r *http.Request) (*api.ErrorContext, error) {
	if b.errorEnricher != nil {
		return b.errorEnricher.EnrichContext(ctx, r)
	}
	return &api.ErrorContext{DebugMode: false}, nil
}
