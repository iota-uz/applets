package cli

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"

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
	root, err := config.FindRoot()
	if err != nil {
		return err
	}

	cfg, err := config.Load(root)
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

	// RPC check for each applet
	for _, name := range cfg.AppletNames() {
		applet := cfg.Applets[name]
		routerFunc := applet.RPC.RouterFunc
		if routerFunc == "" {
			routerFunc = "Router"
		}

		rpcCfg, err := rpccodegen.BuildRPCConfig(root, name, routerFunc)
		if err != nil {
			cmd.PrintErrln("RPC check skipped for", name+":", err)
			continue
		}

		needsReexportShim := applet.RPC != nil && applet.RPC.NeedsReexportShim
		if err := checkRPCDrift(root, name, rpcCfg, needsReexportShim); err != nil {
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

// checkRPCDrift checks if the generated RPC contract matches what would be generated.
func checkRPCDrift(root, name string, cfg rpccodegen.Config, needsReexportShim bool) error {
	targetAbs := filepath.Join(root, cfg.TargetOut)
	if _, err := os.Stat(targetAbs); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("RPC target file does not exist: %s\nRun: applet rpc gen --name %s", cfg.TargetOut, name)
		}
		return err
	}

	tmpFile, err := os.CreateTemp("", "applet-rpc-contract-*.ts")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()
	if err := tmpFile.Close(); err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmpPath) }()

	if err := rpccodegen.RunTypegen(root, cfg, tmpPath); err != nil {
		return err
	}

	targetBytes, err := os.ReadFile(targetAbs)
	if err != nil {
		return err
	}

	var expectedBytes []byte
	if needsReexportShim && cfg.TargetOut == cfg.ModuleOut {
		expectedBytes = []byte(rpccodegen.ReexportContent(cfg.TypeName, name))
	} else {
		tmpBytes, readErr := os.ReadFile(tmpPath)
		if readErr != nil {
			return readErr
		}
		expectedBytes = tmpBytes
	}

	if !bytes.Equal(targetBytes, expectedBytes) {
		return fmt.Errorf("RPC contract drift detected for applet: %s\nRun: applet rpc gen --name %s", name, name)
	}

	if needsReexportShim && cfg.TargetOut != cfg.ModuleOut {
		moduleAbs := filepath.Join(root, cfg.ModuleOut)
		if _, err := os.Stat(moduleAbs); err == nil {
			actual, readErr := os.ReadFile(moduleAbs)
			if readErr != nil {
				return readErr
			}
			expected := rpccodegen.ReexportContent(cfg.TypeName, name)
			if string(actual) != expected {
				return fmt.Errorf("applet %s module rpc.generated.ts must be a re-export shim.\nRun: applet rpc gen --name %s", name, name)
			}
		} else if !os.IsNotExist(err) {
			return err
		}
	}

	return nil
}
