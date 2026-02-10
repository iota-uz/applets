package cli

import (
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/applet/rpccodegen"
)

// NewRPCCommand returns the `applet rpc` subcommand (gen, check, etc.).
func NewRPCCommand() *cobra.Command {
	rpcCmd := &cobra.Command{
		Use:   "rpc",
		Short: "RPC contract codegen",
	}
	rpcCmd.AddCommand(NewRPCGenCommand())
	rpcCmd.AddCommand(NewRPCCheckCommand())
	return rpcCmd
}

// NewRPCCheckCommand returns the `applet rpc check` subcommand.
func NewRPCCheckCommand() *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:   "check",
		Short: "Verify RPC contract is up to date for an applet",
		Long:  `Exits with an error if the on-disk rpc.generated.ts does not match what would be generated from the Go router. Use "applet rpc gen --name <name>" to fix.`,
		Example: `  applet rpc check --name bichat`,
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := rpccodegen.ValidateAppletName(name); err != nil {
				return err
			}
			root, cfg, err := config.LoadFromCWD()
			if err != nil {
				return err
			}
			applet, err := config.ResolveApplet(cfg, name)
			if err != nil {
				return err
			}
			rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, applet.RPC.RouterFunc)
			if err != nil {
				return err
			}
			needsReexportShim := applet.RPC != nil && applet.RPC.NeedsReexportShim
			if err := rpccodegen.CheckDrift(root, name, rpcCfg, needsReexportShim); err != nil {
				return err
			}
			cmd.Println("RPC contract is up to date:", name)
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Applet name (required)")
	_ = cmd.MarkFlagRequired("name")
	return cmd
}

// NewRPCGenCommand returns the `applet rpc gen` subcommand.
func NewRPCGenCommand() *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:   "gen",
		Short: "Generate RPC contract TypeScript from Go router",
		Long:  `Generates rpc.generated.ts for the given applet. Requires --name.`,
		Example: `  applet rpc gen --name bichat`,
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := rpccodegen.ValidateAppletName(name); err != nil {
				return err
			}
			root, cfg, err := config.LoadFromCWD()
			if err != nil {
				return err
			}
			applet, err := config.ResolveApplet(cfg, name)
			if err != nil {
				return err
			}
			rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, applet.RPC.RouterFunc)
			if err != nil {
				return err
			}
			targetAbs := filepath.Join(root, rpcCfg.TargetOut)
			if err := rpccodegen.RunTypegen(root, rpcCfg, targetAbs); err != nil {
				return err
			}
			cmd.Println("Wrote", rpcCfg.TargetOut)
			needsReexportShim := applet.RPC != nil && applet.RPC.NeedsReexportShim
			if needsReexportShim && rpcCfg.TargetOut == rpcCfg.SDKOut {
				moduleAbs := filepath.Join(root, rpcCfg.ModuleOut)
				if err := os.MkdirAll(filepath.Dir(moduleAbs), 0o755); err != nil {
					return err
				}
				content := rpccodegen.ReexportContent(rpcCfg.TypeName, name)
				if err := os.WriteFile(moduleAbs, []byte(content), 0o644); err != nil {
					return err
				}
				cmd.Println("Wrote", rpcCfg.ModuleOut, "(reexport shim)")
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Applet name (required)")
	_ = cmd.MarkFlagRequired("name")
	return cmd
}
