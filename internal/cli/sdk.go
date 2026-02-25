package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/applet/pkgjson"
	"github.com/iota-uz/applets/internal/config"
	"github.com/iota-uz/applets/internal/devsetup"
)

type sdkPackageMeta struct {
	Name string `json:"name"`
}

func NewSDKCommand() *cobra.Command {
	var sdkRootFlag string
	cmd := &cobra.Command{
		Use:   "sdk",
		Short: "Manage local @iota-uz/sdk linking",
		Long: `Manage local @iota-uz/sdk link workflows for fast iteration.

These commands avoid package.json mutations and keep local overrides in .applets/local.env.`,
	}
	cmd.PersistentFlags().StringVar(&sdkRootFlag, "sdk-root", "", "Path to local applets repository (canonical @iota-uz/sdk source)")

	linkCmd := &cobra.Command{
		Use:     "link",
		Short:   "Link local @iota-uz/sdk into applet consumers",
		Example: "  applet sdk link --sdk-root ../../applets",
		RunE: func(c *cobra.Command, _ []string) error {
			return runSDKLink(c, sdkRootFlag)
		},
	}
	unlinkCmd := &cobra.Command{
		Use:     "unlink",
		Short:   "Unlink local @iota-uz/sdk and restore pinned versions",
		Example: "  applet sdk unlink",
		RunE: func(c *cobra.Command, _ []string) error {
			return runSDKUnlink(c, sdkRootFlag)
		},
	}

	cmd.AddCommand(linkCmd, unlinkCmd)
	return cmd
}

func runSDKLink(cmd *cobra.Command, sdkRootFlag string) error {
	root, cfg, err := config.LoadFromCWD()
	if err != nil {
		return err
	}
	ctx := cmd.Context()

	sdkRoot, err := resolveSDKRoot(root, sdkRootFlag)
	if err != nil {
		return err
	}
	targets, err := discoverSDKTargets(root, cfg)
	if err != nil {
		return err
	}
	if len(targets) == 0 {
		return errors.New("no package.json files with @iota-uz/sdk dependency found")
	}
	linkTargets, skippedTargets := filterLinkableSDKTargets(targets, sdkRoot)
	for _, skipped := range skippedTargets {
		cmd.Printf("Skipping %s: %s\n", skipped.dir, skipped.reason)
	}
	if len(linkTargets) == 0 {
		return errors.New("no linkable @iota-uz/sdk consumer targets found")
	}

	cmd.Printf("Registering @iota-uz/sdk globally from %s\n", sdkRoot)
	cmd.Println("Refreshing global @iota-uz/sdk link state")
	_ = devsetup.RunCommand(ctx, sdkRoot, "pnpm", "unlink", "--global")
	if err := devsetup.RunCommand(ctx, sdkRoot, "pnpm", "link", "--global"); err != nil {
		return fmt.Errorf("pnpm link --global in %s: %w", sdkRoot, err)
	}

	for _, dir := range linkTargets {
		cmd.Printf("Linking @iota-uz/sdk in %s\n", dir)
		_ = devsetup.RunCommand(ctx, root, "pnpm", "-C", dir, "unlink", "@iota-uz/sdk")
		if err := devsetup.RunCommand(ctx, root, "pnpm", "-C", dir, "link", "--global", "@iota-uz/sdk"); err != nil {
			return fmt.Errorf("link @iota-uz/sdk in %s: %w\nhint: if this target has no `name` in package.json, add one or remove @iota-uz/sdk from that root manifest", dir, err)
		}
	}

	localEnv := map[string]string{
		"APPLET_SDK_ROOT":      sdkRoot,
		"APPLET_SDK_LINK_MODE": "global",
		"IOTA_SDK_DIST":        filepath.Join(sdkRoot, "dist"),
	}
	if err := writeLocalEnvFile(root, localEnv); err != nil {
		return err
	}
	cmd.Printf("Saved local overrides to %s\n", localEnvPath(root))
	return nil
}

func runSDKUnlink(cmd *cobra.Command, sdkRootFlag string) error {
	root, cfg, err := config.LoadFromCWD()
	if err != nil {
		return err
	}
	ctx := cmd.Context()

	targets, err := discoverSDKTargets(root, cfg)
	if err != nil {
		return err
	}
	if len(targets) == 0 {
		cmd.Println("No @iota-uz/sdk consumers found. Nothing to unlink.")
		return nil
	}

	for _, dir := range targets {
		cmd.Printf("Unlinking @iota-uz/sdk in %s\n", dir)
		if err := devsetup.RunCommand(ctx, root, "pnpm", "-C", dir, "unlink", "@iota-uz/sdk"); err != nil {
			cmd.Printf("Warning: unlink failed in %s: %v\n", dir, err)
		}
		cmd.Printf("Reinstalling pinned dependencies in %s\n", dir)
		if err := devsetup.RunCommand(ctx, root, "pnpm", "-C", dir, "install", "--frozen-lockfile"); err != nil {
			return fmt.Errorf("restore deps in %s: %w", dir, err)
		}
	}

	sdkRoot, err := resolveSDKRootFromLocalOrFlags(root, sdkRootFlag)
	if err == nil && sdkRoot != "" {
		_ = devsetup.RunCommand(ctx, sdkRoot, "pnpm", "unlink", "--global")
	}

	if err := os.Remove(localEnvPath(root)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove %s: %w", localEnvPath(root), err)
	}
	cmd.Println("Local SDK link removed.")
	return nil
}

func discoverSDKTargets(root string, cfg *config.ProjectConfig) ([]string, error) {
	seen := make(map[string]struct{})
	addIfConsumer := func(dir string) error {
		deps, err := pkgjson.Read(dir)
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return nil
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

func resolveSDKRootFromLocalOrFlags(root, sdkRootFlag string) (string, error) {
	if strings.TrimSpace(sdkRootFlag) != "" {
		return resolveSDKRoot(root, sdkRootFlag)
	}
	localEnv, err := readLocalEnvFile(root)
	if err == nil {
		if savedRoot := strings.TrimSpace(localEnv["APPLET_SDK_ROOT"]); savedRoot != "" {
			return resolveSDKRoot(root, savedRoot)
		}
	}
	return resolveSDKRoot(root, "")
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

type skippedSDKTarget struct {
	dir    string
	reason string
}

func filterLinkableSDKTargets(targets []string, sdkRoot string) (linkable []string, skipped []skippedSDKTarget) {
	normalizedSDKRoot, _ := filepath.Abs(sdkRoot)
	for _, dir := range targets {
		absDir, err := filepath.Abs(dir)
		if err != nil {
			skipped = append(skipped, skippedSDKTarget{
				dir:    dir,
				reason: "could not resolve absolute path",
			})
			continue
		}
		if absDir == normalizedSDKRoot {
			skipped = append(skipped, skippedSDKTarget{
				dir:    absDir,
				reason: "canonical @iota-uz/sdk source is not a consumer target",
			})
			continue
		}
		name, err := readPackageName(absDir)
		if err != nil {
			skipped = append(skipped, skippedSDKTarget{
				dir:    absDir,
				reason: "could not read package.json name",
			})
			continue
		}
		if name == "" {
			skipped = append(skipped, skippedSDKTarget{
				dir:    absDir,
				reason: "package.json has no `name`; pnpm global link is unreliable for unnamed importers",
			})
			continue
		}
		linkable = append(linkable, absDir)
	}
	sort.Strings(linkable)
	sort.Slice(skipped, func(i, j int) bool { return skipped[i].dir < skipped[j].dir })
	return linkable, skipped
}
