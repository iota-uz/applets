package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devsetup"
)

type sdkPackageMeta struct {
	Name string `json:"name"`
}

func NewSDKCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "sdk",
		Short: "Manage local @iota-uz/sdk alias mode",
		Long: `Manage local @iota-uz/sdk runtime aliasing for fast iteration.

These commands only write local env overrides to .applets/local.env (gitignored).
They never touch package.json, lockfiles, or pnpm resolution.`,
	}

	localCmd := &cobra.Command{
		Use:   "local",
		Short: "Enable or disable local SDK alias mode",
		Long: `Enable local SDK alias mode for frontend applets by writing APPLET_SDK_ROOT
and IOTA_SDK_DIST to .applets/local.env (gitignored).

Use --off to disable and remove local overrides.`,
		Example: "  applet sdk local --sdk-root ../../applets\n  applet sdk local --off",
		RunE: func(c *cobra.Command, _ []string) error {
			off, err := c.Flags().GetBool("off")
			if err != nil {
				return err
			}
			sdkRootFlag, err := c.Flags().GetString("sdk-root")
			if err != nil {
				return err
			}
			if off {
				return runSDKLocalDisable(c)
			}
			return runSDKLocalEnable(c, sdkRootFlag)
		},
	}
	localCmd.Flags().Bool("off", false, "Disable local SDK alias mode and remove .applets/local.env overrides")
	localCmd.Flags().String("sdk-root", "", "Path to local applets repository (canonical @iota-uz/sdk source)")

	cmd.AddCommand(localCmd)
	return cmd
}

func runSDKLocalEnable(cmd *cobra.Command, sdkRootFlag string) error {
	root, _, err := config.LoadFromCWD()
	if err != nil {
		return err
	}

	sdkRoot, err := resolveSDKRoot(root, sdkRootFlag)
	if err != nil {
		return err
	}

	cmd.Printf("Preparing SDK dist in %s\n", sdkRoot)
	if err := devsetup.BuildSDKIfNeeded(cmd.Context(), sdkRoot); err != nil {
		return fmt.Errorf("prepare SDK dist in %s: %w", sdkRoot, err)
	}

	localEnv := map[string]string{
		"APPLET_SDK_ROOT": sdkRoot,
		"IOTA_SDK_DIST":   filepath.Join(sdkRoot, "dist"),
	}
	if err := writeLocalEnvFile(root, localEnv); err != nil {
		return err
	}
	cmd.Printf("Saved local overrides to %s\n", localEnvPath(root))
	cmd.Println("Enabled local SDK alias mode. `applet dev` will alias @iota-uz/sdk via IOTA_SDK_DIST.")
	return nil
}

func runSDKLocalDisable(cmd *cobra.Command) error {
	root, _, err := config.LoadFromCWD()
	if err != nil {
		return err
	}

	if err := os.Remove(localEnvPath(root)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove %s: %w", localEnvPath(root), err)
	}
	cmd.Println("Local SDK alias mode disabled.")
	return nil
}

func resolveSDKRoot(root, sdkRootFlag string) (string, error) {
	var candidates []string
	if strings.TrimSpace(sdkRootFlag) != "" {
		candidates = append(candidates, sdkRootFlag)
	} else if fromEnv := strings.TrimSpace(os.Getenv("APPLET_SDK_ROOT")); fromEnv != "" {
		candidates = append(candidates, fromEnv)
	} else {
		candidates = append(candidates,
			root,
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
			return absCandidate, nil
		}
	}

	return "", errors.New("could not find canonical @iota-uz/sdk source; pass --sdk-root or set APPLET_SDK_ROOT")
}

func readPackageName(dir string) (string, error) {
	p := filepath.Join(dir, "package.json")
	data, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	var meta sdkPackageMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return "", err
	}
	return strings.TrimSpace(meta.Name), nil
}
