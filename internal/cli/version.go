package cli

import (
	"runtime/debug"

	"github.com/spf13/cobra"
)

// Version is optionally set at build time via:
// -ldflags "-X github.com/iota-uz/applets/internal/cli.Version=vX.Y.Z"
var Version string

const (
	modulePath     = "github.com/iota-uz/applets"
	defaultVersion = "dev"
)

// resolveVersion follows the same approach used by popular Go CLIs:
// build-time variable first, then Go build info, then a local fallback.
func resolveVersion() string {
	if Version != "" {
		return Version
	}
	if v := versionFromBuildInfo(); v != "" {
		return v
	}
	return defaultVersion
}

func versionFromBuildInfo() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	if info.Main.Version != "" && info.Main.Version != "(devel)" {
		return info.Main.Version
	}
	// For binaries built from a subdir command path (cmd/applet), module version
	// can be present in deps instead of Main.Version.
	for _, dep := range info.Deps {
		if dep == nil {
			continue
		}
		if dep.Path == modulePath && dep.Version != "" && dep.Version != "(devel)" {
			return dep.Version
		}
	}
	return ""
}

// NewVersionCommand returns the version subcommand.
func NewVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print applet CLI version",
		Long:  `Print the applet CLI version. Uses -ldflags when set, otherwise module version (for go install @vX.Y.Z) or "dev".`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.Println("applet version", resolveVersion())
			return nil
		},
	}
}
