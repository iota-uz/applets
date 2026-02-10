package manifest

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"path"

	"github.com/iota-uz/applets/internal/api"
)

// LoadManifest loads and parses a Vite manifest.json from the given FS.
func LoadManifest(manifestFS fs.FS, manifestPath string) (api.ViteManifest, error) {
	manifestBytes, err := fs.ReadFile(manifestFS, manifestPath)
	if err != nil {
		return nil, fmt.Errorf("manifest: failed to read %s: %w", manifestPath, api.ErrInternal)
	}
	var manifest api.ViteManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		return nil, fmt.Errorf("manifest: failed to parse: %w", api.ErrInternal)
	}
	return manifest, nil
}

// ResolveAssets resolves CSS and JS paths from a Vite manifest for the given entrypoint.
func ResolveAssets(manifest api.ViteManifest, entrypoint string, basePath string) (*api.ResolvedAssets, error) {
	assets := &api.ResolvedAssets{
		CSSFiles: make([]string, 0),
		JSFiles:  make([]string, 0),
	}
	var entry *api.ViteManifestEntry
	for key, e := range manifest {
		if e.Src == entrypoint || key == entrypoint {
			entry = &e
			break
		}
	}
	if entry == nil {
		return nil, fmt.Errorf("manifest: entrypoint %s not found: %w", entrypoint, api.ErrNotFound)
	}
	seenCSS := make(map[string]struct{})
	for _, cssFile := range entry.CSS {
		cssPath := path.Join(basePath, cssFile)
		if _, ok := seenCSS[cssPath]; !ok {
			seenCSS[cssPath] = struct{}{}
			assets.CSSFiles = append(assets.CSSFiles, cssPath)
		}
	}
	if entry.File != "" {
		assets.JSFiles = append(assets.JSFiles, path.Join(basePath, entry.File))
	}
	processed := make(map[string]bool)
	var processEntry func(string)
	processEntry = func(key string) {
		if processed[key] {
			return
		}
		processed[key] = true
		e, exists := manifest[key]
		if !exists {
			return
		}
		for _, cssFile := range e.CSS {
			cssPath := path.Join(basePath, cssFile)
			if _, ok := seenCSS[cssPath]; !ok {
				seenCSS[cssPath] = struct{}{}
				assets.CSSFiles = append(assets.CSSFiles, cssPath)
			}
		}
		for _, imp := range e.Imports {
			processEntry(imp)
		}
	}
	for _, imp := range entry.Imports {
		processEntry(imp)
	}
	return assets, nil
}
