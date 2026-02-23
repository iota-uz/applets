package devsetup

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devrunner"
)

// SetupResult holds the output of SetupApplet.
type SetupResult struct {
	Processes []devrunner.ProcessSpec
	EnvVars   map[string]string
}

// SetupApplet prepares environment variables and returns
// the process specs needed to run a single applet in dev mode.
func SetupApplet(ctx context.Context, root, name string, applet *config.AppletConfig) (*SetupResult, error) {
	webDir := filepath.Join(root, applet.Web)
	stat, err := os.Stat(webDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("web directory not found: %s", webDir)
		}
		return nil, fmt.Errorf("web directory: %w", err)
	}
	if !stat.IsDir() {
		return nil, fmt.Errorf("web path is not a directory: %s", webDir)
	}

	// Install root node_modules if missing
	if _, err := os.Stat(filepath.Join(root, "node_modules")); err != nil {
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("node_modules: %w", err)
		}
		log.Println("Installing root dependencies...")
		if err := RunCommand(ctx, root, "pnpm", "install", "--prefer-frozen-lockfile"); err != nil {
			return nil, fmt.Errorf("failed to install root deps: %w", err)
		}
	}

	upperName := strings.ToUpper(strings.ReplaceAll(name, "-", "_"))
	envVars := map[string]string{
		"APPLET_ASSETS_BASE":                              applet.BasePath + "/assets/",
		"APPLET_VITE_PORT":                                fmt.Sprintf("%d", applet.Dev.VitePort),
		fmt.Sprintf("IOTA_APPLET_DEV_%s", upperName):      "1",
		fmt.Sprintf("IOTA_APPLET_VITE_URL_%s", upperName): fmt.Sprintf("http://127.0.0.1:%d", applet.Dev.VitePort),
		fmt.Sprintf("IOTA_APPLET_ENTRY_%s", upperName):    "/src/main.tsx",
		fmt.Sprintf("IOTA_APPLET_CLIENT_%s", upperName):   "/@vite/client",
	}

	log.Printf("Applet: %s (vite :%d)\n", name, applet.Dev.VitePort)

	// copyEnv returns a shallow copy so each process has its own map and mutations do not alias.
	copyEnv := func(m map[string]string) map[string]string {
		out := make(map[string]string, len(m))
		for k, v := range m {
			out[k] = v
		}
		return out
	}

	var processes []devrunner.ProcessSpec

	// SDK watch: only if tsup.dev.config.ts exists (i.e. running from a repo that ships @iota-uz/sdk source)
	if _, err := os.Stat(filepath.Join(root, "tsup.dev.config.ts")); err == nil {
		processes = append(processes, devrunner.ProcessSpec{
			Name: "sdk", Command: "pnpm",
			Args: []string{"exec", "tsup", "--config", "tsup.dev.config.ts", "--watch"},
			Dir:  root, Color: devrunner.ColorBlue, Critical: false,
			Env: copyEnv(envVars),
		})
	}

	// Applet CSS watch: only if the applet has src/index.css
	if _, err := os.Stat(filepath.Join(webDir, "src", "index.css")); err == nil {
		processes = append(processes, devrunner.ProcessSpec{
			Name: "acss", Command: "pnpm",
			Args: []string{"-C", webDir, "exec", "tailwindcss",
				"-i", "src/index.css", "-o", "dist/style.css", "--watch"},
			Dir: root, Color: devrunner.ColorMagenta, Critical: false,
			Env: copyEnv(envVars),
		})
	}

	// Vite dev server: always required
	processes = append(processes, devrunner.ProcessSpec{
		Name: "vite", Command: "pnpm",
		Args: []string{"-C", webDir, "exec", "vite", "--host", "127.0.0.1"},
		Dir:  root, Color: devrunner.ColorGreen, Critical: true,
		Env: copyEnv(envVars),
	})

	return &SetupResult{
		Processes: processes,
		EnvVars:   envVars,
	}, nil
}
