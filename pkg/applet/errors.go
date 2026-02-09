package applet

import "errors"

// Sentinel errors for common applet error conditions.
// Use errors.Is() to check for these errors, and fmt.Errorf with %w to wrap them.
var (
	// ErrInvalid indicates invalid input or state.
	ErrInvalid = errors.New("invalid")

	// ErrValidation indicates validation failure.
	ErrValidation = errors.New("validation")

	// ErrNotFound indicates a resource was not found.
	ErrNotFound = errors.New("not found")

	// ErrPermissionDenied indicates permission was denied.
	ErrPermissionDenied = errors.New("permission denied")

	// ErrInternal indicates an internal error.
	ErrInternal = errors.New("internal")
)
