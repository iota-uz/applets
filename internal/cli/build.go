package cli

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devsetup"
)

// NewBuildCommand returns the `applet build [name]` subcommand.
func NewBuildCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "build [name]",
		Short: "Build applet production bundle",
		Long: `Build the production frontend bundle for an applet.

Without a name, builds all applets defined in .applets/config.toml.
With a name, builds only that applet.`,
		Example: `  applet build bichat
  applet build`,
		Args: cobra.MaximumNArgs(1),
		RunE: runBuild,
	}
}

func runBuild(cmd *cobra.Command, args []string) error {
	root, cfg, err := config.LoadFromCWD()
	if err != nil {
		return err
	}

	var names []string
	if len(args) > 0 {
		name := args[0]
		if _, err := config.ResolveApplet(cfg, name); err != nil {
			return err
		}
		names = []string{name}
	} else {
		names = cfg.AppletNames()
	}

	if len(names) == 0 {
		cmd.Println("No applets configured.")
		return nil
	}

	if err := devsetup.BuildSDKIfNeeded(cmd.Context(), root); err != nil {
		return fmt.Errorf("sdk build failed: %w", err)
	}

	for _, name := range names {
		applet := cfg.Applets[name]
		webDir := applet.Web

		if err := devsetup.RefreshAppletDeps(cmd.Context(), root, webDir); err != nil {
			return fmt.Errorf("applet %s dep refresh failed: %w", name, err)
		}

		cmd.Printf("Building %s...\n", name)
		if err := devsetup.RunCommand(cmd.Context(), root, "pnpm", "-C", webDir, "run", "build"); err != nil {
			return fmt.Errorf("build %s failed: %w", name, err)
		}
		cmd.Printf("Built %s\n", name)
	}

	return nil
}
