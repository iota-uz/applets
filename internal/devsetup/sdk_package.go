package devsetup

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

const localSDKMarkerFile = ".applet-managed-local-sdk-root"

func hasManagedLocalSDKPackage(webDir string) (bool, error) {
	_, managedRoot, err := readManagedLocalSDKRoot(webDir)
	if err != nil {
		return false, err
	}
	return managedRoot != "", nil
}

func ensureLocalSDKPackage(webDir, localSDKRoot string) (bool, error) {
	absSDKRoot, err := filepath.Abs(localSDKRoot)
	if err != nil {
		return false, fmt.Errorf("resolve local sdk root: %w", err)
	}

	pkgDir, managedRoot, err := readManagedLocalSDKRoot(webDir)
	if err != nil {
		return false, err
	}
	if managedRoot == absSDKRoot && localSDKPackageLooksReady(pkgDir) && !IsNewer(filepath.Join(absSDKRoot, "package.json"), filepath.Join(pkgDir, "package.json")) {
		return false, nil
	}

	if err := os.RemoveAll(pkgDir); err != nil {
		return false, fmt.Errorf("remove existing local sdk package: %w", err)
	}
	if err := os.MkdirAll(pkgDir, 0o755); err != nil {
		return false, fmt.Errorf("create local sdk package directory: %w", err)
	}

	for _, fileName := range []string{"package.json", "README.md", "LICENSE"} {
		srcPath := filepath.Join(absSDKRoot, fileName)
		if err := copyIfExists(srcPath, filepath.Join(pkgDir, fileName)); err != nil {
			return false, err
		}
	}

	for _, dirName := range []string{"dist", "tailwind", "assets"} {
		if err := symlinkIfExists(filepath.Join(absSDKRoot, dirName), filepath.Join(pkgDir, dirName)); err != nil {
			return false, err
		}
	}

	if err := os.WriteFile(filepath.Join(pkgDir, localSDKMarkerFile), []byte(absSDKRoot), 0o644); err != nil {
		return false, fmt.Errorf("write local sdk marker: %w", err)
	}

	return true, nil
}

func readManagedLocalSDKRoot(webDir string) (pkgDir string, managedRoot string, err error) {
	pkgDir = filepath.Join(webDir, "node_modules", "@iota-uz", "sdk")
	data, err := os.ReadFile(filepath.Join(pkgDir, localSDKMarkerFile))
	if err != nil {
		if os.IsNotExist(err) || errors.Is(err, fs.ErrNotExist) || errors.Is(err, syscall.ENOTDIR) {
			return pkgDir, "", nil
		}
		return pkgDir, "", fmt.Errorf("read local sdk marker: %w", err)
	}
	return pkgDir, strings.TrimSpace(string(data)), nil
}

func localSDKPackageLooksReady(pkgDir string) bool {
	for _, requiredPath := range []string{
		"package.json",
		"dist/index.mjs",
		"dist/applet/vite.mjs",
		"dist/bichat/index.mjs",
	} {
		if _, err := os.Stat(filepath.Join(pkgDir, requiredPath)); err != nil {
			return false
		}
	}
	return true
}

func copyIfExists(srcPath, dstPath string) error {
	data, err := os.ReadFile(srcPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("read %s: %w", srcPath, err)
	}
	if err := os.WriteFile(dstPath, data, 0o644); err != nil {
		return fmt.Errorf("write %s: %w", dstPath, err)
	}
	return nil
}

func symlinkIfExists(srcPath, dstPath string) error {
	if _, err := os.Stat(srcPath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("stat %s: %w", srcPath, err)
	}
	target, err := filepath.Rel(filepath.Dir(dstPath), srcPath)
	if err != nil {
		return fmt.Errorf("rel %s -> %s: %w", dstPath, srcPath, err)
	}
	if err := os.Symlink(target, dstPath); err != nil {
		return fmt.Errorf("symlink %s -> %s: %w", dstPath, target, err)
	}
	return nil
}
