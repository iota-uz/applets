package cli

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/applet/depscheck"
	"github.com/iota-uz/applets/internal/applet/rpccodegen"
	"github.com/iota-uz/applets/internal/config"
)

// NewCheckCommand returns the `applet check` subcommand.
func NewCheckCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "check",
		Short: "Run all checks for configured applets",
		Long: `Run dependency policy checks and RPC contract drift checks for all applets
defined in .applets/config.toml. Exits non-zero if any check fails.`,
		Example: `  applet check`,
		Args:    cobra.NoArgs,
		RunE:    runCheck,
	}
}

func runCheck(cmd *cobra.Command, _ []string) error {
	root, cfg, err := config.LoadFromCWD()
	if err != nil {
		return err
	}

	var failed bool

	// Deps check
	violations, found, err := depscheck.Check(root)
	if err != nil {
		return err
	}
	if found && len(violations) > 0 {
		stderr := cmd.ErrOrStderr()
		for _, v := range violations {
			fmt.Fprintln(stderr, v)
		}
		failed = true
	}

	// RPC check for each applet (convention: router function is always "Router")
	for _, name := range cfg.AppletNames() {
		applet := cfg.Applets[name]
		rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, "Router")
		if err != nil {
			cmd.PrintErrln("RPC check skipped for", name+":", err)
			continue
		}
		needsReexportShim := applet.RPC != nil && applet.RPC.NeedsReexportShim
		if err := rpccodegen.CheckDrift(root, name, rpcCfg, needsReexportShim); err != nil {
			cmd.PrintErrln(err)
			failed = true
		} else {
			cmd.Println("RPC contract is up to date:", name)
		}
	}

	if failed {
		return NewExitError(FailureCode, errors.New("one or more checks failed"))
	}

	cmd.Println("All checks passed.")
	return nil
}
