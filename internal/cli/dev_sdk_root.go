package cli

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/iota-uz/applets/internal/config"
)

type detectedSDKRoot struct {
	Root string
	Dist string
	Auto bool
}

// detectLocalSDKRoot returns the conventional local @iota-uz/sdk source checkout
// for projects that actually consume the SDK, without relying on env injection.
func detectLocalSDKRoot(root string, cfg *config.ProjectConfig, sdkRootFlag string) (*detectedSDKRoot, error) {
	consumerDirs, err := discoverSDKConsumerDirs(root, cfg)
	if err != nil {
		return nil, err
	}
	if len(consumerDirs) == 0 {
		return nil, nil
	}

	resolvedRoot, autoDetected, err := resolveSDKRoot(root, sdkRootFlag)
	if err != nil {
		if strings.TrimSpace(sdkRootFlag) == "" {
			return nil, nil
		}
		return nil, err
	}
	return &detectedSDKRoot{
		Root: resolvedRoot,
		Dist: filepath.Join(resolvedRoot, "dist"),
		Auto: autoDetected,
	}, nil
}

func resolveSDKRoot(root, sdkRootFlag string) (string, bool, error) {
	candidates := make([]string, 0, 5)
	autoDetected := true
	if strings.TrimSpace(sdkRootFlag) != "" {
		candidates = append(candidates, sdkRootFlag)
		autoDetected = false
	} else {
		candidates = append(candidates,
			root,
			filepath.Join(root, "applets"),
			filepath.Join(root, "..", "applets"),
			filepath.Join(root, "..", "..", "applets"),
			filepath.Join(root, "..", "..", "..", "applets"),
		)
	}

	for _, candidate := range candidates {
		absCandidate, err := filepath.Abs(candidate)
		if err != nil {
			continue
		}
		name, err := readPackageName(absCandidate)
		if err != nil {
			continue
		}
		if name == "@iota-uz/sdk" {
			return absCandidate, autoDetected, nil
		}
	}

	if !autoDetected {
		return "", false, errors.New("could not find canonical @iota-uz/sdk source at --sdk-root")
	}
	return "", false, errors.New("could not find canonical @iota-uz/sdk source in a conventional location")
}

func readPackageName(dir string) (string, error) {
	data, err := os.ReadFile(filepath.Join(dir, "package.json"))
	if err != nil {
		return "", err
	}
	type sdkPackageMeta struct {
		Name string `json:"name"`
	}
	var meta sdkPackageMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return "", err
	}
	return strings.TrimSpace(meta.Name), nil
}
