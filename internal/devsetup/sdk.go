package devsetup

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
)

// BuildSDKIfNeeded checks whether ui/src/ exists in root (auto-detect: only applicable
// when running from a repo that ships @iota-uz/sdk source, e.g. iota-sdk or applets).
// If the SDK dist is stale or missing, it runs `pnpm run build:js:dev`. ctx is used for cancellation.
func BuildSDKIfNeeded(ctx context.Context, root string) error {
	uiSrc := filepath.Join(root, "ui", "src")
	if _, err := os.Stat(uiSrc); err != nil {
		if os.IsNotExist(err) {
			return nil // no ui/src — not an SDK source repo, skip
		}
		return fmt.Errorf("stat ui/src: %w", err)
	}

	distIndex := filepath.Join(root, "dist", "index.mjs")
	hashFile := filepath.Join(root, "dist", ".sdk-build-hash")

	needsBuild := false
	if _, err := os.Stat(distIndex); err != nil {
		needsBuild = true
	} else {
		currentHash, err := computeSDKHash(root)
		if err != nil {
			return err
		}
		savedHash, _ := os.ReadFile(hashFile)
		if string(savedHash) != currentHash {
			needsBuild = true
		}
	}

	if needsBuild {
		log.Println("Building @iota-uz/sdk (tsup, dev mode)...")
		if err := RunCommand(ctx, root, "pnpm", "run", "build:js:dev"); err != nil {
			return err
		}

		currentHash, err := computeSDKHash(root)
		if err != nil {
			return err
		}

		if err := os.MkdirAll(filepath.Join(root, "dist"), 0o755); err != nil {
			return fmt.Errorf("create dist directory: %w", err)
		}
		if err := os.WriteFile(hashFile, []byte(currentHash), 0644); err != nil {
			return err
		}
	}

	return nil
}

// computeSDKHash computes a SHA-256 hash over all .ts/.tsx/.css files in ui/src/ plus build config files.
func computeSDKHash(root string) (string, error) {
	uiSrc := filepath.Join(root, "ui", "src")
	var files []string

	err := filepath.WalkDir(uiSrc, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() {
			ext := filepath.Ext(path)
			if ext == ".ts" || ext == ".tsx" || ext == ".css" {
				files = append(files, path)
			}
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	for _, name := range []string{"tsup.config.ts", "tsup.dev.config.ts"} {
		p := filepath.Join(root, name)
		_, err := os.Stat(p)
		if err == nil {
			files = append(files, p)
		} else if !os.IsNotExist(err) {
			return "", fmt.Errorf("stat %s: %w", p, err)
		}
	}

	sort.Strings(files)

	hasher := sha256.New()
	for _, file := range files {
		relPath, err := filepath.Rel(root, file)
		if err != nil {
			return "", fmt.Errorf("rel %s from root: %w", file, err)
		}
		hasher.Write([]byte(relPath))

		content, err := os.ReadFile(file)
		if err != nil {
			return "", err
		}
		hasher.Write(content)
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}
