package rpccodegen

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateGoIdentifier(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{name: "Valid", input: "Router", wantErr: false},
		{name: "ValidWithUnderscore", input: "_router2", wantErr: false},
		{name: "Empty", input: "", wantErr: true},
		{name: "InvalidDash", input: "router-func", wantErr: true},
		{name: "InvalidLeadingDigit", input: "1Router", wantErr: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateGoIdentifier(tc.input)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestInspectRouter(t *testing.T) {
	t.Parallel()

	repoRoot := findRepoRoot(t)
	modPath, err := ReadModulePath(filepath.Join(repoRoot, "go.mod"))
	require.NoError(t, err)
	importPath := modPath + "/internal/applet/rpccodegen/testfixtures/routerfixtures"

	t.Run("NoArgsRouter", func(t *testing.T) {
		t.Parallel()
		desc, err := InspectRouter(repoRoot, importPath, "Router")
		require.NoError(t, err)
		require.NotNil(t, desc)
		require.Len(t, desc.Methods, 2, "Router should have ping + rich methods")

		// Methods are sorted by name
		require.Equal(t, "fixtures.ping", desc.Methods[0].Name)
		require.Equal(t, "fixtures.rich", desc.Methods[1].Name)

		// Verify rich method exercises all type kinds
		rich := desc.Methods[1]
		require.Equal(t, "named", rich.Params.Kind)
		require.Equal(t, "named", rich.Result.Kind)

		resultType, ok := desc.Types[rich.Result.Name]
		require.True(t, ok, "result type %q should be in Types map", rich.Result.Name)

		fieldKinds := make(map[string]string)
		for _, f := range resultType.Fields {
			fieldKinds[f.Name] = f.Type.Kind
		}
		// []string → array, map[string]string → record, time.Time → string, uuid.UUID → string
		require.Equal(t, "array", fieldKinds["tags"], "[]string should map to array")
		require.Equal(t, "array", fieldKinds["scores"], "[]int should map to array")
		require.Equal(t, "record", fieldKinds["labels"], "map[string]string should map to record")
		require.Equal(t, "string", fieldKinds["createdAt"], "time.Time should map to string")
		require.Equal(t, "named", fieldKinds["nested"], "struct should map to named")
		require.Equal(t, "union", fieldKinds["optName"], "*string should map to union (string | null)")

		// json:"-" field should be absent
		_, hasIgnored := fieldKinds["ignored"]
		require.False(t, hasIgnored, "json:\"-\" field should be excluded")

		// uuid param
		paramsType, ok := desc.Types[rich.Params.Name]
		require.True(t, ok)
		require.Len(t, paramsType.Fields, 1)
		require.Equal(t, "string", paramsType.Fields[0].Type.Kind, "uuid.UUID should map to string")
	})

	t.Run("DependencyfulRouter", func(t *testing.T) {
		t.Parallel()
		desc, err := InspectRouter(repoRoot, importPath, "RouterWithDeps")
		require.NoError(t, err)
		require.NotNil(t, desc)
		require.Len(t, desc.Methods, 2, "RouterWithDeps delegates to Router")
	})

	t.Run("InvalidReturnType", func(t *testing.T) {
		t.Parallel()
		_, err := InspectRouter(repoRoot, importPath, "RouterBadReturn")
		require.Error(t, err)
		require.Contains(t, err.Error(), "expected *applets.TypedRPCRouter")
	})
}

func findRepoRoot(t *testing.T) string {
	t.Helper()

	wd, err := filepath.Abs(".")
	require.NoError(t, err)
	for {
		if _, readErr := ReadModulePath(filepath.Join(wd, "go.mod")); readErr == nil {
			return wd
		}
		parent := filepath.Dir(wd)
		if parent == wd {
			break
		}
		wd = parent
	}
	t.Fatal("repo root with go.mod not found")
	return ""
}
