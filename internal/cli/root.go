package cli

import (
	"errors"

	"github.com/spf13/cobra"
)

// NewRootCommand returns the root applet command with all subcommands.
func NewRootCommand() *cobra.Command {
	root := &cobra.Command{
		Use:   "applet",
		Short: "Applet development toolkit",
		Long: `Applet CLI — development, build, and validation tools for applet projects.

Run from the repo that contains the applet (e.g. iota-sdk or eai).
Requires .applets/config.toml at the project root.`,
		Example: `  applet doctor
  applet dev
  applet dev bichat
  applet list
  applet build bichat
  applet check
  applet rpc gen --name bichat
  applet rpc check --name bichat
  applet deps check
  applet version`,
		SilenceErrors: true,
		SilenceUsage:  true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if v, _ := cmd.Flags().GetBool("version"); v {
				cmd.Println("applet version", resolveVersion())
				return nil
			}
			return errors.New("requires a subcommand")
		},
	}
	root.Flags().BoolP("version", "v", false, "Print applet CLI version")

	root.AddCommand(NewVersionCommand())
	root.AddCommand(NewCompletionCommand())
	root.AddCommand(NewDoctorCommand())
	root.AddCommand(NewDevCommand())
	root.AddCommand(NewListCommand())
	root.AddCommand(NewBuildCommand())
	root.AddCommand(NewCheckCommand())
	root.AddCommand(NewRPCCommand())
	root.AddCommand(NewDepsCommand())

	return root
}
