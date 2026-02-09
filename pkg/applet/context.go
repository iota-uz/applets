package applet

import (
	"context"
	"fmt"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/csrf"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"github.com/sirupsen/logrus"
)

// ContextBuilder builds InitialContext for applets by extracting
// user, tenant, locale, and session information from the request context.
type ContextBuilder struct {
	config             Config
	bundle             *i18n.Bundle
	sessionConfig      SessionConfig
	logger             *logrus.Logger
	metrics            MetricsRecorder
	host               HostServices
	tenantNameResolver TenantNameResolver
	errorEnricher      ErrorContextEnricher
	sessionStore       SessionStore

	translationsMu    sync.RWMutex
	translationsCache map[string]map[string]string
}

// NewContextBuilder creates a new ContextBuilder with required dependencies.
//
// Required parameters:
//   - config: Applet configuration (endpoints, router, custom context)
//   - bundle: i18n bundle for translation loading
//   - sessionConfig: Session expiry and refresh configuration
//   - logger: Structured logger for operations
//   - metrics: Metrics recorder for performance tracking
//   - host: Host services for extracting user, tenant, pool, locale
//
// Optional via BuilderOption:
//   - WithTenantNameResolver: Custom tenant name resolution
//   - WithErrorEnricher: Custom error context enrichment
//   - WithSessionStore: Custom session store for actual expiry times
func NewContextBuilder(
	config Config,
	bundle *i18n.Bundle,
	sessionConfig SessionConfig,
	logger *logrus.Logger,
	metrics MetricsRecorder,
	host HostServices,
	opts ...BuilderOption,
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

// Build builds the InitialContext object for the React/Next.js frontend.
// It extracts all necessary information from the request context and
// serializes it for JSON injection into the frontend application.
//
// basePath is the applet's base path (e.g., "/bi-chat") used for route parsing.
func (b *ContextBuilder) Build(ctx context.Context, r *http.Request, basePath string) (*InitialContext, error) {
	const op = "ContextBuilder.Build"
	start := time.Now()

	// Extract user
	user, err := b.host.ExtractUser(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).Error("Failed to extract user for applet context")
		}
		return nil, fmt.Errorf("%s: %w: user extraction failed: %w", op, ErrInternal, err)
	}

	// Extract tenant ID
	tenantID, err := b.host.ExtractTenantID(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).WithField("user_id", user.ID()).Error("Failed to extract tenant ID")
		}
		return nil, fmt.Errorf("%s: %w: tenant extraction failed: %w", op, ErrInternal, err)
	}

	// Extract page locale
	userLocale := b.host.ExtractPageLocale(ctx)

	// Log build start
	if b.logger != nil {
		b.logger.WithFields(logrus.Fields{
			"user_id":   user.ID(),
			"tenant_id": tenantID.String(),
			"locale":    userLocale.String(),
		}).Debug("Building applet context")
	}

	// Get all user permissions (validated)
	permissions := collectUserPermissionNames(user)
	permissions = validatePermissions(permissions)

	// Load all translations for user's locale
	translationStart := time.Now()
	translations := b.getAllTranslations(userLocale)
	translationDuration := time.Since(translationStart)
	if b.metrics != nil {
		b.metrics.RecordDuration("applet.translation_load", translationDuration, map[string]string{
			"locale": userLocale.String(),
		})
	}

	// Get tenant name (multi-layer fallback)
	tenantResolveStart := time.Now()
	tenantName := b.getTenantName(ctx, tenantID)
	tenantResolveDuration := time.Since(tenantResolveStart)
	if b.metrics != nil {
		b.metrics.RecordDuration("applet.tenant_resolution", tenantResolveDuration, map[string]string{
			"tenant_id": tenantID.String(),
		})
	}

	// Build route context
	router := b.config.Router
	if router == nil {
		router = NewDefaultRouter()
	}
	route := router.ParseRoute(r, basePath)

	// Build session context
	session := buildSessionContext(r, b.sessionConfig, b.sessionStore)

	// Build error context
	errorCtx, err := b.buildErrorContext(ctx, r)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).Warn("Failed to enrich error context, using defaults")
		}
		// Use minimal defaults on error
		errorCtx = &ErrorContext{
			DebugMode: false,
		}
	}

	// Build initial context
	assetsPath := b.config.Assets.BasePath
	if assetsPath == "" {
		assetsPath = "/assets"
	}
	assetsBasePath := path.Join("/", strings.TrimPrefix(basePath, "/"), strings.TrimPrefix(assetsPath, "/"))

	rpcPath := ""
	if b.config.RPC != nil {
		rpcPath = b.config.RPC.Path
		if rpcPath == "" {
			rpcPath = "/rpc"
		}
		rpcPath = path.Join("/", strings.TrimPrefix(basePath, "/"), strings.TrimPrefix(rpcPath, "/"))
	}

	// Build user context — use DetailedUser for richer fields when available
	userCtx := UserContext{
		ID:          int64(user.ID()),
		Permissions: permissions,
	}
	if du, ok := user.(DetailedUser); ok {
		userCtx.Email = du.Email()
		userCtx.FirstName = du.FirstName()
		userCtx.LastName = du.LastName()
	} else {
		userCtx.FirstName = user.DisplayName()
	}

	initialContext := &InitialContext{
		User: userCtx,
		Tenant: TenantContext{
			ID:   tenantID.String(),
			Name: tenantName,
		},
		Locale: LocaleContext{
			Language:     userLocale.String(),
			Translations: translations,
		},
		Config: AppConfig{
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

	// Apply custom context extender if provided
	if b.config.CustomContext != nil {
		customData, err := b.config.CustomContext(ctx)
		if err != nil {
			if b.logger != nil {
				b.logger.WithError(err).Warn("Failed to build custom context")
			}
		} else if customData != nil {
			// Sanitize custom data to prevent XSS
			initialContext.Extensions = sanitizeForJSON(customData)
		}
	}

	// Log and record metrics
	buildDuration := time.Since(start)
	if b.logger != nil {
		b.logger.WithFields(logrus.Fields{
			"user_id":     user.ID(),
			"tenant_id":   tenantID.String(),
			"duration_ms": buildDuration.Milliseconds(),
		}).Debug("Built applet context")
	}

	if b.metrics != nil {
		b.metrics.RecordDuration("applet.context_build", buildDuration, map[string]string{
			"tenant_id": tenantID.String(),
		})
		b.metrics.IncrementCounter("applet.context_built", map[string]string{
			"tenant_id": tenantID.String(),
		})
	}

	return initialContext, nil
}

// buildSessionContext creates SessionContext from request and session configuration.
func buildSessionContext(r *http.Request, config SessionConfig, store SessionStore) SessionContext {
	var expiresAt time.Time

	if store != nil {
		storeExpiry := store.GetSessionExpiry(r)
		if !storeExpiry.IsZero() {
			expiresAt = storeExpiry
		}
	}

	if expiresAt.IsZero() {
		expiresAt = time.Now().Add(config.ExpiryDuration)
	}

	return SessionContext{
		ExpiresAt:  expiresAt.UnixMilli(),
		RefreshURL: config.RefreshURL,
		CSRFToken:  csrf.Token(r),
	}
}

// buildErrorContext builds ErrorContext using optional ErrorContextEnricher.
func (b *ContextBuilder) buildErrorContext(ctx context.Context, r *http.Request) (*ErrorContext, error) {
	const op = "ContextBuilder.buildErrorContext"

	if b.errorEnricher != nil {
		errorCtx, err := b.errorEnricher.EnrichContext(ctx, r)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", op, err)
		}
		return errorCtx, nil
	}

	return &ErrorContext{
		DebugMode: false,
	}, nil
}
