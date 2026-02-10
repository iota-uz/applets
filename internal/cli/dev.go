package cli

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devrunner"
	"github.com/iota-uz/applets/internal/devsetup"
)

// NewDevCommand returns the `applet dev [name]` subcommand.
func NewDevCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "dev [name]",
		Short: "Start development environment",
		Long: `Start the development environment for the project.

Without a name, starts only the project-level processes (e.g. air, templ, css).
With a name, also starts the applet's Vite dev server, SDK watcher, and applet CSS.`,
		Example: `  applet dev
  applet dev bichat`,
		Args: cobra.MaximumNArgs(1),
		RunE: runDev,
	}
}

func runDev(cmd *cobra.Command, args []string) error {
	root, err := config.FindRoot()
	if err != nil {
		return err
	}

	cfg, err := config.Load(root)
	if err != nil {
		return err
	}

	var appletName string
	if len(args) > 0 {
		appletName = args[0]
	}

	// Validate applet exists in config
	if appletName != "" {
		if _, ok := cfg.Applets[appletName]; !ok {
			names := cfg.AppletNames()
			return fmt.Errorf("unknown applet %q (available: %s)", appletName, strings.Join(names, ", "))
		}
	}

	// Preflight: check configured process commands are in PATH
	if err := preflightProcesses(cfg); err != nil {
		return err
	}

	// If applet given, also check node/pnpm
	if appletName != "" {
		if err := preflightNodeTools(); err != nil {
			return err
		}
	}

	// Build project-level process specs
	processes := make([]devrunner.ProcessSpec, 0, len(cfg.Dev.Processes))
	for _, p := range cfg.Dev.Processes {
		processes = append(processes, devrunner.ProcessSpec{
			Name:     p.Name,
			Command:  p.Command,
			Args:     p.Args,
			Dir:      root,
			Color:    colorForProcess(p.Name),
			Critical: p.Critical,
			Env:      p.Env,
		})
	}

	// If applet specified, set it up
	if appletName != "" {
		applet := cfg.Applets[appletName]

		if err := devsetup.BuildSDKIfNeeded(cmd.Context(), root); err != nil {
			return fmt.Errorf("sdk build failed: %w", err)
		}

		webDir := filepath.Join(root, applet.Web)
		if err := devsetup.RefreshAppletDeps(cmd.Context(), root, webDir); err != nil {
			return fmt.Errorf("applet dep refresh failed: %w", err)
		}

		if err := devsetup.CheckPort(cmd.Context(), applet.Dev.VitePort, "Vite"); err != nil {
			return err
		}

		backendPort := devsetup.GetEnvOrDefault("IOTA_PORT", devsetup.GetEnvOrDefault("PORT", fmt.Sprintf("%d", cfg.Dev.BackendPort)))
		result, err := devsetup.SetupApplet(cmd.Context(), root, appletName, applet, backendPort)
		if err != nil {
			return err
		}

		// Propagate applet env vars to project-level processes (e.g. air needs IOTA_APPLET_DEV_*)
		// instead of polluting the parent process via os.Setenv.
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

	// Determine restart target: first critical process
	restartTarget := cfg.FirstCriticalProcess()

	ctx, cancel := devrunner.NotifyContext(context.Background())
	defer cancel()

	// CLI already checks tools are in PATH (preflightProcesses, preflightNodeTools).
	// Devrunner preflight is disabled to avoid duplicate checks.
	runOpts := &devrunner.RunOptions{
		RestartProcessName: restartTarget,
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
