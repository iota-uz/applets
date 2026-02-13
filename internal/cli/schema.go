package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/iota-uz/applets/config"
	"github.com/spf13/cobra"
)

func NewSchemaCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "schema",
		Short: "Applet schema utilities",
	}
	cmd.AddCommand(newSchemaExportCommand())
	return cmd
}

func newSchemaExportCommand() *cobra.Command {
	var appletName string
	cmd := &cobra.Command{
		Use:   "export",
		Short: "Generate runtime/schema.artifact.json from runtime/schema.ts",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if strings.TrimSpace(appletName) == "" {
				return errors.New("--name is required")
			}
			root, _, err := config.LoadFromCWD()
			if err != nil {
				return err
			}
			schemaPath, artifactPath, err := resolveSchemaPaths(root, appletName)
			if err != nil {
				return err
			}
			payload, err := os.ReadFile(schemaPath)
			if err != nil {
				return fmt.Errorf("read %s: %w", schemaPath, err)
			}
			artifact, err := buildSchemaArtifact(string(payload))
			if err != nil {
				return err
			}
			encoded, err := json.MarshalIndent(artifact, "", "  ")
			if err != nil {
				return fmt.Errorf("encode schema artifact: %w", err)
			}
			encoded = append(encoded, '\n')
			if err := os.WriteFile(artifactPath, encoded, 0o644); err != nil {
				return fmt.Errorf("write %s: %w", artifactPath, err)
			}
			cmd.Println("Generated schema artifact:", artifactPath)
			return nil
		},
	}
	cmd.Flags().StringVar(&appletName, "name", "", "Applet name")
	return cmd
}

func resolveSchemaPaths(root, appletName string) (schemaPath string, artifactPath string, err error) {
	candidates := []string{
		filepath.Join(root, "modules", appletName, "runtime", "schema.ts"),
		filepath.Join(root, "runtime", "schema.ts"),
	}
	for _, candidate := range candidates {
		if _, statErr := os.Stat(candidate); statErr == nil {
			return candidate, filepath.Join(filepath.Dir(candidate), "schema.artifact.json"), nil
		}
	}
	return "", "", fmt.Errorf("could not find runtime/schema.ts for applet %q", appletName)
}

type tableArtifact struct {
	Required []string `json:"required"`
}

type schemaArtifact struct {
	Version int                      `json:"version"`
	Tables  map[string]tableArtifact `json:"tables"`
}

var (
	tableStartRegex = regexp.MustCompile(`^\s*([A-Za-z0-9_]+)\s*:\s*defineTable\(\{`)
	fieldRegex      = regexp.MustCompile(`^\s*([A-Za-z0-9_]+)\s*:`)
)

func buildSchemaArtifact(source string) (*schemaArtifact, error) {
	lines := strings.Split(source, "\n")
	artifact := &schemaArtifact{
		Version: 1,
		Tables:  make(map[string]tableArtifact),
	}
	currentTable := ""
	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if currentTable == "" {
			if match := tableStartRegex.FindStringSubmatch(rawLine); len(match) == 2 {
				currentTable = strings.TrimSpace(match[1])
				artifact.Tables[currentTable] = tableArtifact{Required: []string{}}
			}
			continue
		}
		if strings.HasPrefix(line, "})") || strings.HasPrefix(line, "}).") {
			currentTable = ""
			continue
		}
		match := fieldRegex.FindStringSubmatch(rawLine)
		if len(match) != 2 {
			continue
		}
		field := strings.TrimSpace(match[1])
		if field == "" {
			continue
		}
		if strings.Contains(rawLine, ".optional()") {
			continue
		}
		entry := artifact.Tables[currentTable]
		if !contains(entry.Required, field) {
			entry.Required = append(entry.Required, field)
			artifact.Tables[currentTable] = entry
		}
	}

	for tableName, entry := range artifact.Tables {
		sort.Strings(entry.Required)
		artifact.Tables[tableName] = entry
	}
	if len(artifact.Tables) == 0 {
		return nil, errors.New("no defineTable(...) blocks found in schema.ts")
	}
	return artifact, nil
}

func contains(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}
