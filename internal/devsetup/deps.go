package devsetup

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type packageDeps struct {
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
}

// RefreshAppletDeps ensures applet node_modules are up to date and clears the Vite
// cache when the local SDK bundle has changed.
func RefreshAppletDeps(root, webDir string) error {
	nodeModules := filepath.Join(webDir, "node_modules")
	didInstall := false

	localSDKDep, err := hasLocalSDKDependency(webDir)
	if err != nil {
		return err
	}

	if _, err := os.Stat(nodeModules); err != nil {
		log.Println("Installing applet dependencies...")
		if err := RunCommand(context.Background(), root, "pnpm", "-C", webDir, "install", "--prefer-frozen-lockfile"); err != nil {
			return err
		}
		didInstall = true
	} else if localSDKDep {
		distIndex := filepath.Join(root, "dist/index.mjs")
		sdkModule := filepath.Join(nodeModules, "@iota-uz/sdk/dist/index.mjs")

		if IsNewer(distIndex, sdkModule) {
			log.Println("Refreshing applet deps (local @iota-uz/sdk changed)...")
			if err := RunCommand(context.Background(), root, "pnpm", "-C", webDir, "install", "--prefer-frozen-lockfile"); err != nil {
				return err
			}
			didInstall = true
		}
	}

	viteCache := filepath.Join(nodeModules, ".vite")
	if didInstall {
		if err := os.RemoveAll(viteCache); err != nil {
			log.Printf("warning: failed to clear Vite cache after install: %v", err)
		}
	} else {
		distIndex := filepath.Join(root, "dist/index.mjs")
		if IsNewer(distIndex, viteCache) {
			log.Println("Clearing Vite dep cache (SDK bundle changed)...")
			if err := os.RemoveAll(viteCache); err != nil {
				log.Printf("warning: failed to clear Vite cache: %v", err)
			}
		}
	}

	return nil
}

// hasLocalSDKDependency checks whether the applet uses a file:/link:/workspace: specifier for @iota-uz/sdk.
func hasLocalSDKDependency(webDir string) (bool, error) {
	packageJSONPath := filepath.Join(webDir, "package.json")
	data, err := os.ReadFile(packageJSONPath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to read applet package.json: %w", err)
	}

	var deps packageDeps
	if err := json.Unmarshal(data, &deps); err != nil {
		return false, fmt.Errorf("failed to parse applet package.json: %w", err)
	}

	spec := deps.Dependencies["@iota-uz/sdk"]
	if spec == "" {
		spec = deps.DevDependencies["@iota-uz/sdk"]
	}

	return strings.HasPrefix(spec, "file:") ||
		strings.HasPrefix(spec, "link:") ||
		strings.HasPrefix(spec, "workspace:"), nil
}
