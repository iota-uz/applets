package devsetup

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/iota-uz/applets/internal/applet/pkgjson"
)

// RefreshAppletDeps ensures applet node_modules are up to date and clears the Vite
// cache when the local SDK bundle has changed. ctx is used for cancellation of installs.
func RefreshAppletDeps(ctx context.Context, root, webDir string) error {
	nodeModules := filepath.Join(webDir, "node_modules")
	didInstall := false

	localSDKDep, err := hasLocalSDKDependency(webDir)
	if err != nil {
		return err
	}

	if _, err := os.Stat(nodeModules); err != nil {
		log.Println("Installing applet dependencies...")
		if err := RunCommand(ctx, root, "pnpm", "-C", webDir, "install", "--prefer-frozen-lockfile"); err != nil {
			return err
		}
		didInstall = true
	} else if localSDKDep {
		distIndex := filepath.Join(root, "dist", "index.mjs")
		sdkModule := filepath.Join(nodeModules, "@iota-uz", "sdk", "dist", "index.mjs")

		if IsNewer(distIndex, sdkModule) {
			log.Println("Refreshing applet deps (local @iota-uz/sdk changed)...")
			if err := RunCommand(ctx, root, "pnpm", "-C", webDir, "install", "--prefer-frozen-lockfile"); err != nil {
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
	} else if localSDKDep {
		distIndex := filepath.Join(root, "dist", "index.mjs")
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
	deps, err := pkgjson.Read(webDir)
	if err != nil {
		return false, fmt.Errorf("applet package.json: %w", err)
	}
	return pkgjson.IsLocalSDKSpec(pkgjson.SDKSpec(deps)), nil
}
