package validate

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/iota-uz/applets/internal/api"
)

// AppletName checks that the applet name is non-empty and valid.
func AppletName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("applet name is empty")
	}
	return nil
}

// Config checks that a Config is well-formed.
func Config(config api.Config) error {
	if strings.TrimSpace(config.WindowGlobal) == "" {
		return fmt.Errorf("WindowGlobal is required")
	}
	if err := validateShell(config.Shell); err != nil {
		return fmt.Errorf("shell: %w", err)
	}
	if err := validateAssets(config.Assets); err != nil {
		return fmt.Errorf("assets: %w", err)
	}
	return nil
}

func validateShell(shell api.ShellConfig) error {
	switch shell.Mode {
	case api.ShellModeEmbedded:
		if shell.Layout == nil {
			return fmt.Errorf("layout is required when mode is embedded")
		}
	case api.ShellModeStandalone:
		// ok
	case "":
		return fmt.Errorf("mode is required (embedded or standalone)")
	default:
		return fmt.Errorf("unknown Mode %q", shell.Mode)
	}
	return nil
}

func validateAssets(assets api.AssetConfig) error {
	if assets.Dev != nil && assets.Dev.Enabled {
		return validateDevAssets(assets.Dev)
	}
	if assets.FS == nil {
		return fmt.Errorf("FS is required when dev proxy is disabled")
	}
	if strings.TrimSpace(assets.ManifestPath) == "" {
		return fmt.Errorf("ManifestPath is required when dev proxy is disabled")
	}
	if strings.TrimSpace(assets.Entrypoint) == "" {
		return fmt.Errorf("entrypoint is required when dev proxy is disabled")
	}
	return nil
}

func validateDevAssets(dev *api.DevAssetConfig) error {
	targetStr := strings.TrimSpace(dev.TargetURL)
	if targetStr == "" {
		return fmt.Errorf("dev proxy TargetURL is required")
	}
	if _, err := url.Parse(targetStr); err != nil {
		return fmt.Errorf("dev proxy TargetURL is invalid: %w", err)
	}
	return nil
}
