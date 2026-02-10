// Package pkgjson provides shared parsing of applet package.json for SDK dependency detection.
package pkgjson

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// PackageDeps holds dependencies and devDependencies from package.json.
type PackageDeps struct {
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
}

// Read reads package.json from the given path (e.g. webDir or path to package.json).
// If path is a directory, reads path/package.json.
func Read(path string) (*PackageDeps, error) {
	p := path
	if st, err := os.Stat(path); err == nil && st.IsDir() {
		p = filepath.Join(path, "package.json")
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, fmt.Errorf("read package.json: %w", err)
	}
	var deps PackageDeps
	if err := json.Unmarshal(data, &deps); err != nil {
		return nil, fmt.Errorf("parse package.json: %w", err)
	}
	return &deps, nil
}

// SDKSpec returns the @iota-uz/sdk version specifier from deps (dependencies or devDependencies), or "" if absent.
func SDKSpec(d *PackageDeps) string {
	if d == nil {
		return ""
	}
	spec := d.Dependencies["@iota-uz/sdk"]
	if spec == "" {
		spec = d.DevDependencies["@iota-uz/sdk"]
	}
	return spec
}

// IsLocalSDKSpec returns true if the spec is a file:, link:, or workspace: reference.
func IsLocalSDKSpec(spec string) bool {
	return strings.HasPrefix(spec, "file:") ||
		strings.HasPrefix(spec, "link:") ||
		strings.HasPrefix(spec, "workspace:")
}
