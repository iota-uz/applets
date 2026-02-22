package depscheck

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var (
	exactVersionPattern          = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$`)
	localSDKPackageLockPattern   = regexp.MustCompile(`@iota-uz/sdk@(file|link|workspace):`)
	localSDKSpecifierLockPattern = regexp.MustCompile(`(?s)(?:'@iota-uz/sdk'|\"@iota-uz/sdk\"|@iota-uz/sdk):\s*\n\s*specifier:\s*(file|link|workspace):`)
	localSDKOverridePattern      = regexp.MustCompile(`(?m)['"]?@iota-uz/sdk['"]?\s*:\s*(file|link|workspace):`)
	machinePathPattern           = regexp.MustCompile(`(?m)(/Users/|/home/|[A-Za-z]:\\|\\Users\\|Library/pnpm/global/)`)
)

type packageManifest struct {
	Name            string            `json:"name"`
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
}

// Check validates SDK dependency/link policy for root package.json and applet web package.json files.
// found is true if @iota-uz/sdk is referenced in at least one checked package.
func Check(root string) (violations []string, found bool, err error) {
	packageFiles, err := collectPackageFiles(root)
	if err != nil {
		return nil, false, err
	}
	for _, packagePath := range packageFiles {
		pv, hasSDKDep, checkErr := checkPackage(packagePath)
		if checkErr != nil {
			return nil, found, checkErr
		}
		if hasSDKDep {
			found = true
		}
		violations = append(violations, pv...)
	}

	metaFiles, err := collectMetaFiles(root)
	if err != nil {
		return nil, found, err
	}
	for _, metaPath := range metaFiles {
		mv, checkErr := checkMetaFile(metaPath)
		if checkErr != nil {
			return nil, found, checkErr
		}
		violations = append(violations, mv...)
	}

	sort.Strings(violations)
	return violations, found, nil
}

func collectPackageFiles(root string) ([]string, error) {
	var packageFiles []string
	rootPackage := filepath.Join(root, "package.json")
	if _, err := os.Stat(rootPackage); err == nil {
		packageFiles = append(packageFiles, rootPackage)
	}

	modulesDir := filepath.Join(root, "modules")
	if _, err := os.Stat(modulesDir); err != nil {
		if os.IsNotExist(err) {
			return packageFiles, nil
		}
		return nil, err
	}
	err := filepath.WalkDir(modulesDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(filepath.ToSlash(path), "/presentation/web/package.json") {
			return nil
		}
		packageFiles = append(packageFiles, path)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(packageFiles)
	return packageFiles, nil
}

func collectMetaFiles(root string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			switch d.Name() {
			case ".git", "node_modules", "dist", "coverage", "tmp":
				return filepath.SkipDir
			}
			return nil
		}
		base := d.Name()
		if base == "pnpm-lock.yaml" || base == "pnpm-workspace.yaml" {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(files)
	return files, nil
}

func checkPackage(packagePath string) ([]string, bool, error) {
	data, err := os.ReadFile(packagePath)
	if err != nil {
		return nil, false, err
	}
	var manifest packageManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, false, fmt.Errorf("parse %s: %w", filepath.ToSlash(packagePath), err)
	}

	spec := manifest.Dependencies["@iota-uz/sdk"]
	if spec == "" {
		spec = manifest.DevDependencies["@iota-uz/sdk"]
	}

	var violations []string
	packageRel := filepath.ToSlash(packagePath)

	if manifest.Name == "@iota-uz/sdk" {
		projectDir := filepath.Base(filepath.Dir(packagePath))
		if projectDir != "applets" {
			violations = append(violations,
				"Error: "+packageRel+" declares name @iota-uz/sdk outside canonical applets repo.")
		}
	}

	if spec == "" {
		return violations, false, nil
	}
	if strings.HasPrefix(spec, "file:") || strings.HasPrefix(spec, "link:") || strings.HasPrefix(spec, "workspace:") {
		violations = append(violations,
			"Error: "+packageRel+" uses local @iota-uz/sdk dependency ("+spec+"). Use an exact npm version instead.")
	}
	if !exactVersionPattern.MatchString(spec) {
		violations = append(violations,
			"Error: "+packageRel+" must pin @iota-uz/sdk to an exact version, got "+spec+".")
	}
	if machinePathPattern.Match(data) && strings.Contains(string(data), "@iota-uz/sdk") {
		violations = append(violations,
			"Error: "+packageRel+" contains machine-specific path(s) near @iota-uz/sdk references.")
	}
	return violations, true, nil
}

func checkMetaFile(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	rel := filepath.ToSlash(path)
	content := string(data)
	var violations []string
	if localSDKPackageLockPattern.MatchString(content) ||
		localSDKSpecifierLockPattern.MatchString(content) ||
		localSDKOverridePattern.MatchString(content) {
		violations = append(violations,
			"Error: "+rel+" contains local @iota-uz/sdk link/file/workspace entries.")
	}
	if machinePathPattern.Match(data) && strings.Contains(content, "@iota-uz/sdk") {
		violations = append(violations,
			"Error: "+rel+" contains machine-specific path(s) near @iota-uz/sdk references.")
	}
	return violations, nil
}
