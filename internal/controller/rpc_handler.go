package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/iota-uz/applets/internal/api"
)

type rpcRequest struct {
	ID     string          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

type rpcResponse struct {
	ID     string    `json:"id"`
	Result any       `json:"result,omitempty"`
	Error  *rpcError `json:"error,omitempty"`
}

type rpcError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func (c *Controller) handleRPC(w http.ResponseWriter, r *http.Request) {
	config := c.applet.Config()
	rpcCfg := config.RPC
	if rpcCfg == nil {
		http.NotFound(w, r)
		return
	}
	exposeInternalErrors := false
	if rpcCfg.ExposeInternalErrors != nil {
		exposeInternalErrors = *rpcCfg.ExposeInternalErrors
	}
	maxBytes := rpcCfg.MaxBodyBytes
	if maxBytes <= 0 {
		maxBytes = 1 << 20
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	defer func() { _ = r.Body.Close() }()

	var req rpcRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeRPC(w, http.StatusRequestEntityTooLarge, rpcResponse{ID: "", Error: &rpcError{Code: "payload_too_large", Message: "request too large"}})
			return
		}
		writeRPC(w, http.StatusBadRequest, rpcResponse{ID: "", Error: &rpcError{Code: "invalid_request", Message: "invalid json request"}})
		return
	}
	if err := dec.Decode(&struct{}{}); err != io.EOF {
		writeRPC(w, http.StatusBadRequest, rpcResponse{ID: "", Error: &rpcError{Code: "invalid_request", Message: "invalid json request"}})
		return
	}
	method := strings.TrimSpace(req.Method)
	if method == "" {
		writeRPC(w, http.StatusBadRequest, rpcResponse{ID: req.ID, Error: &rpcError{Code: "invalid_request", Message: "method is required"}})
		return
	}
	rpcMethod, ok := rpcCfg.Methods[method]
	if !ok {
		writeRPC(w, http.StatusOK, rpcResponse{ID: req.ID, Error: &rpcError{Code: "method_not_found", Message: "method not found"}})
		return
	}
	if len(rpcMethod.RequirePermissions) > 0 {
		if err := c.requirePermissions(r.Context(), rpcMethod.RequirePermissions); err != nil {
			writeRPC(w, http.StatusOK, rpcResponse{ID: req.ID, Error: &rpcError{Code: "forbidden", Message: "permission denied"}})
			return
		}
	}
	result, err := rpcMethod.Handler(r.Context(), req.Params)
	if err != nil {
		code := mapErrorCode(err)
		msg := mapRPCErrorMessage(code, err, exposeInternalErrors)

		// Always log RPC errors server-side for debuggability.
		c.logger.WithField("method", method).WithField("code", code).WithError(err).Error("RPC handler error")

		rpcErr := &rpcError{
			Code:    code,
			Message: msg,
		}
		if exposeInternalErrors {
			rpcErr.Details = extractErrorDetails(err)
		}
		writeRPC(w, http.StatusOK, rpcResponse{ID: req.ID, Error: rpcErr})
		return
	}
	writeRPC(w, http.StatusOK, rpcResponse{ID: req.ID, Result: result})
}

func writeRPC(w http.ResponseWriter, status int, resp rpcResponse) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(resp); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(buf.Bytes())
}

func mapErrorCode(err error) string {
	// 1. Check sentinel errors (fmt.Errorf %w wrapping).
	switch {
	case errors.Is(err, api.ErrValidation):
		return "validation"
	case errors.Is(err, api.ErrInvalid):
		return "invalid"
	case errors.Is(err, api.ErrNotFound):
		return "not_found"
	case errors.Is(err, api.ErrPermissionDenied):
		return "forbidden"
	case errors.Is(err, api.ErrInternal):
		return "internal"
	}

	// 2. Check for ErrorClassifier interface (e.g. serrors.Error with Kind).
	var classifier api.ErrorClassifier
	if errors.As(err, &classifier) {
		if kind := classifier.ErrorKind(); kind != "" {
			return kind
		}
	}

	return "error"
}

func mapRPCErrorMessage(code string, err error, exposeInternalErrors bool) string {
	if exposeInternalErrors && err != nil {
		if msg := strings.TrimSpace(err.Error()); msg != "" {
			return msg
		}
	}
	switch code {
	case "forbidden":
		return "permission denied"
	case "validation":
		return "validation failed"
	case "invalid":
		return "invalid request"
	case "not_found":
		return "resource not found"
	case "internal":
		return "internal error"
	default:
		return "request failed"
	}
}

// extractErrorDetails builds a structured details map from the error chain.
// This is returned in the RPC response only when ExposeInternalErrors is true.
func extractErrorDetails(err error) map[string]any {
	if err == nil {
		return nil
	}
	details := make(map[string]any)
	if msg := strings.TrimSpace(err.Error()); msg != "" {
		details["message"] = msg
	}

	// Walk the error chain to build an operation trace.
	var ops []string
	current := err
	for current != nil {
		// Check for Op field via interface (serrors.Error pattern).
		type oper interface{ Operation() string }
		if o, ok := current.(oper); ok {
			if op := o.Operation(); op != "" {
				ops = append(ops, op)
			}
		}
		current = errors.Unwrap(current)
	}
	if len(ops) > 0 {
		details["trace"] = ops
	}
	return details
}

func (c *Controller) requirePermissions(ctx context.Context, required []string) error {
	u, err := c.host.ExtractUser(ctx)
	if err != nil {
		return fmt.Errorf("requirePermissions: %w", err)
	}
	if u == nil {
		return fmt.Errorf("requirePermissions: no user: %w", api.ErrPermissionDenied)
	}
	for _, need := range required {
		if need == "" {
			continue
		}
		if !u.HasPermission(need) {
			return fmt.Errorf("requirePermissions: missing permission %q: %w", need, api.ErrPermissionDenied)
		}
	}
	return nil
}
