package devsetup

import (
	"context"
	"os"
	"os/exec"
)

// RunCommand executes a subprocess with the given working directory, forwarding stdout/stderr.
func RunCommand(ctx context.Context, dir, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// IsNewer returns true if source exists and is newer than target (or target doesn't exist).
func IsNewer(source, target string) bool {
	srcInfo, err := os.Stat(source)
	if err != nil {
		return false
	}
	tgtInfo, err := os.Stat(target)
	if err != nil {
		return true
	}
	return srcInfo.ModTime().After(tgtInfo.ModTime())
}

