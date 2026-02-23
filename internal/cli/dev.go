package cli

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devrunner"
	"github.com/iota-uz/applets/internal/devsetup"
)

// NewDevCommand returns the `applet dev` subcommand.
func NewDevCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "dev",
		Short: "Start development environment",
		Long: `Start the development environment for the project.

Starts project-level processes (e.g. air, templ, css) and all configured applets
(Vite dev servers, SDK watchers, applet CSS).`,
		Example: `  applet dev
  applet dev --rpc-watch`,
		Args: cobra.NoArgs,
		RunE: runDev,
	}
	cmd.Flags().Bool("rpc-watch", false, "Enable applet RPC codegen watch processes")
	return cmd
}

func runDev(cmd *cobra.Command, args []string) error {
	rpcWatch, err := cmd.Flags().GetBool("rpc-watch")
	if err != nil {
		return err
	}

	root, cfg, err := config.LoadFromCWD()
	if err != nil {
		return err
	}
	if err := loadLocalEnv(root); err != nil {
		return err
	}

	// Preflight: check configured process commands are in PATH
	if err := preflightProcesses(cfg); err != nil {
		return err
	}

	appletNames := cfg.AppletNames()

	// If there are applets, check node/pnpm and build SDK once upfront
	if len(appletNames) > 0 {
		if err := preflightNodeTools(); err != nil {
			return err
		}
		if err := devsetup.BuildSDKIfNeeded(cmd.Context(), root); err != nil {
			return fmt.Errorf("sdk build failed: %w", err)
		}
	}

	// Build project-level process specs (clone env maps so applet injection doesn't mutate config).
	processes := make([]devrunner.ProcessSpec, 0, len(cfg.Dev.Processes))
	for _, p := range cfg.Dev.Processes {
		var env map[string]string
		if len(p.Env) > 0 {
			env = make(map[string]string, len(p.Env))
			for k, v := range p.Env {
				env[k] = v
			}
		}
		processes = append(processes, devrunner.ProcessSpec{
			Name:     p.Name,
			Command:  p.Command,
			Args:     p.Args,
			Dir:      root,
			Color:    colorForProcess(p.Name),
			Critical: p.Critical,
			Env:      env,
		})
	}

	// Set up each configured applet
	for _, name := range appletNames {
		applet := cfg.Applets[name]

		if err := devsetup.RefreshAppletDeps(cmd.Context(), root, applet.Web); err != nil {
			return fmt.Errorf("applet %s dep refresh failed: %w", name, err)
		}

		if err := devsetup.CheckPort(cmd.Context(), applet.Dev.VitePort, fmt.Sprintf("Vite (%s)", name)); err != nil {
			return err
		}

		result, err := devsetup.SetupApplet(cmd.Context(), root, name, applet)
		if err != nil {
			return fmt.Errorf("applet %s setup failed: %w", name, err)
		}

		// Propagate applet env vars to project-level processes (e.g. air needs IOTA_APPLET_DEV_*)
		for i := range processes {
			if processes[i].Env == nil {
				processes[i].Env = make(map[string]string, len(result.EnvVars))
			}
			for k, v := range result.EnvVars {
				processes[i].Env[k] = v
			}
		}

		processes = append(processes, result.Processes...)
	}
	processes = appendRPCWatchProcesses(processes, root, appletNames, rpcWatch, resolveAppletCommand())

	// Determine restart target: first critical process
	restartTarget := cfg.FirstCriticalProcess()
	goWorkDependencyDirs, err := devsetup.DiscoverGoWorkDependencyDirs(root)
	if err != nil {
		return fmt.Errorf("go.work dependency discovery failed: %w", err)
	}
	for _, depDir := range goWorkDependencyDirs {
		tsupCfg := filepath.Join(depDir, "tsup.dev.config.ts")
		if _, statErr := os.Stat(tsupCfg); statErr != nil {
			continue
		}
		if err := devsetup.BuildSDKIfNeeded(cmd.Context(), depDir); err != nil {
			return fmt.Errorf("dependency sdk build failed (%s): %w", depDir, err)
		}
		processes = append(processes, devrunner.ProcessSpec{
			Name:     fmt.Sprintf("sdk:%s", filepath.Base(depDir)),
			Command:  "pnpm",
			Args:     []string{"-C", depDir, "exec", "tsup", "--config", "tsup.dev.config.ts", "--watch"},
			Dir:      root,
			Color:    devrunner.ColorBlue,
			Critical: false,
		})
	}

	ctx, cancel := devrunner.NotifyContext(context.Background())
	defer cancel()
	var restartSignals chan string
	if len(goWorkDependencyDirs) > 0 {
		if strings.TrimSpace(restartTarget) == "" {
			cmd.Printf("Detected go.work with %d dependencies, but no critical process is configured for restart.\n", len(goWorkDependencyDirs))
		} else {
			cmd.Printf("Watching %d go.work dependency directories for restart target %q\n", len(goWorkDependencyDirs), restartTarget)
			restartSignals = make(chan string, 4)
			go devsetup.WatchGoWorkDependencies(ctx, root, goWorkDependencyDirs, restartTarget, restartSignals)
		}
	}

	// CLI already checks tools are in PATH (preflightProcesses, preflightNodeTools).
	// Devrunner preflight is disabled to avoid duplicate checks.
	runOpts := &devrunner.RunOptions{
		RestartProcessName: restartTarget,
		RestartSignals:     restartSignals,
		ProjectRoot:        root,
	}

	exitCode, runErr := devrunner.Run(ctx, cancel, processes, runOpts)
	if runErr != nil {
		var preflightErr *devrunner.PreflightError
		if errors.As(runErr, &preflightErr) {
			return fmt.Errorf("preflight: %w", preflightErr.Err)
		}
		return runErr
	}
	if exitCode != 0 {
		return NewExitError(exitCode, nil)
	}
	return nil
}

func appendRPCWatchProcesses(processes []devrunner.ProcessSpec, root string, appletNames []string, enabled bool, appletCommand string) []devrunner.ProcessSpec {
	if !enabled {
		return processes
	}
	if strings.TrimSpace(appletCommand) == "" {
		appletCommand = "applet"
	}

	for _, name := range appletNames {
		processes = append(processes, devrunner.ProcessSpec{
			Name:     fmt.Sprintf("rpc:%s", name),
			Command:  appletCommand,
			Args:     []string{"rpc", "watch", "--name", name},
			Dir:      root,
			Color:    devrunner.ColorCyan,
			Critical: false,
		})
	}
	return processes
}

func resolveAppletCommand() string {
	executable, err := os.Executable()
	if err != nil || strings.TrimSpace(executable) == "" {
		return "applet"
	}
	return executable
}

func preflightProcesses(cfg *config.ProjectConfig) error {
	var missing []string
	for _, p := range cfg.Dev.Processes {
		if _, err := exec.LookPath(p.Command); err != nil {
			missing = append(missing, fmt.Sprintf("  %s (required by process %q)", p.Command, p.Name))
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("missing required tools:\n%s", strings.Join(missing, "\n"))
	}
	return nil
}

func preflightNodeTools() error {
	var missing []string
	tools := map[string]string{
		"node": "https://nodejs.org/",
		"pnpm": "npm install -g pnpm or enable corepack",
	}
	for cmd, install := range tools {
		if _, err := exec.LookPath(cmd); err != nil {
			missing = append(missing, fmt.Sprintf("  %s: %s", cmd, install))
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return fmt.Errorf("missing required tools:\n%s", strings.Join(missing, "\n"))
	}
	return nil
}

// colorForProcess assigns deterministic colors to known process names.
func colorForProcess(name string) string {
	switch name {
	case "air":
		return devrunner.ColorYellow
	case "templ":
		return devrunner.ColorCyan
	case "css":
		return devrunner.ColorMagenta
	case "vite":
		return devrunner.ColorGreen
	case "sdk":
		return devrunner.ColorBlue
	default:
		// Rotate through available colors
		colors := []string{devrunner.ColorCyan, devrunner.ColorMagenta, devrunner.ColorGreen, devrunner.ColorYellow, devrunner.ColorBlue}
		sum := 0
		for _, c := range name {
			sum += int(c)
		}
		return colors[sum%len(colors)]
	}
}
