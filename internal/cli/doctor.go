package cli

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/applet/depscheck"
	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devrunner"
	"github.com/iota-uz/applets/internal/devsetup"
)

// NewDoctorCommand returns the `applet doctor` subcommand.
func NewDoctorCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Run environment and config diagnostics",
		Long: `Verifies project config, required process commands (e.g. air, templ), and Node/pnpm when applicable.
Exits with remediation hints if something is missing or invalid.`,
		Example: `  applet doctor`,
		Args:    cobra.NoArgs,
		RunE:    runDoctor,
	}
}

func runDoctor(cmd *cobra.Command, _ []string) error {
	ctx := cmd.Context()

	root, cfg, err := config.LoadFromCWD()
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			cmd.PrintErrln("No .applets/config.toml found.")
			cmd.PrintErrln("Run from the repo root and ensure .applets/config.toml exists.")
			return NewExitError(FailureCode, err)
		}
		return err
	}

	cmd.Println("Config: OK (root:", root+")")

	if err := preflightProcesses(cfg); err != nil {
		cmd.PrintErrln(err)
		return NewExitError(FailureCode, err)
	}
	cmd.Println("Process commands: OK")

	nodeMajor := 0
	if cfg.Dev.Processes != nil || len(cfg.Applets) > 0 {
		if m, err := devrunner.PreflightFromPackageJSON(root); err == nil && m > 0 {
			nodeMajor = m
		}
	}
	if nodeMajor > 0 {
		if err := devrunner.PreflightNode(ctx, nodeMajor); err != nil {
			cmd.PrintErrln(err)
			return NewExitError(FailureCode, fmt.Errorf("node: %w", err))
		}
		cmd.Printf("Node: OK (required %d+)\n", nodeMajor)
	}
	needPnpm := cfg.Dev.Processes != nil || len(cfg.Applets) > 0
	if needPnpm {
		if err := devrunner.PreflightPnpm(ctx); err != nil {
			cmd.PrintErrln(err)
			return NewExitError(FailureCode, err)
		}
		cmd.Println("pnpm: OK")
	}

	violations, _, err := depscheck.Check(root)
	if err != nil {
		return NewExitError(FailureCode, err)
	}
	if len(violations) > 0 {
		for _, v := range violations {
			cmd.PrintErrln(v)
		}
		return NewExitError(FailureCode, errors.New("dependency policy violations detected"))
	}
	cmd.Println("Dependency policy: OK")

	sdkConsumerDirs, err := discoverSDKConsumerDirs(root, cfg)
	if err != nil {
		return NewExitError(FailureCode, err)
	}
	for _, dir := range sdkConsumerDirs {
		if err := verifySDKTailwindHelpers(dir); err != nil {
			cmd.PrintErrln(err)
			return NewExitError(FailureCode, err)
		}
	}
	if len(sdkConsumerDirs) > 0 {
		cmd.Println("SDK Tailwind helpers: OK")
	}

	goWorkDependencyDirs, err := devsetup.DiscoverGoWorkDependencyDirs(root)
	if err != nil {
		return NewExitError(FailureCode, err)
	}
	if len(goWorkDependencyDirs) > 0 {
		restartTarget := cfg.FirstCriticalProcess()
		if restartTarget == "" {
			return NewExitError(FailureCode, errors.New("go.work dependencies found but no critical process is configured for restart"))
		}
		cmd.Printf("go.work watcher: enabled (%d dependencies, restart target %q)\n", len(goWorkDependencyDirs), restartTarget)
	} else {
		cmd.Println("go.work watcher: not applicable (no go.work dependencies)")
	}

	cmd.Println("All checks passed.")
	return nil
}

func verifySDKTailwindHelpers(dir string) error {
	required := []string{
		filepath.Join(dir, "node_modules", "@iota-uz", "sdk", "tailwind", "create-config.cjs"),
		filepath.Join(dir, "node_modules", "@iota-uz", "sdk", "dist", "bichat", "tailwind.mjs"),
	}
	for _, p := range required {
		if _, err := os.Stat(p); err != nil {
			if os.IsNotExist(err) {
				return fmt.Errorf("missing SDK Tailwind helper %s (run pnpm install in %s)", filepath.ToSlash(p), filepath.ToSlash(dir))
			}
			return err
		}
	}
	return nil
}
