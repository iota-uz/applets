package cli

import (
	"github.com/spf13/cobra"
)

// NewRootCommand returns the root applet command with all subcommands.
func NewRootCommand() *cobra.Command {
	root := &cobra.Command{
		Use:   "applet",
		Short: "Applet RPC and dependency utilities",
		Long: `Generate or check applet RPC contracts and validate applet SDK dependency policy.

Run from the repo that contains the applet (e.g. iota-sdk or eai).`,
		Example: `  applet rpc gen --name bichat
  applet rpc check --name bichat
  applet deps check
  applet version
  applet completion bash`,
		SilenceErrors: true,
		SilenceUsage:  true,
	}

	root.PersistentFlags().BoolVar(&verbose, "verbose", false, "verbose output")
	root.PersistentFlags().BoolVar(&quiet, "quiet", false, "suppress non-error output")

	root.AddCommand(NewVersionCommand())
	root.AddCommand(NewCompletionCommand())
	root.AddCommand(NewRPCCommand())
	root.AddCommand(NewDepsCommand())

	return root
}

// verbose and quiet are reserved for future use (e.g. logging in rpccodegen/depscheck).
var verbose, quiet bool
