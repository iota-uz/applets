package cli

import (
	"os"
	"path/filepath"
	"sort"

	"github.com/iota-uz/applets/internal/applet/pkgjson"
	"github.com/iota-uz/applets/internal/config"
)

// discoverSDKConsumerDirs returns project directories that declare @iota-uz/sdk in package.json.
func discoverSDKConsumerDirs(root string, cfg *config.ProjectConfig) ([]string, error) {
	seen := make(map[string]struct{})

	addIfConsumer := func(dir string) error {
		deps, err := pkgjson.Read(dir)
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if pkgjson.SDKSpec(deps) == "" {
			return nil
		}
		absDir, err := filepath.Abs(dir)
		if err != nil {
			return err
		}
		seen[absDir] = struct{}{}
		return nil
	}

	if err := addIfConsumer(root); err != nil {
		return nil, err
	}
	for _, name := range cfg.AppletNames() {
		webDir := filepath.Join(root, cfg.Applets[name].Web)
		if err := addIfConsumer(webDir); err != nil {
			return nil, err
		}
	}

	dirs := make([]string, 0, len(seen))
	for dir := range seen {
		dirs = append(dirs, dir)
	}
	sort.Strings(dirs)
	return dirs, nil
}
