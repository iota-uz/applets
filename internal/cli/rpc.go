package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/applet/rpccodegen"
)

// NewRPCCommand returns the `applet rpc` subcommand (gen, etc.).
func NewRPCCommand() *cobra.Command {
	rpcCmd := &cobra.Command{
		Use:   "rpc",
		Short: "RPC contract codegen",
	}
	rpcCmd.AddCommand(NewRPCGenCommand())
	return rpcCmd
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
			root, err := config.FindRoot()
			if err != nil {
				return err
			}
			cfg, err := config.Load(root)
			if err != nil {
				return err
			}
			applet, ok := cfg.Applets[name]
			if !ok {
				return fmt.Errorf("unknown applet %q (available: %s)", name, strings.Join(cfg.AppletNames(), ", "))
			}
			routerFunc := applet.RPC.RouterFunc
			if routerFunc == "" {
				routerFunc = "Router"
			}
			rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, routerFunc)
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
