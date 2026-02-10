package cli

import (
	"errors"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/applet/depscheck"
	"github.com/iota-uz/applets/internal/config"
)

// NewDepsCommand returns the deps command with check subcommand.
func NewDepsCommand() *cobra.Command {
	depsCmd := &cobra.Command{
		Use:   "deps",
		Short: "Applet dependency checks",
		Long:  `Validate applet SDK dependency policy (e.g. exact version pinning, no local links).`,
		Example: `  applet deps check`,
	}

	checkCmd := &cobra.Command{
		Use:   "check",
		Short: "Check applet SDK dependency policy",
		Long:  `Scans modules/*/presentation/web/package.json for @iota-uz/sdk and ensures exact version pinning with no file/link/workspace specifiers.`,
		Example: `  applet deps check`,
		RunE:  runDepsCheck,
	}
	depsCmd.AddCommand(checkCmd)

	return depsCmd
}

func runDepsCheck(cmd *cobra.Command, _ []string) error {
	root, err := config.FindRoot()
	if err != nil {
		return err
	}

	violations, found, err := depscheck.Check(root)
	if err != nil {
		return err
	}
	if !found {
		cmd.Println("No applet web package.json files found.")
		return nil
	}
	if len(violations) > 0 {
		for _, v := range violations {
			cmd.PrintErrln(v)
		}
		return NewExitError(FailureCode, errors.New("applet SDK dependency policy check failed"))
	}
	cmd.Println("Applet SDK dependency policy check passed.")
	return nil
}
