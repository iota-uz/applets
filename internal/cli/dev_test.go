package cli

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/iota-uz/applets/internal/devrunner"
)

func TestAppendRPCWatchProcesses_Enabled(t *testing.T) {
	base := []devrunner.ProcessSpec{
		{Name: "vite", Command: "pnpm", Args: []string{"exec", "vite"}},
	}

	got := appendRPCWatchProcesses(base, "/repo", []string{"bichat", "sales"}, true, "applet")
	require.Len(t, got, 3)

	assert.Equal(t, "rpc:bichat", got[1].Name)
	assert.Equal(t, "applet", got[1].Command)
	assert.Equal(t, []string{"rpc", "watch", "--name", "bichat"}, got[1].Args)
	assert.Equal(t, "/repo", got[1].Dir)
	assert.False(t, got[1].Critical)

	assert.Equal(t, "rpc:sales", got[2].Name)
	assert.Equal(t, []string{"rpc", "watch", "--name", "sales"}, got[2].Args)
}

func TestAppendRPCWatchProcesses_Disabled(t *testing.T) {
	base := []devrunner.ProcessSpec{
		{Name: "vite", Command: "pnpm", Args: []string{"exec", "vite"}},
	}

	got := appendRPCWatchProcesses(base, "/repo", []string{"bichat"}, false, "applet")
	require.Len(t, got, 1)
	assert.Equal(t, "vite", got[0].Name)
}
