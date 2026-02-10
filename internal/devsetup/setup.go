package devsetup

import (
	"context"
	"encoding/json"
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

// SetupApplet prepares environment variables, writes applet-dev.json, and returns
// the process specs needed to run a single applet in dev mode. ctx is used for cancellation of installs.
func SetupApplet(ctx context.Context, root, name string, applet *config.AppletConfig, backendPort string) (*SetupResult, error) {
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
		fmt.Sprintf("IOTA_APPLET_VITE_URL_%s", upperName): fmt.Sprintf("http://localhost:%d", applet.Dev.VitePort),
		fmt.Sprintf("IOTA_APPLET_ENTRY_%s", upperName):    applet.Entry,
		fmt.Sprintf("IOTA_APPLET_CLIENT_%s", upperName):   "/@vite/client",
	}

	// Write applet-dev.json
	backendURL := fmt.Sprintf("http://localhost:%s", backendPort)
	manifest := struct {
		BasePath   string `json:"basePath"`
		AssetsBase string `json:"assetsBase"`
		VitePort   int    `json:"vitePort"`
		BackendURL string `json:"backendUrl"`
	}{
		BasePath:   applet.BasePath,
		AssetsBase: applet.BasePath + "/assets/",
		VitePort:   applet.Dev.VitePort,
		BackendURL: backendURL,
	}
	manifestBytes, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		log.Printf("warning: could not marshal applet-dev.json: %v", err)
	} else {
		manifestPath := filepath.Join(webDir, "applet-dev.json")
		if err := os.WriteFile(manifestPath, manifestBytes, 0644); err != nil {
			log.Printf("warning: could not write %s: %v", manifestPath, err)
		}
	}

	log.Printf("Applet: %s\n", name)
	log.Printf("URL:    http://localhost:%s%s\n", backendPort, applet.BasePath)

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
		Args: []string{"-C", webDir, "exec", "vite"},
		Dir:  root, Color: devrunner.ColorGreen, Critical: true,
		Env: copyEnv(envVars),
	})

	return &SetupResult{
		Processes: processes,
		EnvVars:   envVars,
	}, nil
}
