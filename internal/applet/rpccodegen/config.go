package rpccodegen

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var appletNamePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]*$`)

// Config holds paths and options for generating an applet RPC contract.
type Config struct {
	Name          string
	TypeName      string
	RouterPackage string
	RouterFunc    string
	OutputPath    string // Explicit output path override; when empty, falls back to TargetOut heuristic
	TargetOut     string
	SDKOut        string
	ModuleOut     string
}

// ValidateAppletName returns an error if name is empty or does not match the applet name pattern.
func ValidateAppletName(name string) error {
	if name == "" {
		return fmt.Errorf("missing required --name")
	}
	if !appletNamePattern.MatchString(name) {
		return fmt.Errorf("invalid applet name: %s", name)
	}
	return nil
}

// TypeNameFromAppletName derives a PascalCase RPC type name from an applet name (e.g. "bichat" -> "BichatRPC").
func TypeNameFromAppletName(name string) string {
	parts := strings.FieldsFunc(name, func(r rune) bool {
		return r == '-' || r == '_'
	})
	var b strings.Builder
	for _, part := range parts {
		if part == "" {
			continue
		}
		r, size := utf8.DecodeRuneInString(part)
		if r == utf8.RuneError && size == 0 {
			continue
		}
		b.WriteRune(unicode.ToUpper(r))
		b.WriteString(part[size:])
	}
	b.WriteString("RPC")
	return b.String()
}

// BuildRPCConfig builds RPC codegen config for the given applet name and router func.
func BuildRPCConfig(root, name, routerFunc string) (Config, error) {
	typeName := TypeNameFromAppletName(name)
	if typeName == "RPC" {
		return Config{}, fmt.Errorf("failed to derive type name from applet name: %s", name)
	}

	sdkDataDir := filepath.Join(root, "ui", "src", name, "data")
	sdkOut := filepath.Join("ui", "src", name, "data", "rpc.generated.ts")
	moduleOut := filepath.Join("modules", name, "presentation", "web", "src", "rpc.generated.ts")
	targetOut := moduleOut
	if IsDir(sdkDataDir) {
		targetOut = sdkOut
	}

	return Config{
		Name:          name,
		TypeName:      typeName,
		RouterPackage: filepath.ToSlash(filepath.Join("modules", name, "rpc")),
		RouterFunc:    routerFunc,
		TargetOut:     filepath.ToSlash(targetOut),
		SDKOut:        filepath.ToSlash(sdkOut),
		ModuleOut:     filepath.ToSlash(moduleOut),
	}, nil
}

// ReexportContent returns the TypeScript content for an applet module re-export shim.
func ReexportContent(typeName, appletName string) string {
	return fmt.Sprintf("// Re-export canonical RPC contract from @iota-uz/sdk package.\nexport type { %s } from '@iota-uz/sdk/%s'\n", typeName, appletName)
}

// BichatReexportContent returns the TypeScript content for the bichat module re-export shim.
// Deprecated: use ReexportContent(typeName, "bichat") instead.
func BichatReexportContent(typeName string) string {
	return ReexportContent(typeName, "bichat")
}

// SetEnv returns a copy of base (or os.Environ() if nil) with key=value, replacing existing key if present.
func SetEnv(base []string, key, value string) []string {
	env := base
	if env == nil {
		env = os.Environ()
	}
	prefix := key + "="
	out := make([]string, 0, len(env)+1)
	replaced := false
	for _, entry := range env {
		if strings.HasPrefix(entry, prefix) {
			if !replaced {
				out = append(out, prefix+value)
				replaced = true
			}
			continue
		}
		out = append(out, entry)
	}
	if !replaced {
		out = append(out, prefix+value)
	}
	return out
}

// IsDir returns true if path exists and is a directory.
func IsDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// FindProjectRoot walks up from the current working directory until it finds go.mod for a known applet host (iota-sdk or eai).
// Deprecated: use config.FindRoot() instead, which tries .applets/config.toml first then falls back to go.mod.
func FindProjectRoot() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	dir := cwd
	for {
		modPath := filepath.Join(dir, "go.mod")
		data, readErr := os.ReadFile(modPath)
		if readErr == nil {
			s := string(data)
			if strings.Contains(s, "module github.com/iota-uz/iota-sdk") || strings.Contains(s, "module github.com/iota-uz/eai") {
				return dir, nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("could not find project root (go.mod for github.com/iota-uz/iota-sdk or github.com/iota-uz/eai)")
		}
		dir = parent
	}
}

// EnsureParentDir returns an error if the parent directory of root/relPath does not exist.
func EnsureParentDir(root, relPath string) error {
	parent := filepath.Dir(filepath.Join(root, relPath))
	if !IsDir(parent) {
		return fmt.Errorf("target directory does not exist: %s", filepath.ToSlash(filepath.Clean(relPath)))
	}
	return nil
}

// CheckDrift verifies that the on-disk RPC contract matches what would be generated from the Go router.
// If needsReexportShim is true and the target is the SDK output, the module re-export shim is also validated.
// Returns an error describing the drift and the command to fix it (applet rpc gen --name <name>).
func CheckDrift(root, name string, cfg Config, needsReexportShim bool) error {
	targetAbs := filepath.Join(root, cfg.TargetOut)
	if _, err := os.Stat(targetAbs); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("RPC target file does not exist: %s\nRun: applet rpc gen --name %s", cfg.TargetOut, name)
		}
		return err
	}

	tmpFile, err := os.CreateTemp("", "applet-rpc-contract-*.ts")
	if err != nil {
		return err
	}
	tmpPath := tmpFile.Name()
	if err := tmpFile.Close(); err != nil {
		return err
	}
	defer func() { _ = os.Remove(tmpPath) }()

	if err := RunTypegen(root, cfg, tmpPath); err != nil {
		return err
	}

	targetBytes, err := os.ReadFile(targetAbs)
	if err != nil {
		return err
	}

	var expectedBytes []byte
	if needsReexportShim && cfg.TargetOut == cfg.ModuleOut {
		expectedBytes = []byte(ReexportContent(cfg.TypeName, name))
	} else {
		tmpBytes, readErr := os.ReadFile(tmpPath)
		if readErr != nil {
			return readErr
		}
		expectedBytes = tmpBytes
	}

	if !bytes.Equal(targetBytes, expectedBytes) {
		return fmt.Errorf("RPC contract drift detected for applet: %s\nRun: applet rpc gen --name %s", name, name)
	}

	if needsReexportShim && cfg.TargetOut != cfg.ModuleOut {
		moduleAbs := filepath.Join(root, cfg.ModuleOut)
		stat, err := os.Stat(moduleAbs)
		if err != nil {
			if os.IsNotExist(err) {
				return fmt.Errorf("applet %s re-export shim missing at %s.\nRun: applet rpc gen --name %s", name, cfg.ModuleOut, name)
			}
			return err
		}
		if stat.IsDir() {
			return fmt.Errorf("applet %s module path is a directory, re-export shim expected at %s.\nRun: applet rpc gen --name %s", name, cfg.ModuleOut, name)
		}
		actual, readErr := os.ReadFile(moduleAbs)
		if readErr != nil {
			return readErr
		}
		expected := ReexportContent(cfg.TypeName, name)
		if string(actual) != expected {
			return fmt.Errorf("applet %s module rpc.generated.ts must be a re-export shim.\nRun: applet rpc gen --name %s", name, name)
		}
	}

	return nil
}
