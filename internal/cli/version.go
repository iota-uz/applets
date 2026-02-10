package cli

import (
	"github.com/spf13/cobra"
)

// Version is set at build time via -ldflags "-X github.com/iota-uz/applets/internal/cli.Version=..."
var Version = "dev"

// NewVersionCommand returns the version subcommand.
func NewVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print applet CLI version",
		Long:  `Print the applet CLI version. When built with -ldflags, this shows the release version; otherwise "dev".`,
		RunE: func(cmd *cobra.Command, args []string) error {
			cmd.Println("applet version", Version)
			return nil
		},
	}
}
