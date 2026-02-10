package cli

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/applet/rpccodegen"
)

const defaultRouterFunc = "Router"

// NewRPCCommand returns the rpc command with gen and check subcommands.
func NewRPCCommand() *cobra.Command {
	rpcCmd := &cobra.Command{
		Use:   "rpc",
		Short: "RPC contract generation and validation",
		Long:  `Generate TypeScript RPC contracts from applet routers or check that generated files are up to date.`,
		Example: `  applet rpc gen --name bichat
  applet rpc check --name bichat`,
	}

	var name, routerFunc string

	genCmd := &cobra.Command{
		Use:   "gen",
		Short: "Generate RPC contract TypeScript from applet router",
		Long:  `Generates the RPC contract TypeScript file from the applet's Go router. Run from the repo that contains the applet (e.g. iota-sdk or eai).`,
		Example: `  applet rpc gen --name bichat`,
		RunE:   runRPCGen(&name, &routerFunc),
	}
	genCmd.Flags().StringVar(&name, "name", "", "Applet name (e.g. bichat)")
	_ = genCmd.MarkFlagRequired("name")
	genCmd.Flags().StringVar(&routerFunc, "router-func", defaultRouterFunc, "Router factory function name in applet rpc package")
	rpcCmd.AddCommand(genCmd)

	checkCmd := &cobra.Command{
		Use:   "check",
		Short: "Check that RPC contract is up to date",
		Long:  `Verifies that the generated RPC contract file matches what would be generated from the applet router. Exits non-zero if drift is detected.`,
		Example: `  applet rpc check --name bichat`,
		RunE:   runRPCCheck(&name, &routerFunc),
	}
	checkCmd.Flags().StringVar(&name, "name", "", "Applet name (e.g. bichat)")
	_ = checkCmd.MarkFlagRequired("name")
	checkCmd.Flags().StringVar(&routerFunc, "router-func", defaultRouterFunc, "Router factory function name in applet rpc package")
	rpcCmd.AddCommand(checkCmd)

	return rpcCmd
}

func runRPCGen(name, routerFunc *string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		if err := rpccodegen.ValidateAppletName(*name); err != nil {
			return InvalidUsage(err)
		}
		root, err := rpccodegen.FindProjectRoot()
		if err != nil {
			return err
		}
		cfg, err := rpccodegen.BuildRPCConfig(root, *name, *routerFunc)
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
}

func runRPCCheck(name, routerFunc *string) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		if err := rpccodegen.ValidateAppletName(*name); err != nil {
			return InvalidUsage(err)
		}
		root, err := rpccodegen.FindProjectRoot()
		if err != nil {
			return err
		}
		cfg, err := rpccodegen.BuildRPCConfig(root, *name, *routerFunc)
		if err != nil {
			return err
		}
		targetAbs := filepath.Join(root, cfg.TargetOut)
		if _, err := os.Stat(targetAbs); err != nil {
			if os.IsNotExist(err) {
				return errors.New("RPC target file does not exist: " + cfg.TargetOut + "\nRun: applet rpc gen --name " + cfg.Name)
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
		defer func() {
			_ = os.Remove(tmpPath)
		}()
		if err := rpccodegen.RunTypegen(root, cfg, tmpPath); err != nil {
			return err
		}
		targetBytes, err := os.ReadFile(targetAbs)
		if err != nil {
			return err
		}
		var expectedBytes []byte
		if cfg.Name == "bichat" && cfg.TargetOut == cfg.ModuleOut {
			expectedBytes = []byte(rpccodegen.BichatReexportContent(cfg.TypeName))
		} else {
			tmpBytes, err := os.ReadFile(tmpPath)
			if err != nil {
				return err
			}
			expectedBytes = tmpBytes
		}
		if !bytes.Equal(targetBytes, expectedBytes) {
			return errors.New("RPC contract drift detected for applet: " + cfg.Name + "\nRun: applet rpc gen --name " + cfg.Name)
		}
		if cfg.Name == "bichat" && cfg.TargetOut != cfg.ModuleOut {
			moduleAbs := filepath.Join(root, cfg.ModuleOut)
			if _, err := os.Stat(moduleAbs); err == nil {
				actual, readErr := os.ReadFile(moduleAbs)
				if readErr != nil {
					return readErr
				}
				expected := rpccodegen.BichatReexportContent(cfg.TypeName)
				if string(actual) != expected {
					return errors.New("BiChat module rpc.generated.ts must be a re-export shim.\nRun: applet rpc gen --name " + cfg.Name)
				}
			} else if !os.IsNotExist(err) {
				return err
			}
		}
		cmd.Println("RPC contract is up to date:", cfg.Name)
		return nil
	}
}
