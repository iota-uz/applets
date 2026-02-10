package depscheck

import (
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/iota-uz/applets/internal/applet/pkgjson"
)

var (
	exactVersionPattern          = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`)
	localSDKPackageLockPattern   = regexp.MustCompile(`@iota-uz/sdk@(file|link|workspace):`)
	localSDKSpecifierLockPattern = regexp.MustCompile(`(?s)(?:'@iota-uz/sdk'|\"@iota-uz/sdk\"|@iota-uz/sdk):\s*\n\s*specifier:\s*(file|link|workspace):`)
)

// Check walks applet web package.json files under root/modules and returns
// any SDK dependency policy violations. found is true if at least one
// presentation/web/package.json was found.
func Check(root string) (violations []string, found bool, err error) {
	modulesDir := filepath.Join(root, "modules")
	err = filepath.WalkDir(modulesDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(filepath.ToSlash(path), "/presentation/web/package.json") {
			return nil
		}
		found = true
		pv, err := checkAppletPackage(path)
		if err != nil {
			return err
		}
		violations = append(violations, pv...)
		return nil
	})
	if err != nil {
		return nil, found, err
	}
	return violations, found, nil
}

func checkAppletPackage(packagePath string) ([]string, error) {
	deps, err := pkgjson.Read(packagePath)
	if err != nil {
		return nil, err
	}
	spec := pkgjson.SDKSpec(deps)
	if spec == "" {
		return nil, nil
	}
	var violations []string
	packageRel := filepath.ToSlash(packagePath)
	if pkgjson.IsLocalSDKSpec(spec) {
		violations = append(violations,
			"Error: "+packageRel+" uses local @iota-uz/sdk dependency ("+spec+"). Use an exact npm version instead.")
	}
	if !exactVersionPattern.MatchString(spec) {
		violations = append(violations,
			"Error: "+packageRel+" must pin @iota-uz/sdk to an exact version, got "+spec+".")
	}
	lockfile := filepath.Join(filepath.Dir(packagePath), "pnpm-lock.yaml")
	lv, err := checkLockfile(lockfile)
	if err != nil {
		return nil, err
	}
	violations = append(violations, lv...)
	return violations, nil
}

func checkLockfile(lockfilePath string) ([]string, error) {
	if _, err := os.Stat(lockfilePath); err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	data, err := os.ReadFile(lockfilePath)
	if err != nil {
		return nil, err
	}
	content := string(data)
	if localSDKPackageLockPattern.MatchString(content) || localSDKSpecifierLockPattern.MatchString(content) {
		return []string{
			"Error: " + filepath.ToSlash(lockfilePath) + " contains local @iota-uz/sdk lock entries. Reinstall dependencies with npm version pinning.",
		}, nil
	}
	return nil, nil
}
