package context

import (
	"context"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/iota-uz/applets/internal/api"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/language"
)

type builderTestUser struct{}

func (u *builderTestUser) ID() uint                    { return 7 }
func (u *builderTestUser) DisplayName() string         { return "Builder Test" }
func (u *builderTestUser) HasPermission(_ string) bool { return true }
func (u *builderTestUser) PermissionNames() []string   { return []string{"BiChat.Access"} }

type builderTestHost struct{}

func (h *builderTestHost) ExtractUser(_ context.Context) (api.AppletUser, error) {
	return &builderTestUser{}, nil
}

func (h *builderTestHost) ExtractTenantID(_ context.Context) (uuid.UUID, error) {
	return uuid.MustParse("00000000-0000-0000-0000-000000000001"), nil
}

func (h *builderTestHost) ExtractPool(_ context.Context) (*pgxpool.Pool, error) {
	return nil, fmt.Errorf("no pool in tests")
}

func (h *builderTestHost) ExtractPageLocale(_ context.Context) language.Tag {
	return language.English
}

func TestBuild_UsesGlobalRPCEndpoint(t *testing.T) {
	t.Parallel()

	builder := NewContextBuilder(
		api.Config{
			WindowGlobal: "__T__",
			Shell:        api.ShellConfig{Mode: api.ShellModeStandalone},
			Assets: api.AssetConfig{
				BasePath: "/assets",
			},
			RPC: &api.RPCConfig{
				Methods: map[string]api.RPCMethod{},
			},
		},
		nil,
		api.DefaultSessionConfig,
		nil,
		nil,
		&builderTestHost{},
	)

	req := httptest.NewRequest("GET", "http://example.test/bi-chat", nil)
	initial, err := builder.Build(context.Background(), req, "/bi-chat")
	require.NoError(t, err)
	assert.Equal(t, "/rpc", initial.Config.RPCUIEndpoint)
}

func TestBuild_EmptyRPCEndpointWhenRPCDisabled(t *testing.T) {
	t.Parallel()

	builder := NewContextBuilder(
		api.Config{
			WindowGlobal: "__T__",
			Shell:        api.ShellConfig{Mode: api.ShellModeStandalone},
			Assets: api.AssetConfig{
				BasePath: "/assets",
			},
		},
		nil,
		api.DefaultSessionConfig,
		nil,
		nil,
		&builderTestHost{},
	)

	req := httptest.NewRequest("GET", "http://example.test/bi-chat", nil)
	initial, err := builder.Build(context.Background(), req, "/bi-chat")
	require.NoError(t, err)
	assert.Equal(t, "", initial.Config.RPCUIEndpoint)
}
