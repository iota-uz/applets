package applet

import (
	"fmt"
	"net/url"
	"strings"
)

// ValidateAppletName checks that the applet name is non-empty and
// contains only lowercase alphanumeric characters and hyphens.
func ValidateAppletName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("applet name is empty")
	}
	return nil
}

// ValidateConfig checks that a Config is well-formed. Errors are returned
// eagerly so that misconfiguration is caught at initialization, not at
// render time.
func ValidateConfig(config Config) error {
	if strings.TrimSpace(config.WindowGlobal) == "" {
		return fmt.Errorf("WindowGlobal is required")
	}

	if err := validateShellConfig(config.Shell); err != nil {
		return fmt.Errorf("shell: %w", err)
	}

	if err := validateAssetConfig(config.Assets); err != nil {
		return fmt.Errorf("assets: %w", err)
	}

	return nil
}

func validateShellConfig(shell ShellConfig) error {
	switch shell.Mode {
	case ShellModeEmbedded:
		if shell.Layout == nil {
			return fmt.Errorf("Layout is required when Mode is embedded")
		}
	case ShellModeStandalone:
		// no extra requirements
	case "":
		return fmt.Errorf("Mode is required (embedded or standalone)")
	default:
		return fmt.Errorf("unknown Mode %q (expected embedded or standalone)", shell.Mode)
	}
	return nil
}

func validateAssetConfig(assets AssetConfig) error {
	if assets.Dev != nil && assets.Dev.Enabled {
		return validateDevAssetConfig(assets.Dev)
	}

	if assets.FS == nil {
		return fmt.Errorf("FS is required when dev proxy is disabled")
	}
	if strings.TrimSpace(assets.ManifestPath) == "" {
		return fmt.Errorf("ManifestPath is required when dev proxy is disabled")
	}
	if strings.TrimSpace(assets.Entrypoint) == "" {
		return fmt.Errorf("Entrypoint is required when dev proxy is disabled")
	}
	return nil
}

func validateDevAssetConfig(dev *DevAssetConfig) error {
	targetStr := strings.TrimSpace(dev.TargetURL)
	if targetStr == "" {
		return fmt.Errorf("dev proxy TargetURL is required")
	}
	if _, err := url.Parse(targetStr); err != nil {
		return fmt.Errorf("dev proxy TargetURL is invalid: %w", err)
	}
	return nil
}
