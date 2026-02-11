package controller

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/iota-uz/applets/internal/api"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/text/language"
)

type testCtxKey string

const (
	testUserKey     testCtxKey = "test_user"
	testTenantIDKey testCtxKey = "test_tenant_id"
	testLocaleKey   testCtxKey = "test_locale"
)

type testApplet struct {
	name     string
	basePath string
	config   api.Config
}

func (a *testApplet) Name() string     { return a.name }
func (a *testApplet) BasePath() string { return a.basePath }
func (a *testApplet) Config() api.Config { return a.config }

type testHostServices struct{}

func (h *testHostServices) ExtractUser(ctx context.Context) (api.AppletUser, error) {
	u, ok := ctx.Value(testUserKey).(api.AppletUser)
	if !ok || u == nil {
		return nil, fmt.Errorf("no user in context")
	}
	return u, nil
}

func (h *testHostServices) ExtractTenantID(ctx context.Context) (uuid.UUID, error) {
	tid, ok := ctx.Value(testTenantIDKey).(uuid.UUID)
	if !ok {
		return uuid.Nil, fmt.Errorf("no tenant ID in context")
	}
	return tid, nil
}

func (h *testHostServices) ExtractPool(ctx context.Context) (*pgxpool.Pool, error) {
	return nil, nil
}

func (h *testHostServices) ExtractPageLocale(ctx context.Context) language.Tag {
	if locale, ok := ctx.Value(testLocaleKey).(language.Tag); ok {
		return locale
	}
	return language.English
}

type mockUser struct {
	id          uint
	email       string
	firstName   string
	lastName    string
	permissions []string
}

func (m *mockUser) ID() uint            { return m.id }
func (m *mockUser) Email() string       { return m.email }
func (m *mockUser) FirstName() string   { return m.firstName }
func (m *mockUser) LastName() string    { return m.lastName }
func (m *mockUser) DisplayName() string { return m.firstName + " " + m.lastName }

func (m *mockUser) PermissionNames() []string {
	if m.permissions == nil {
		return nil
	}
	return m.permissions
}

func (m *mockUser) HasPermission(name string) bool {
	name = strings.TrimSpace(name)
	for _, p := range m.permissions {
		if strings.TrimSpace(p) == name {
			return true
		}
	}
	return false
}

var _ api.DetailedUser = (*mockUser)(nil)

// classifiedError implements api.ErrorClassifier for testing.
type classifiedError struct {
	kind string
	msg  string
}

func (e *classifiedError) Error() string     { return e.msg }
func (e *classifiedError) ErrorKind() string { return e.kind }

var _ api.ErrorClassifier = (*classifiedError)(nil)
