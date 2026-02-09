package applet

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/csrf"
	"github.com/sirupsen/logrus"
)

// StreamWriter provides utilities for Server-Sent Events (SSE) streaming.
// It handles proper SSE formatting and flushing for real-time communication
// with React/Next.js applets.
type StreamWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

// NewStreamWriter creates a new StreamWriter from an http.ResponseWriter.
// It sets appropriate SSE headers and verifies that streaming is supported.
// Returns an error if the ResponseWriter doesn't support flushing (required for SSE).
func NewStreamWriter(w http.ResponseWriter) (*StreamWriter, error) {
	const op = "NewStreamWriter"

	// Verify flusher support
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf("%s: %w: http.ResponseWriter does not support flushing", op, ErrInternal)
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	return &StreamWriter{
		w:       w,
		flusher: flusher,
	}, nil
}

// WriteEvent writes a Server-Sent Event with the given event type and data.
func (sw *StreamWriter) WriteEvent(event, data string) error {
	const op = "StreamWriter.WriteEvent"

	_, err := fmt.Fprintf(sw.w, "event: %s\ndata: %s\n\n", event, data)
	if err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}

	sw.flusher.Flush()
	return nil
}

// WriteJSON writes a Server-Sent Event with JSON-encoded data.
func (sw *StreamWriter) WriteJSON(event string, data interface{}) error {
	const op = "StreamWriter.WriteJSON"

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("%s: %w: failed to marshal JSON: %w", op, ErrInternal, err)
	}

	return sw.WriteEvent(event, string(jsonData))
}

// WriteDone writes a "done" event to signal the end of the stream.
func (sw *StreamWriter) WriteDone() error {
	return sw.WriteEvent("done", "")
}

// WriteError writes an "error" event with the given error message.
func (sw *StreamWriter) WriteError(errMsg string) error {
	return sw.WriteEvent("error", errMsg)
}

// WriteErrorJSON writes an "error" event with JSON-encoded error details.
func (sw *StreamWriter) WriteErrorJSON(errData interface{}) error {
	return sw.WriteJSON("error", errData)
}

// WriteComment writes an SSE comment (ignored by clients, useful for keeping connection alive).
func (sw *StreamWriter) WriteComment(comment string) error {
	const op = "StreamWriter.WriteComment"

	_, err := fmt.Fprintf(sw.w, ": %s\n", comment)
	if err != nil {
		return fmt.Errorf("%s: %w", op, err)
	}

	sw.flusher.Flush()
	return nil
}

// StreamContextBuilder builds lightweight context for SSE streaming endpoints.
// Excludes heavy fields like translations, full locale, routes for optimal performance.
type StreamContextBuilder struct {
	config        Config
	logger        *logrus.Logger
	sessionConfig SessionConfig
	host          HostServices
}

// NewStreamContextBuilder creates a StreamContextBuilder.
// Does not require i18n bundle since translations are excluded for performance.
func NewStreamContextBuilder(
	config Config,
	sessionConfig SessionConfig,
	logger *logrus.Logger,
	host HostServices,
) *StreamContextBuilder {
	return &StreamContextBuilder{
		config:        config,
		logger:        logger,
		sessionConfig: sessionConfig,
		host:          host,
	}
}

// Build builds lightweight StreamContext for SSE endpoints.
// Excludes heavy fields like translations, full locale, routes.
func (b *StreamContextBuilder) Build(ctx context.Context, r *http.Request) (*StreamContext, error) {
	start := time.Now()

	// Extract user
	user, err := b.host.ExtractUser(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).Error("Failed to extract user for stream context")
		}
		return nil, fmt.Errorf("StreamContextBuilder.Build: user extraction failed: %w", err)
	}

	// Extract tenant ID
	tenantID, err := b.host.ExtractTenantID(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).WithField("user_id", user.ID()).Error("Failed to extract tenant ID")
		}
		return nil, fmt.Errorf("StreamContextBuilder.Build: tenant extraction failed: %w", err)
	}

	// Get permissions (validated)
	permissions := collectUserPermissionNames(user)
	permissions = validatePermissions(permissions)

	// Build session context
	session := buildSessionContext(r, b.sessionConfig, nil)

	streamCtx := &StreamContext{
		UserID:      int64(user.ID()),
		TenantID:    tenantID.String(),
		Permissions: permissions,
		CSRFToken:   csrf.Token(r),
		Session:     session,
	}

	// Apply custom context extender if provided
	if b.config.CustomContext != nil {
		customData, err := b.config.CustomContext(ctx)
		if err != nil {
			if b.logger != nil {
				b.logger.WithError(err).Warn("Failed to build custom stream context")
			}
		} else if customData != nil {
			streamCtx.Extensions = sanitizeForJSON(customData)
		}
	}

	buildDuration := time.Since(start)
	if b.logger != nil {
		b.logger.WithFields(logrus.Fields{
			"user_id":     user.ID(),
			"tenant_id":   tenantID.String(),
			"duration_ms": buildDuration.Milliseconds(),
		}).Debug("Built stream context")
	}

	return streamCtx, nil
}

