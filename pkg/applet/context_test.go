package applet

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/csrf"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/language"
)

// --- Test context keys and extractors ---
// These replace the iota-sdk composables.WithUser / composables.WithTenantID pattern.
// Tests put data into context using these keys, and extractors read them.

type testCtxKey string

const (
	testUserKey     testCtxKey = "test_user"
	testTenantIDKey testCtxKey = "test_tenant_id"
	testLocaleKey   testCtxKey = "test_locale"
)

func testUserExtractor(ctx context.Context) (AppletUser, error) {
	u, ok := ctx.Value(testUserKey).(AppletUser)
	if !ok || u == nil {
		return nil, fmt.Errorf("no user in context")
	}
	return u, nil
}

func testTenantExtractor(ctx context.Context) (uuid.UUID, error) {
	tid, ok := ctx.Value(testTenantIDKey).(uuid.UUID)
	if !ok {
		return uuid.Nil, fmt.Errorf("no tenant ID in context")
	}
	return tid, nil
}

func testPageLocaleExtractor(ctx context.Context) language.Tag {
	if locale, ok := ctx.Value(testLocaleKey).(language.Tag); ok {
		return locale
	}
	return language.English
}

// testHostServices implements HostServices for testing.
type testHostServices struct{}

func (h *testHostServices) ExtractUser(ctx context.Context) (AppletUser, error) {
	return testUserExtractor(ctx)
}

func (h *testHostServices) ExtractTenantID(ctx context.Context) (uuid.UUID, error) {
	return testTenantExtractor(ctx)
}

func (h *testHostServices) ExtractPool(ctx context.Context) (*pgxpool.Pool, error) {
	return nil, nil // No pool in tests
}

func (h *testHostServices) ExtractPageLocale(ctx context.Context) language.Tag {
	return testPageLocaleExtractor(ctx)
}

// --- Mock implementations ---

// mockUser implements both AppletUser and DetailedUser.
type mockUser struct {
	id          uint
	email       string
	firstName   string
	lastName    string
	permissions []string
}

func (m *mockUser) ID() uint               { return m.id }
func (m *mockUser) Email() string          { return m.email }
func (m *mockUser) FirstName() string      { return m.firstName }
func (m *mockUser) LastName() string       { return m.lastName }
func (m *mockUser) DisplayName() string    { return m.firstName + " " + m.lastName }
func (m *mockUser) PermissionNames() []string {
	if m.permissions == nil {
		return []string{}
	}
	return m.permissions
}
func (m *mockUser) HasPermission(name string) bool {
	normalized := normalizePermissionName(name)
	for _, p := range m.permissions {
		if normalizePermissionName(p) == normalized {
			return true
		}
	}
	return false
}

// Ensure mockUser implements DetailedUser.
var _ DetailedUser = (*mockUser)(nil)

type mockTenantResolver struct {
	name string
	err  error
}

func (m *mockTenantResolver) ResolveTenantName(tenantID string) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.name, nil
}

type mockErrorEnricher struct {
	ctx *ErrorContext
	err error
}

func (m *mockErrorEnricher) EnrichContext(ctx context.Context, r *http.Request) (*ErrorContext, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.ctx, nil
}

type mockMetrics struct {
	durations []struct {
		name     string
		duration time.Duration
		labels   map[string]string
	}
	counters []struct {
		name   string
		labels map[string]string
	}
}

func (m *mockMetrics) RecordDuration(name string, duration time.Duration, labels map[string]string) {
	m.durations = append(m.durations, struct {
		name     string
		duration time.Duration
		labels   map[string]string
	}{name, duration, labels})
}

func (m *mockMetrics) IncrementCounter(name string, labels map[string]string) {
	m.counters = append(m.counters, struct {
		name   string
		labels map[string]string
	}{name, labels})
}

// Helper functions

func createTestBundle() *i18n.Bundle {
	bundle := i18n.NewBundle(language.English)
	_ = bundle.AddMessages(language.English, &i18n.Message{
		ID:    "greeting",
		Other: "Hello",
	})
	_ = bundle.AddMessages(language.English, &i18n.Message{
		ID:    "farewell",
		Other: "Goodbye",
	})
	_ = bundle.AddMessages(language.English, &i18n.Message{
		ID:    "Common.Greeting",
		Other: "Hello (Common)",
	})
	_ = bundle.AddMessages(language.Russian, &i18n.Message{
		ID:    "greeting",
		Other: "Привет",
	})
	return bundle
}

func createTestContext(t *testing.T, opts ...func(*testContextOptions)) context.Context {
	t.Helper()

	options := &testContextOptions{
		userID:    123,
		email:     "test@example.com",
		firstName: "John",
		lastName:  "Doe",
		tenantID:  uuid.New(),
		locale:    language.English,
	}

	for _, opt := range opts {
		opt(options)
	}

	mockU := &mockUser{
		id:          options.userID,
		email:       options.email,
		firstName:   options.firstName,
		lastName:    options.lastName,
		permissions: options.permissions,
	}

	ctx := context.Background()
	ctx = context.WithValue(ctx, testUserKey, AppletUser(mockU))
	ctx = context.WithValue(ctx, testTenantIDKey, options.tenantID)
	ctx = context.WithValue(ctx, testLocaleKey, options.locale)

	return ctx
}

type testContextOptions struct {
	userID      uint
	email       string
	firstName   string
	lastName    string
	tenantID    uuid.UUID
	locale      language.Tag
	permissions []string
}

func withUserID(id uint) func(*testContextOptions) {
	return func(o *testContextOptions) {
		o.userID = id
	}
}

func withPermissions(perms ...string) func(*testContextOptions) {
	return func(o *testContextOptions) {
		o.permissions = perms
	}
}

// Tests

func TestContextBuilder_Build_Success(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel) // Suppress logs during tests
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{
		Endpoints: EndpointConfig{
			GraphQL: "/graphql",
			Stream:  "/stream",
			REST:    "/api",
		},
	}

	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	ctx := createTestContext(t,
		withUserID(42),
		withPermissions("bichat.access", "finance.read"),
	)

	// Create CSRF-protected request
	r := httptest.NewRequest(http.MethodGet, "/test", nil)
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false), // Disable secure for testing
	)
	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Request now has CSRF token
		initialCtx, err := builder.Build(ctx, r, "")
		assert.NoError(t, err)
		assert.NotNil(t, initialCtx)
		if err != nil || initialCtx == nil {
			return
		}

		// Verify user context
		assert.Equal(t, int64(42), initialCtx.User.ID)
		assert.Equal(t, "test@example.com", initialCtx.User.Email)
		assert.Equal(t, "John", initialCtx.User.FirstName)
		assert.Equal(t, "Doe", initialCtx.User.LastName)
		assert.Contains(t, initialCtx.User.Permissions, "bichat.access")
		assert.Contains(t, initialCtx.User.Permissions, "finance.read")

		// Verify tenant context
		assert.NotEmpty(t, initialCtx.Tenant.ID)
		assert.Contains(t, initialCtx.Tenant.Name, "Tenant") // Default format

		// Verify locale context
		assert.Equal(t, "en", initialCtx.Locale.Language)
		assert.NotEmpty(t, initialCtx.Locale.Translations)
		assert.Equal(t, "Hello", initialCtx.Locale.Translations["greeting"])

		// Verify config
		assert.Equal(t, "/graphql", initialCtx.Config.GraphQLEndpoint)
		assert.Equal(t, "/stream", initialCtx.Config.StreamEndpoint)
		assert.Equal(t, "/api", initialCtx.Config.RESTEndpoint)

		// Verify route context
		assert.Equal(t, "/test", initialCtx.Route.Path)
		assert.NotNil(t, initialCtx.Route.Params)
		assert.NotNil(t, initialCtx.Route.Query)

		// Verify session context
		assert.Greater(t, initialCtx.Session.ExpiresAt, time.Now().UnixMilli())
		assert.Equal(t, "/auth/refresh", initialCtx.Session.RefreshURL)
		assert.NotEmpty(t, initialCtx.Session.CSRFToken)

		// Verify error context
		assert.NotNil(t, initialCtx.Error)
		assert.False(t, initialCtx.Error.DebugMode)

		// Verify metrics were recorded
		assert.NotEmpty(t, metrics.durations)
		assert.NotEmpty(t, metrics.counters)
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
}

func TestContextBuilder_Build_MissingUser(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	// Context without user — extractor will fail
	ctx := context.Background()
	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	initialCtx, err := builder.Build(ctx, r, "")
	require.Error(t, err)
	assert.Nil(t, initialCtx)
	assert.Contains(t, err.Error(), "user extraction failed")
}

func TestContextBuilder_Build_MissingTenant(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	// Context with user but no tenant ID — tenant extractor will fail
	mockU := &mockUser{
		id:        123,
		email:     "test@example.com",
		firstName: "John",
		lastName:  "Doe",
	}

	ctx := context.Background()
	ctx = context.WithValue(ctx, testUserKey, AppletUser(mockU))
	// No tenant ID in context

	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	initialCtx, err := builder.Build(ctx, r, "")
	require.Error(t, err)
	assert.Nil(t, initialCtx)
	assert.Contains(t, err.Error(), "tenant extraction failed")
}

func TestGetAllTranslations_Success(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	// Test English locale
	translations := builder.getAllTranslations(language.English)
	assert.NotEmpty(t, translations)
	assert.Equal(t, "Hello", translations["greeting"])
	assert.Equal(t, "Goodbye", translations["farewell"])

	// Test Russian locale
	translationsRu := builder.getAllTranslations(language.Russian)
	assert.NotEmpty(t, translationsRu)
	assert.Equal(t, "Привет", translationsRu["greeting"])
}

func TestGetAllTranslations_LocaleNotFound(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	// Test unsupported locale
	translations := builder.getAllTranslations(language.Japanese)
	assert.Empty(t, translations)
}

func TestGetAllTranslations_PrefixesMode(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{
		I18n: I18nConfig{
			Mode:     TranslationModePrefixes,
			Prefixes: []string{"Common."},
		},
	}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	translations := builder.getAllTranslations(language.English)
	assert.Equal(t, "Hello (Common)", translations["Common.Greeting"])
	_, ok := translations["greeting"]
	assert.False(t, ok)
}

func TestGetAllTranslations_NoneMode(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{
		I18n: I18nConfig{
			Mode: TranslationModeNone,
		},
	}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	translations := builder.getAllTranslations(language.English)
	assert.Empty(t, translations)
}

func TestGetTenantName_ResolverSuccess(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	resolver := &mockTenantResolver{
		name: "ACME Corporation",
		err:  nil,
	}

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{},
		WithTenantNameResolver(resolver),
	)

	tenantID := uuid.New()
	ctx := context.Background()

	name := builder.getTenantName(ctx, tenantID)
	assert.Equal(t, "ACME Corporation", name)
}

func TestGetTenantName_ResolverError(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	// Resolver that fails
	resolver := &mockTenantResolver{
		err: assert.AnError,
	}

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{},
		WithTenantNameResolver(resolver),
	)

	tenantID := uuid.MustParse("12345678-1234-1234-1234-123456789012")
	ctx := context.Background()
	// No pool extractor, so it should fall back to default format

	name := builder.getTenantName(ctx, tenantID)
	// Should fall back to default format when resolver fails and no DB
	assert.Equal(t, "Tenant 12345678", name)
}

func TestGetTenantName_AllFallbacksToDefault(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})
	// No resolver, no database

	tenantID := uuid.MustParse("12345678-1234-1234-1234-123456789012")
	ctx := context.Background()

	name := builder.getTenantName(ctx, tenantID)
	assert.Equal(t, "Tenant 12345678", name) // First 8 chars of UUID
}

func TestCollectUserPermissionNames_Success(t *testing.T) {
	t.Parallel()

	mockU := &mockUser{
		permissions: []string{"bichat.access", "finance.read", "core.admin"},
	}

	permissions := collectUserPermissionNames(mockU)
	assert.Len(t, permissions, 3)
	assert.Contains(t, permissions, "bichat.access")
	assert.Contains(t, permissions, "finance.read")
	assert.Contains(t, permissions, "core.admin")
}

func TestCollectUserPermissionNames_NormalizesCase(t *testing.T) {
	t.Parallel()

	mockU := &mockUser{
		permissions: []string{"BiChat.Access"},
	}

	permissions := collectUserPermissionNames(mockU)
	assert.Contains(t, permissions, "bichat.access")
}

func TestCollectUserPermissionNames_NilUser(t *testing.T) {
	t.Parallel()

	permissions := collectUserPermissionNames(nil)
	assert.Empty(t, permissions)
}

func TestBuildSessionContext(t *testing.T) {
	t.Parallel()

	sessionConfig := SessionConfig{
		ExpiryDuration: 2 * time.Hour,
		RefreshURL:     "/custom/refresh",
		RenewBefore:    10 * time.Minute,
	}

	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Apply CSRF middleware to get token
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionCtx := buildSessionContext(r, sessionConfig, nil)

		// Verify expiry is approximately 2 hours from now
		expectedExpiry := time.Now().Add(2 * time.Hour).UnixMilli()
		assert.InDelta(t, expectedExpiry, sessionCtx.ExpiresAt, float64(1000)) // 1 second tolerance

		assert.Equal(t, "/custom/refresh", sessionCtx.RefreshURL)
		assert.NotEmpty(t, sessionCtx.CSRFToken)
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
}

func TestBuildErrorContext_WithEnricher(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	enricher := &mockErrorEnricher{
		ctx: &ErrorContext{
			SupportEmail: "support@example.com",
			DebugMode:    true,
			ErrorCodes: map[string]string{
				"NOT_FOUND": "Resource not found",
			},
		},
	}

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{},
		WithErrorEnricher(enricher),
	)

	ctx := context.Background()
	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	errorCtx, err := builder.buildErrorContext(ctx, r)
	require.NoError(t, err)
	require.NotNil(t, errorCtx)

	assert.Equal(t, "support@example.com", errorCtx.SupportEmail)
	assert.True(t, errorCtx.DebugMode)
	assert.Equal(t, "Resource not found", errorCtx.ErrorCodes["NOT_FOUND"])
}

func TestBuildErrorContext_WithoutEnricher(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})
	// No enricher

	ctx := context.Background()
	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	errorCtx, err := builder.buildErrorContext(ctx, r)
	require.NoError(t, err)
	require.NotNil(t, errorCtx)

	// Should return minimal defaults
	assert.False(t, errorCtx.DebugMode)
	assert.Empty(t, errorCtx.SupportEmail)
}

func TestContextBuilder_Build_WithCustomContext(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{
		CustomContext: func(ctx context.Context) (map[string]interface{}, error) {
			return map[string]interface{}{
				"customField": "customValue",
				"userId":      42,
			}, nil
		},
	}

	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	ctx := createTestContext(t)
	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Apply CSRF
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	var capturedCtx *InitialContext
	var capturedErr error

	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedCtx, capturedErr = builder.Build(ctx, r, "")
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	// Assert after handler completes
	require.NoError(t, capturedErr)
	require.NotNil(t, capturedCtx)
	assert.NotNil(t, capturedCtx.Extensions)
	assert.Equal(t, "customValue", capturedCtx.Extensions["customField"])
	assert.Equal(t, 42, capturedCtx.Extensions["userId"])
}

func TestContextBuilder_Build_WithMuxRouter(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{
		Router: NewMuxRouter(),
	}

	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	ctx := createTestContext(t)
	r := httptest.NewRequest(http.MethodGet, "/sessions/123?tab=history", nil)

	// Apply CSRF
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	var capturedCtx *InitialContext
	var capturedErr error

	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedCtx, capturedErr = builder.Build(ctx, r, "")
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)

	// Assert after handler completes
	require.NoError(t, capturedErr)
	require.NotNil(t, capturedCtx)
	assert.Equal(t, "history", capturedCtx.Route.Query["tab"])
}

func TestContextBuilder_Build_MetricsRecorded(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	config := Config{}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{})

	ctx := createTestContext(t)
	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Apply CSRF
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := builder.Build(ctx, r, "")
		assert.NoError(t, err)
		if err != nil {
			return
		}

		// Verify metrics were recorded
		assert.NotEmpty(t, metrics.durations)
		assert.NotEmpty(t, metrics.counters)

		// Check for specific metrics
		var foundContextBuild, foundTranslation, foundTenant bool
		for _, d := range metrics.durations {
			switch d.name {
			case "applet.context_build":
				foundContextBuild = true
			case "applet.translation_load":
				foundTranslation = true
			case "applet.tenant_resolution":
				foundTenant = true
			}
		}
		assert.True(t, foundContextBuild, "context_build metric not recorded")
		assert.True(t, foundTranslation, "translation_load metric not recorded")
		assert.True(t, foundTenant, "tenant_resolution metric not recorded")

		// Verify counter
		var foundCounter bool
		for _, c := range metrics.counters {
			if c.name == "applet.context_built" {
				foundCounter = true
			}
		}
		assert.True(t, foundCounter, "context_built counter not recorded")
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
}

// Mock session store for testing

type mockSessionStore struct {
	expiresAt time.Time
}

func (m *mockSessionStore) GetSessionExpiry(r *http.Request) time.Time {
	return m.expiresAt
}

func TestBuildSessionContext_WithSessionStore(t *testing.T) {
	t.Parallel()

	sessionConfig := SessionConfig{
		ExpiryDuration: 2 * time.Hour,
		RefreshURL:     "/custom/refresh",
		RenewBefore:    10 * time.Minute,
	}

	// Mock session store with actual expiry 3 hours from now
	actualExpiry := time.Now().Add(3 * time.Hour)
	store := &mockSessionStore{
		expiresAt: actualExpiry,
	}

	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Apply CSRF middleware to get token
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionCtx := buildSessionContext(r, sessionConfig, store)

		// Verify it uses actual expiry from store (3 hours), not config (2 hours)
		expectedExpiry := actualExpiry.UnixMilli()
		assert.Equal(t, expectedExpiry, sessionCtx.ExpiresAt)

		assert.Equal(t, "/custom/refresh", sessionCtx.RefreshURL)
		assert.NotEmpty(t, sessionCtx.CSRFToken)
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
}

func TestBuildSessionContext_WithSessionStoreReturnsZero(t *testing.T) {
	t.Parallel()

	sessionConfig := SessionConfig{
		ExpiryDuration: 2 * time.Hour,
		RefreshURL:     "/custom/refresh",
		RenewBefore:    10 * time.Minute,
	}

	// Mock session store that returns zero time (session not found)
	store := &mockSessionStore{
		expiresAt: time.Time{},
	}

	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Apply CSRF middleware to get token
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionCtx := buildSessionContext(r, sessionConfig, store)

		// Verify it falls back to configured duration (2 hours)
		expectedExpiry := time.Now().Add(2 * time.Hour).UnixMilli()
		assert.InDelta(t, expectedExpiry, sessionCtx.ExpiresAt, float64(1000)) // 1 second tolerance

		assert.Equal(t, "/custom/refresh", sessionCtx.RefreshURL)
		assert.NotEmpty(t, sessionCtx.CSRFToken)
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
}

func TestBuildSessionContext_WithoutSessionStore(t *testing.T) {
	t.Parallel()

	sessionConfig := SessionConfig{
		ExpiryDuration: 2 * time.Hour,
		RefreshURL:     "/custom/refresh",
		RenewBefore:    10 * time.Minute,
	}

	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Apply CSRF middleware to get token
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sessionCtx := buildSessionContext(r, sessionConfig, nil)

		// Verify it uses configured duration (2 hours)
		expectedExpiry := time.Now().Add(2 * time.Hour).UnixMilli()
		assert.InDelta(t, expectedExpiry, sessionCtx.ExpiresAt, float64(1000)) // 1 second tolerance

		assert.Equal(t, "/custom/refresh", sessionCtx.RefreshURL)
		assert.NotEmpty(t, sessionCtx.CSRFToken)
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
}

func TestContextBuilder_Build_WithSessionStore(t *testing.T) {
	t.Parallel()

	bundle := createTestBundle()
	logger := logrus.New()
	logger.SetLevel(logrus.FatalLevel)
	metrics := &mockMetrics{}
	sessionConfig := DefaultSessionConfig

	// Mock session store with actual expiry 48 hours from now
	actualExpiry := time.Now().Add(48 * time.Hour)
	store := &mockSessionStore{
		expiresAt: actualExpiry,
	}

	config := Config{
		Endpoints: EndpointConfig{
			GraphQL: "/graphql",
			Stream:  "/stream",
			REST:    "/api",
		},
	}

	opts := []BuilderOption{WithSessionStore(store)}
	builder := NewContextBuilder(config, bundle, sessionConfig, logger, metrics, &testHostServices{}, opts...)

	ctx := createTestContext(t, withUserID(42))
	r := httptest.NewRequest(http.MethodGet, "/test", nil)

	// Apply CSRF
	csrfMiddleware := csrf.Protect(
		[]byte("32-byte-long-secret-key-for-testing!"),
		csrf.Secure(false),
	)
	handler := csrfMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		initialCtx, err := builder.Build(ctx, r, "")
		assert.NoError(t, err)
		assert.NotNil(t, initialCtx)
		if err != nil || initialCtx == nil {
			return
		}

		// Verify session uses actual expiry from store (48 hours)
		expectedExpiry := actualExpiry.UnixMilli()
		assert.Equal(t, expectedExpiry, initialCtx.Session.ExpiresAt)
		assert.NotEmpty(t, initialCtx.Session.CSRFToken)
	}))

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
}
