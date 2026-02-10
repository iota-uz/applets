package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

// NewCompletionCommand returns the completion subcommand for shell completion.
func NewCompletionCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "completion [bash|zsh|fish]",
		Short: "Generate shell completion script",
		Long: `Generate shell completion script for applet.

To load completions:

Bash:
  applet completion bash | sudo tee /usr/local/etc/bash_completion.d/applet
  # or for current session:
  source <(applet completion bash)

Zsh:
  applet completion zsh | sudo tee /usr/local/share/zsh/site-functions/_applet
  # or for current session:
  source <(applet completion zsh)

Fish:
  applet completion fish | tee ~/.config/fish/completions/applet.fish
`,
		ValidArgs:             []string{"bash", "zsh", "fish"},
		DisableFlagsInUseLine: true,
		Args:                  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			switch args[0] {
			case "bash":
				return cmd.Root().GenBashCompletionV2(cmd.OutOrStdout(), true)
			case "zsh":
				return cmd.Root().GenZshCompletion(cmd.OutOrStdout())
			case "fish":
				return cmd.Root().GenFishCompletion(cmd.OutOrStdout(), true)
			default:
				return InvalidUsage(fmt.Errorf("expected one of: bash, zsh, fish"))
			}
		},
	}
	return cmd
}
