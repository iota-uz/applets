package cli

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devrunner"
)

// NewDoctorCommand returns the `applet doctor` subcommand.
func NewDoctorCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Run environment and config diagnostics",
		Long: `Verifies project config, required process commands (e.g. air, templ), and Node/pnpm when applicable.
Exits with remediation hints if something is missing or invalid.`,
		Example: `  applet doctor`,
		Args:    cobra.NoArgs,
		RunE:    runDoctor,
	}
}

func runDoctor(cmd *cobra.Command, _ []string) error {
	ctx := cmd.Context()

	root, cfg, err := config.LoadFromCWD()
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			cmd.PrintErrln("No .applets/config.toml found.")
			cmd.PrintErrln("Run from the repo root and ensure .applets/config.toml exists.")
			return NewExitError(FailureCode, err)
		}
		return err
	}

	cmd.Println("Config: OK (root:", root+")")

	if err := preflightProcesses(cfg); err != nil {
		cmd.PrintErrln(err)
		return NewExitError(FailureCode, err)
	}
	cmd.Println("Process commands: OK")

	nodeMajor := 0
	if cfg.Dev.Processes != nil || len(cfg.Applets) > 0 {
		if m, err := devrunner.PreflightFromPackageJSON(root); err == nil && m > 0 {
			nodeMajor = m
		}
	}
	if nodeMajor > 0 {
		if err := devrunner.PreflightNode(ctx, nodeMajor); err != nil {
			cmd.PrintErrln(err)
			return NewExitError(FailureCode, fmt.Errorf("node: %w", err))
		}
		cmd.Printf("Node: OK (required %d+)\n", nodeMajor)
	}
	needPnpm := cfg.Dev.Processes != nil || len(cfg.Applets) > 0
	if needPnpm {
		if err := devrunner.PreflightPnpm(ctx); err != nil {
			cmd.PrintErrln(err)
			return NewExitError(FailureCode, err)
		}
		cmd.Println("pnpm: OK")
	}

	cmd.Println("All checks passed.")
	return nil
}
