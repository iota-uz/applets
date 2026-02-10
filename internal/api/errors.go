package api

import "errors"

// Sentinel errors for applet operations. Use errors.Is() to check.
var (
	ErrInvalid          = errors.New("invalid")
	ErrValidation       = errors.New("validation")
	ErrNotFound         = errors.New("not found")
	ErrPermissionDenied  = errors.New("permission denied")
	ErrInternal         = errors.New("internal")
)
