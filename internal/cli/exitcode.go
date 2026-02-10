package cli

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

const (
	SuccessCode      = 0
	FailureCode      = 1
	InvalidUsageCode = 2
)

// ExitError is an error that carries an explicit process exit code.
// If Silent is true, callers may choose not to print the error.
// If Usage is true, usage string may be printed on exit.
type ExitError struct {
	Code   int
	Err    error
	Silent bool
	Usage  bool
}

func (e *ExitError) ExitCode() int { return e.Code }
func (e *ExitError) Unwrap() error { return e.Err }
func (e *ExitError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return fmt.Sprintf("exit %d", e.Code)
}

// InvalidUsage returns an ExitError for invalid usage (exit code 2).
func InvalidUsage(err error) *ExitError {
	return &ExitError{Code: InvalidUsageCode, Err: err, Usage: true}
}

// NewExitError returns an ExitError with the given code.
func NewExitError(code int, err error) *ExitError {
	return &ExitError{Code: code, Err: err}
}

// Execute runs the root command and exits with the appropriate code on error.
// It handles ExitError (printing the error and optionally usage) and shows
// usage for common Cobra misuse (unknown command, missing subcommand, wrong args).
func Execute(root *cobra.Command) {
	executedCmd, err := root.ExecuteC()
	if err != nil {
		var ee *ExitError
		if errors.As(err, &ee) {
			if !ee.Silent {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				if ee.Usage && executedCmd != nil {
					fmt.Fprint(os.Stderr, "\n")
					fmt.Fprint(os.Stderr, executedCmd.UsageString())
				}
			}
			os.Exit(ee.ExitCode())
		}

		// Show usage for CLI misuse
		if strings.HasPrefix(err.Error(), "unknown command ") ||
			strings.Contains(err.Error(), "requires a subcommand") ||
			(strings.Contains(err.Error(), "accepts ") && strings.Contains(err.Error(), "arg(s), received ")) {
			fmt.Fprintf(os.Stderr, "Error: %v\n\n", err)
			if executedCmd != nil {
				fmt.Fprint(os.Stderr, executedCmd.UsageString())
			}
			os.Exit(InvalidUsageCode)
		}

		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(FailureCode)
	}
}
