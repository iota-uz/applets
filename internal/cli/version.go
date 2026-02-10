package cli

import (
	"github.com/spf13/cobra"
)

// Version is set at build time via -ldflags "-X github.com/iota-uz/applets/internal/cli.Version=..."
var Version = "dev"

// resolveVersion returns the build-time version (or "dev" in local builds).
func resolveVersion() string {
	if Version == "" {
		return "dev"
	}
	return Version
}

// NewVersionCommand returns the version subcommand.
func NewVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print applet CLI version",
		Long:  `Print the applet CLI version. Set during build with -ldflags; local builds default to "dev".`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.Println("applet version", resolveVersion())
			return nil
		},
	}
}
