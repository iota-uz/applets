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
// webDir may be relative to root; it is resolved to an absolute path before any FS use.
func RefreshAppletDeps(ctx context.Context, root, webDir, localSDKRoot string) error {
	if !filepath.IsAbs(webDir) {
		webDir = filepath.Join(root, webDir)
	}
	nodeModules := filepath.Join(webDir, "node_modules")
	didInstall := false
	usesSDK, err := hasSDKDependency(webDir)
	if err != nil {
		return err
	}
	usingManagedLocalSDK, err := hasManagedLocalSDKPackage(webDir)
	if err != nil {
		return err
	}

	localSDKDistIndex := resolveLocalSDKDistIndex(localSDKRoot)

	if _, err := os.Stat(nodeModules); err != nil {
		log.Println("Installing applet dependencies...")
		if err := RunCommand(ctx, root, "pnpm", "-C", webDir, "install", "--prefer-frozen-lockfile"); err != nil {
			return err
		}
		didInstall = true
	}

	if usesSDK && localSDKRoot == "" && usingManagedLocalSDK {
		log.Println("Restoring published @iota-uz/sdk package (no local SDK source detected)...")
		if err := RunCommand(ctx, root, "pnpm", "-C", webDir, "install", "--prefer-frozen-lockfile"); err != nil {
			return err
		}
		didInstall = true
	}

	didLinkLocalSDK := false
	if usesSDK && localSDKRoot != "" {
		changed, err := ensureLocalSDKPackage(webDir, localSDKRoot)
		if err != nil {
			return err
		}
		didLinkLocalSDK = changed
	}

	viteCache := filepath.Join(nodeModules, ".vite")
	if didInstall || didLinkLocalSDK {
		if err := os.RemoveAll(viteCache); err != nil {
			log.Printf("warning: failed to clear Vite cache after install: %v", err)
		}
	} else if localSDKDistIndex != "" {
		if IsNewer(localSDKDistIndex, viteCache) {
			log.Println("Clearing Vite dep cache (SDK bundle changed)...")
			if err := os.RemoveAll(viteCache); err != nil {
				log.Printf("warning: failed to clear Vite cache: %v", err)
			}
		}
	}

	return nil
}

func resolveLocalSDKDistIndex(localSDKRoot string) string {
	if localSDKRoot != "" {
		return filepath.Join(localSDKRoot, "dist", "index.mjs")
	}
	return ""
}

// hasSDKDependency checks whether the applet declares @iota-uz/sdk at all.
func hasSDKDependency(webDir string) (bool, error) {
	deps, err := pkgjson.Read(webDir)
	if err != nil {
		return false, fmt.Errorf("applet package.json: %w", err)
	}
	return pkgjson.SDKSpec(deps) != "", nil
}
