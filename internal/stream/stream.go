package stream

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gorilla/csrf"
	"github.com/iota-uz/applets/internal/api"
	appletctx "github.com/iota-uz/applets/internal/context"
	"github.com/iota-uz/applets/internal/security"
	"github.com/sirupsen/logrus"
)

// StreamWriter provides SSE writing utilities.
type StreamWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

// NewStreamWriter creates a new StreamWriter. Returns an error if w does not support flushing.
func NewStreamWriter(w http.ResponseWriter) (*StreamWriter, error) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf("NewStreamWriter: %w: http.ResponseWriter does not support flushing", api.ErrInternal)
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	return &StreamWriter{w: w, flusher: flusher}, nil
}

func (sw *StreamWriter) WriteEvent(event, data string) error {
	_, err := fmt.Fprintf(sw.w, "event: %s\ndata: %s\n\n", event, data)
	if err != nil {
		return err
	}
	sw.flusher.Flush()
	return nil
}

func (sw *StreamWriter) WriteJSON(event string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("StreamWriter.WriteJSON: %w: %w", api.ErrInternal, err)
	}
	return sw.WriteEvent(event, string(jsonData))
}

func (sw *StreamWriter) WriteDone() error   { return sw.WriteEvent("done", "") }
func (sw *StreamWriter) WriteError(msg string) error { return sw.WriteEvent("error", msg) }
func (sw *StreamWriter) WriteErrorJSON(data interface{}) error { return sw.WriteJSON("error", data) }

func (sw *StreamWriter) WriteComment(comment string) error {
	_, err := fmt.Fprintf(sw.w, ": %s\n", comment)
	if err != nil {
		return err
	}
	sw.flusher.Flush()
	return nil
}

// StreamContextBuilder builds lightweight StreamContext for SSE endpoints.
type StreamContextBuilder struct {
	config        api.Config
	logger        *logrus.Logger
	sessionConfig api.SessionConfig
	host          api.HostServices
}

// NewStreamContextBuilder creates a new StreamContextBuilder.
func NewStreamContextBuilder(
	config api.Config,
	sessionConfig api.SessionConfig,
	logger *logrus.Logger,
	host api.HostServices,
) *StreamContextBuilder {
	return &StreamContextBuilder{
		config:        config,
		logger:        logger,
		sessionConfig: sessionConfig,
		host:          host,
	}
}

// Build builds a StreamContext.
func (b *StreamContextBuilder) Build(ctx context.Context, r *http.Request) (*api.StreamContext, error) {
	start := time.Now()
	user, err := b.host.ExtractUser(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).Error("Failed to extract user for stream context")
		}
		return nil, fmt.Errorf("StreamContextBuilder.Build: user extraction failed: %w", err)
	}
	tenantID, err := b.host.ExtractTenantID(ctx)
	if err != nil {
		if b.logger != nil {
			b.logger.WithError(err).WithField("user_id", user.ID()).Error("Failed to extract tenant ID")
		}
		return nil, fmt.Errorf("StreamContextBuilder.Build: tenant extraction failed: %w", err)
	}
	permissions := security.CollectUserPermissionNames(user)
	session := appletctx.BuildSessionContext(r, b.sessionConfig, nil) // no store for stream
	streamCtx := &api.StreamContext{
		UserID:      int64(user.ID()),
		TenantID:    tenantID.String(),
		Permissions: permissions,
		CSRFToken:   csrf.Token(r),
		Session:     session,
	}
	if b.config.CustomContext != nil {
		customData, err := b.config.CustomContext(ctx)
		if err != nil && b.logger != nil {
			b.logger.WithError(err).Warn("Failed to build custom stream context")
		} else if customData != nil {
			streamCtx.Extensions = security.SanitizeForJSON(customData)
		}
	}
	if b.logger != nil {
		b.logger.WithFields(logrus.Fields{
			"user_id":     user.ID(),
			"tenant_id":   tenantID.String(),
			"duration_ms": time.Since(start).Milliseconds(),
		}).Debug("Built stream context")
	}
	return streamCtx, nil
}
