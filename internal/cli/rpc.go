package cli

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/applet/rpccodegen"
	"github.com/iota-uz/applets/internal/config"
)

// NewRPCCommand returns the `applet rpc` subcommand (gen, check, etc.).
func NewRPCCommand() *cobra.Command {
	rpcCmd := &cobra.Command{
		Use:   "rpc",
		Short: "RPC contract codegen",
	}
	rpcCmd.AddCommand(NewRPCGenCommand())
	rpcCmd.AddCommand(NewRPCCheckCommand())
	rpcCmd.AddCommand(NewRPCWatchCommand())
	return rpcCmd
}

// NewRPCCheckCommand returns the `applet rpc check` subcommand.
func NewRPCCheckCommand() *cobra.Command {
	var name string
	cmd := &cobra.Command{
		Use:     "check",
		Short:   "Verify RPC contract is up to date for an applet",
		Long:    `Exits with an error if the on-disk rpc.generated.ts does not match what would be generated from the Go router. Use "applet rpc gen --name <name>" to fix.`,
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
			rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, "Router")
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
		Use:     "gen",
		Short:   "Generate RPC contract TypeScript from Go router",
		Long:    `Generates rpc.generated.ts for the given applet. Requires --name.`,
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
			rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, "Router")
			if err != nil {
				return err
			}
			return runRPCGen(root, name, applet, rpcCfg, cmd)
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Applet name (required)")
	_ = cmd.MarkFlagRequired("name")
	return cmd
}

// NewRPCWatchCommand returns the `applet rpc watch` subcommand.
func NewRPCWatchCommand() *cobra.Command {
	var (
		name     string
		interval time.Duration
	)

	cmd := &cobra.Command{
		Use:     "watch",
		Short:   "Watch Go RPC router files and regenerate TypeScript contract",
		Long:    `Watches modules/<name>/rpc/**/*.go and reruns "applet rpc gen --name <name>" whenever files change.`,
		Example: `  applet rpc watch --name bichat`,
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := rpccodegen.ValidateAppletName(name); err != nil {
				return err
			}
			if interval <= 0 {
				return fmt.Errorf("interval must be positive")
			}

			root, cfg, err := config.LoadFromCWD()
			if err != nil {
				return err
			}
			applet, err := config.ResolveApplet(cfg, name)
			if err != nil {
				return err
			}
			rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, "Router")
			if err != nil {
				return err
			}
			if err := runRPCGen(root, name, applet, rpcCfg, cmd); err != nil {
				return err
			}

			rpcDir := filepath.Join(root, filepath.FromSlash(rpcCfg.RouterPackage))
			lastSeen, err := latestGoFileModTime(rpcDir)
			if err != nil {
				return err
			}

			cmd.Printf("Watching %s every %s for RPC changes...\n", filepath.ToSlash(rpcCfg.RouterPackage), interval)
			ticker := time.NewTicker(interval)
			defer ticker.Stop()

			for {
				select {
				case <-cmd.Context().Done():
					return nil
				case <-ticker.C:
					current, watchErr := latestGoFileModTime(rpcDir)
					if watchErr != nil {
						cmd.PrintErrln("RPC watch scan error:", watchErr)
						continue
					}
					if !current.After(lastSeen) {
						continue
					}
					if genErr := runRPCGen(root, name, applet, rpcCfg, cmd); genErr != nil {
						cmd.PrintErrln("RPC watch generation failed:", genErr)
						continue
					}
					lastSeen = current
				}
			}
		},
	}
	cmd.Flags().StringVar(&name, "name", "", "Applet name (required)")
	_ = cmd.MarkFlagRequired("name")
	cmd.Flags().DurationVar(&interval, "interval", time.Second, "Polling interval for watching Go RPC files")
	return cmd
}

func runRPCGen(root, name string, applet *config.AppletConfig, rpcCfg rpccodegen.Config, cmd *cobra.Command) error {
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
}

func latestGoFileModTime(dir string) (time.Time, error) {
	var (
		latest time.Time
		found  bool
	)

	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		info, infoErr := d.Info()
		if infoErr != nil {
			return infoErr
		}
		if !found || info.ModTime().After(latest) {
			latest = info.ModTime()
		}
		found = true
		return nil
	})
	if err != nil {
		return time.Time{}, err
	}
	if !found {
		return time.Time{}, fmt.Errorf("no Go files found under %s", filepath.ToSlash(dir))
	}
	return latest, nil
}
