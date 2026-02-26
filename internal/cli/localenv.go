package cli

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const localEnvRelativePath = ".applets/local.env"

func localEnvPath(root string) string {
	return filepath.Join(root, localEnvRelativePath)
}

func readLocalEnvFile(root string) (map[string]string, error) {
	path := localEnvPath(root)
	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]string{}, nil
		}
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer func() { _ = file.Close() }()

	envs := make(map[string]string)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.IndexByte(line, '=')
		if idx <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])
		if key == "" {
			continue
		}
		value = strings.Trim(value, `"`)
		envs[key] = value
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	return envs, nil
}

func loadLocalEnv(root string) error {
	envs, err := readLocalEnvFile(root)
	if err != nil {
		return err
	}
	for k, v := range envs {
		if _, exists := os.LookupEnv(k); exists {
			continue
		}
		if err := os.Setenv(k, v); err != nil {
			return fmt.Errorf("set env %s: %w", k, err)
		}
	}
	return nil
}

func writeLocalEnvFile(root string, env map[string]string) error {
	if err := os.MkdirAll(filepath.Join(root, ".applets"), 0o755); err != nil {
		return fmt.Errorf("mkdir .applets: %w", err)
	}
	path := localEnvPath(root)

	keys := make([]string, 0, len(env))
	for k, v := range env {
		if strings.TrimSpace(k) == "" || strings.TrimSpace(v) == "" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var b strings.Builder
	b.WriteString("# Local-only applet development overrides.\n")
	b.WriteString("# This file is gitignored and may be safely edited per developer.\n")
	for _, k := range keys {
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(env[k])
		b.WriteByte('\n')
	}

	if err := os.WriteFile(path, []byte(b.String()), 0o644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}
	return nil
}

func filterLocalEnvEntries(root string, keep func(string) bool) (bool, error) {
	path := localEnvPath(root)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("read %s: %w", path, err)
	}

	lines := strings.Split(string(data), "\n")
	filtered := make([]string, 0, len(lines))
	removed := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			filtered = append(filtered, line)
			continue
		}
		idx := strings.IndexByte(line, '=')
		if idx <= 0 {
			filtered = append(filtered, line)
			continue
		}
		key := strings.TrimSpace(line[:idx])
		if keep(key) {
			filtered = append(filtered, line)
			continue
		}
		removed = true
	}

	content := strings.Join(filtered, "\n")
	if strings.TrimSpace(content) == "" {
		if err := os.Remove(path); err != nil {
			return false, fmt.Errorf("remove %s: %w", path, err)
		}
		return true, nil
	}

	info, err := os.Stat(path)
	if err != nil {
		return false, fmt.Errorf("stat %s: %w", path, err)
	}
	if err := os.WriteFile(path, []byte(content), info.Mode()); err != nil {
		return false, fmt.Errorf("write %s: %w", path, err)
	}
	return removed, nil
}

func removeSDKLocalEnvEntries(root string) error {
	_, err := filterLocalEnvEntries(root, func(key string) bool {
		return key != "APPLET_SDK_ROOT" && key != "IOTA_SDK_DIST"
	})
	return err
}
