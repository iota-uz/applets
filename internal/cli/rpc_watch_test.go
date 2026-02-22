package cli

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLatestGoFileModTime_UsesNewestFile(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "nested"), 0o755))

	oldFile := filepath.Join(root, "router.go")
	newFile := filepath.Join(root, "nested", "types.go")
	require.NoError(t, os.WriteFile(oldFile, []byte("package rpc\n"), 0o644))
	require.NoError(t, os.WriteFile(newFile, []byte("package rpc\n"), 0o644))

	oldTime := time.Now().Add(-2 * time.Minute).Truncate(time.Second)
	newTime := time.Now().Add(-1 * time.Minute).Truncate(time.Second)
	require.NoError(t, os.Chtimes(oldFile, oldTime, oldTime))
	require.NoError(t, os.Chtimes(newFile, newTime, newTime))

	got, err := latestGoFileModTime(root)
	require.NoError(t, err)
	assert.Equal(t, newTime, got.Truncate(time.Second))
}

func TestLatestGoFileModTime_NoGoFiles(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "README.md"), []byte("# docs"), 0o644))

	_, err := latestGoFileModTime(root)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no Go files")
}
