package cli

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/applet/rpccodegen"
	"github.com/iota-uz/applets/internal/config"
)

const defaultRouterFunc = "Router"

// NewRPCCommand returns the rpc command with gen and check subcommands.
func NewRPCCommand() *cobra.Command {
	rpcCmd := &cobra.Command{
		Use:   "rpc",
		Short: "RPC contract generation and validation",
		Long:  `Generate TypeScript RPC contracts from applet routers or check that generated files are up to date.`,
		Example: `  applet rpc gen --name bichat
  applet rpc gen
  applet rpc check --name bichat
  applet rpc check`,
	}

	var name, routerFunc string

	genCmd := &cobra.Command{
		Use:   "gen",
		Short: "Generate RPC contract TypeScript from applet router",
		Long: `Generates the RPC contract TypeScript file from the applet's Go router.
When --name is omitted, generates for all applets in .applets/config.toml.
When only one applet is configured, uses it automatically.`,
		Example: `  applet rpc gen --name bichat
  applet rpc gen`,
		RunE: runRPCGen(&name, &routerFunc),
	}
	genCmd.Flags().StringVar(&name, "name", "", "Applet name (e.g. bichat); omit to generate all")
	genCmd.Flags().StringVar(&routerFunc, "router-func", defaultRouterFunc, "Router factory function name in applet rpc package")
	rpcCmd.AddCommand(genCmd)

	checkCmd := &cobra.Command{
		Use:   "check",
		Short: "Check that RPC contract is up to date",
		Long: `Verifies that the generated RPC contract file matches what would be generated from the applet router.
When --name is omitted, checks all applets in .applets/config.toml.
Exits non-zero if drift is detected.`,
		Example: `  applet rpc check --name bichat
  applet rpc check`,
		RunE: runRPCCheck(&name, &routerFunc),
	}
	checkCmd.Flags().StringVar(&name, "name", "", "Applet name (e.g. bichat); omit to check all")
	checkCmd.Flags().StringVar(&routerFunc, "router-func", defaultRouterFunc, "Router factory function name in applet rpc package")
	rpcCmd.AddCommand(checkCmd)

	return rpcCmd
}

// resolveRPCTargets returns the root, and a list of (name, routerFunc) pairs to process.
// It tries .applets/config.toml first, then falls back to go.mod-based root discovery.
// The fallback is intentional for backward compatibility: repos that haven't adopted
// .applets/config.toml yet can still use `applet rpc gen --name <name>`.
func resolveRPCTargets(flagName, flagRouterFunc string) (string, []rpcTarget, error) {
	root, err := config.FindRoot()
	if err != nil {
		root, err = rpccodegen.FindProjectRoot()
		if err != nil {
			return "", nil, err
		}
	}

	if flagName != "" {
		if err := rpccodegen.ValidateAppletName(flagName); err != nil {
			return "", nil, InvalidUsage(err)
		}
		return root, []rpcTarget{{name: flagName, routerFunc: flagRouterFunc}}, nil
	}

	// No --name: resolve from config
	cfg, err := config.Load(root)
	if err != nil {
		return "", nil, fmt.Errorf("--name not specified and config not available: %w", err)
	}

	names := cfg.AppletNames()
	if len(names) == 0 {
		return "", nil, errors.New("no applets configured in .applets/config.toml")
	}

	targets := make([]rpcTarget, 0, len(names))
	for _, n := range names {
		rf := cfg.Applets[n].RPC.RouterFunc
		targets = append(targets, rpcTarget{name: n, routerFunc: rf})
	}
	return root, targets, nil
}

type rpcTarget struct {
	name       string
	routerFunc string
}

func runRPCGen(name, routerFunc *string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		root, targets, err := resolveRPCTargets(*name, *routerFunc)
		if err != nil {
			return err
		}

		var errs []string
		for _, t := range targets {
			if err := doRPCGen(cmd, root, t.name, t.routerFunc); err != nil {
				errs = append(errs, fmt.Sprintf("%s: %v", t.name, err))
			}
		}
		if len(errs) > 0 {
			return NewExitError(FailureCode, fmt.Errorf("rpc gen failures:\n%s", strings.Join(errs, "\n")))
		}
		return nil
	}
}

func doRPCGen(cmd *cobra.Command, root, name, routerFunc string) error {
	cfg, err := rpccodegen.BuildRPCConfig(root, name, routerFunc)
	if err != nil {
		return err
	}
	if err := rpccodegen.EnsureParentDir(root, cfg.TargetOut); err != nil {
		return err
	}
	targetPath := filepath.Join(root, cfg.TargetOut)
	if err := rpccodegen.RunTypegen(root, cfg, targetPath); err != nil {
		return err
	}
	if cfg.Name == "bichat" {
		moduleAbs := filepath.Join(root, cfg.ModuleOut)
		if err := rpccodegen.EnsureParentDir(root, cfg.ModuleOut); err != nil {
			return err
		}
		if err := os.WriteFile(moduleAbs, []byte(rpccodegen.BichatReexportContent(cfg.TypeName)), 0o644); err != nil {
			return err
		}
	}
	cmd.Println("RPC contract generated:", cfg.Name)
	return nil
}

func runRPCCheck(name, routerFunc *string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		root, targets, err := resolveRPCTargets(*name, *routerFunc)
		if err != nil {
			return err
		}

		var errs []string
		for _, t := range targets {
			if err := doRPCCheck(cmd, root, t.name, t.routerFunc); err != nil {
				errs = append(errs, fmt.Sprintf("%s: %v", t.name, err))
			}
		}
		if len(errs) > 0 {
			return NewExitError(FailureCode, fmt.Errorf("rpc check failures:\n%s", strings.Join(errs, "\n")))
		}
		return nil
	}
}

func doRPCCheck(cmd *cobra.Command, root, name, routerFunc string) error {
	cfg, err := rpccodegen.BuildRPCConfig(root, name, routerFunc)
	if err != nil {
		return err
	}
	if err := checkRPCDrift(root, name, cfg); err != nil {
		return err
	}
	cmd.Println("RPC contract is up to date:", cfg.Name)
	return nil
}
