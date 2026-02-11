package api

import "errors"

// Sentinel errors for applet operations. Use errors.Is() to check.
var (
	ErrInvalid          = errors.New("invalid")
	ErrValidation       = errors.New("validation")
	ErrNotFound         = errors.New("not found")
	ErrPermissionDenied = errors.New("permission denied")
	ErrInternal         = errors.New("internal")
)

// ErrorClassifier allows errors to self-classify into semantic RPC error codes.
// Implement this interface on structured error types (e.g. serrors.Error) so the
// RPC handler can map domain errors to proper codes without sentinel wrapping.
//
// Recognized return values: "validation", "invalid", "not_found", "forbidden", "internal".
// Return "" to fall through to default handling.
type ErrorClassifier interface {
	ErrorKind() string
}
