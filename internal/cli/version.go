package cli

import (
	"runtime/debug"

	"github.com/spf13/cobra"
)

// Version is set at build time via -ldflags "-X github.com/iota-uz/applets/internal/cli.Version=..."
var Version = "dev"

// resolveVersion prefers ldflags version, then module build info, then "dev".
func resolveVersion() string {
	if Version != "" && Version != "dev" {
		return Version
	}
	if info, ok := debug.ReadBuildInfo(); ok && info.Main.Version != "" && info.Main.Version != "(devel)" {
		return info.Main.Version
	}
	return "dev"
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
