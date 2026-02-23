package devsetup

import (
	"bufio"
	"context"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	goWorkWatchInterval   = 2 * time.Second
	goWorkRestartDebounce = 1500 * time.Millisecond
)

// DiscoverGoWorkDependencyDirs returns local dependency directories from go.work use/replace entries.
// If go.work does not exist at root, it returns an empty slice and nil error.
func DiscoverGoWorkDependencyDirs(root string) ([]string, error) {
	goWorkPath := filepath.Join(root, "go.work")
	data, err := os.ReadFile(goWorkPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	paths := parseGoWorkPaths(string(data))
	seen := make(map[string]struct{})
	out := make([]string, 0, len(paths))
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}

	for _, p := range paths {
		abs := p
		if !filepath.IsAbs(abs) {
			abs = filepath.Join(rootAbs, p)
		}
		abs, err = filepath.Abs(abs)
		if err != nil {
			continue
		}
		if abs == rootAbs {
			continue
		}
		info, statErr := os.Stat(abs)
		if statErr != nil || !info.IsDir() {
			continue
		}
		if _, ok := seen[abs]; ok {
			continue
		}
		seen[abs] = struct{}{}
		out = append(out, abs)
	}

	sort.Strings(out)
	return out, nil
}

// WatchGoWorkDependencies polls go.work dependencies and requests restartProcess when changes are detected.
func WatchGoWorkDependencies(ctx context.Context, root string, dependencyDirs []string, restartProcess string, restartSignals chan<- string) {
	if len(dependencyDirs) == 0 || restartProcess == "" || restartSignals == nil {
		return
	}

	lastSeen, err := latestDependencyModTime(root, dependencyDirs)
	if err != nil {
		log.Printf("go.work watcher disabled: %v", err)
		return
	}

	log.Printf("go.work watcher enabled for %d dependency dirs", len(dependencyDirs))
	ticker := time.NewTicker(goWorkWatchInterval)
	defer ticker.Stop()

	lastRestart := time.Time{}
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			current, watchErr := latestDependencyModTime(root, dependencyDirs)
			if watchErr != nil {
				log.Printf("go.work watcher scan error: %v", watchErr)
				continue
			}
			if !current.After(lastSeen) {
				continue
			}
			lastSeen = current
			now := time.Now()
			if !lastRestart.IsZero() && now.Sub(lastRestart) < goWorkRestartDebounce {
				continue
			}
			select {
			case restartSignals <- restartProcess:
				lastRestart = now
			default:
				// Avoid blocking if a restart is already pending.
			}
		}
	}
}

func parseGoWorkPaths(content string) []string {
	var out []string
	scanner := bufio.NewScanner(strings.NewReader(content))
	inUseBlock := false

	for scanner.Scan() {
		line := stripGoComments(scanner.Text())
		if line == "" {
			continue
		}

		if strings.HasPrefix(line, "use (") {
			inUseBlock = true
			continue
		}
		if inUseBlock {
			if line == ")" {
				inUseBlock = false
				continue
			}
			if p := firstTokenPath(line); p != "" {
				out = append(out, p)
			}
			continue
		}

		if strings.HasPrefix(line, "use ") {
			rest := strings.TrimSpace(strings.TrimPrefix(line, "use"))
			if rest == "(" {
				inUseBlock = true
				continue
			}
			if p := firstTokenPath(rest); p != "" {
				out = append(out, p)
			}
			continue
		}

		if strings.HasPrefix(line, "replace ") {
			parts := strings.Split(line, "=>")
			if len(parts) != 2 {
				continue
			}
			rhs := firstTokenPath(parts[1])
			if rhs == "" {
				continue
			}
			if looksLocalPath(rhs) {
				out = append(out, rhs)
			}
		}
	}
	return out
}

func stripGoComments(line string) string {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return ""
	}
	if idx := strings.Index(trimmed, "//"); idx >= 0 {
		trimmed = strings.TrimSpace(trimmed[:idx])
	}
	return trimmed
}

func firstTokenPath(text string) string {
	fields := strings.Fields(strings.TrimSpace(text))
	if len(fields) == 0 {
		return ""
	}
	token := strings.Trim(fields[0], `"'`)
	return strings.TrimSpace(token)
}

func looksLocalPath(value string) bool {
	if value == "" {
		return false
	}
	if strings.HasPrefix(value, ".") || strings.HasPrefix(value, "/") {
		return true
	}
	return len(value) >= 2 && value[1] == ':'
}

func latestDependencyModTime(root string, dependencyDirs []string) (time.Time, error) {
	var latest time.Time

	files := []string{
		filepath.Join(root, "go.work"),
		filepath.Join(root, "go.work.sum"),
	}
	for _, f := range files {
		info, err := os.Stat(f)
		if err != nil {
			if os.IsNotExist(err) {
				continue
			}
			return time.Time{}, err
		}
		if info.ModTime().After(latest) {
			latest = info.ModTime()
		}
	}

	for _, dir := range dependencyDirs {
		err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				name := d.Name()
				if name == ".git" || name == "node_modules" || name == "dist" || name == "tmp" || name == "coverage" || name == "bin" {
					return filepath.SkipDir
				}
				return nil
			}
			info, infoErr := d.Info()
			if infoErr != nil {
				return infoErr
			}
			if info.ModTime().After(latest) {
				latest = info.ModTime()
			}
			return nil
		})
		if err != nil {
			return time.Time{}, err
		}
	}

	return latest, nil
}
