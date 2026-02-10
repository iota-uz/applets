package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"github.com/a-h/templ"
	"github.com/iota-uz/applets/internal/api"
)

type contextKey string

const headComponentKey contextKey = "head"

var htmlNameRe = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)
var scriptTagCloseRe = regexp.MustCompile(`(?i)</(script)>`)

// RenderApp is the HTTP handler for rendering the applet HTML.
func (c *Controller) RenderApp(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	initialContext, err := c.builder.Build(ctx, r, c.applet.BasePath())
	if err != nil {
		http.Error(w, "Failed to build context", http.StatusInternalServerError)
		return
	}
	contextJSON, err := json.Marshal(initialContext)
	if err != nil {
		http.Error(w, "Failed to serialize context", http.StatusInternalServerError)
		return
	}
	c.render(ctx, w, r, contextJSON)
}

func (c *Controller) render(ctx context.Context, w http.ResponseWriter, r *http.Request, contextJSON []byte) {
	config := c.applet.Config()
	contextScript, err := buildSafeContextScript(config.WindowGlobal, contextJSON)
	if err != nil {
		http.Error(w, "Failed to inject context", http.StatusInternalServerError)
		return
	}
	mountHTML := buildMountElement(config.Mount)
	cssLinks, jsScripts, err := c.buildAssetTags()
	if err != nil {
		if c.logger != nil {
			c.logger.WithError(err).Error("failed to build asset tags")
		}
		http.Error(w, "Failed to resolve applet assets", http.StatusInternalServerError)
		return
	}
	switch config.Shell.Mode {
	case api.ShellModeEmbedded:
		if config.Shell.Layout == nil {
			http.Error(w, "Applet shell layout is required", http.StatusInternalServerError)
			return
		}
		title := strings.TrimSpace(config.Shell.Title)
		if title == "" {
			title = c.applet.Name()
		}
		existingHead, ok := ctx.Value(headComponentKey).(templ.Component)
		if !ok || existingHead == nil {
			existingHead = templ.NopComponent
			ctx = context.WithValue(ctx, headComponentKey, existingHead)
		}
		if cssLinks != "" {
			mergedHead := templ.ComponentFunc(func(headCtx context.Context, wr io.Writer) error {
				if err := existingHead.Render(headCtx, wr); err != nil {
					return err
				}
				return templ.Raw(cssLinks).Render(headCtx, wr)
			})
			ctx = context.WithValue(ctx, headComponentKey, mergedHead)
		}
		shell := templ.ComponentFunc(func(shellCtx context.Context, wr io.Writer) error {
			if _, err := io.WriteString(wr, mountHTML); err != nil {
				return err
			}
			if _, err := io.WriteString(wr, contextScript); err != nil {
				return err
			}
			if _, err := io.WriteString(wr, jsScripts); err != nil {
				return err
			}
			return nil
		})
		ctx = templ.WithChildren(ctx, shell)
		layout := config.Shell.Layout(title)
		templ.Handler(layout, templ.WithStreaming()).ServeHTTP(w, r.WithContext(ctx))
		return
	case api.ShellModeStandalone:
		title := strings.TrimSpace(config.Shell.Title)
		if title == "" {
			title = c.applet.Name()
		}
		html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
  %s
</head>
<body>
  %s
  %s
  %s
</body>
</html>`,
			template.HTMLEscapeString(title),
			cssLinks,
			mountHTML,
			contextScript,
			jsScripts,
		)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(html))
		return
	default:
		http.Error(w, "Invalid applet shell mode", http.StatusInternalServerError)
		return
	}
}

func buildMountElement(config api.MountConfig) string {
	tag := strings.TrimSpace(config.Tag)
	id := strings.TrimSpace(config.ID)
	attrs := config.Attributes
	if tag == "" {
		tag = "div"
	}
	if !htmlNameRe.MatchString(tag) {
		tag = "div"
		id = "root"
		attrs = nil
	}
	if id == "" && tag == "div" {
		id = "root"
	}
	var b strings.Builder
	b.WriteString("<")
	b.WriteString(template.HTMLEscapeString(tag))
	if id != "" {
		b.WriteString(` id="`)
		b.WriteString(template.HTMLEscapeString(id))
		b.WriteString(`"`)
	}
	type attr struct{ k, v string }
	var ordered []attr
	for k, v := range attrs {
		k = strings.TrimSpace(k)
		if k != "" && htmlNameRe.MatchString(k) {
			ordered = append(ordered, attr{k, v})
		}
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i].k < ordered[j].k })
	for _, a := range ordered {
		b.WriteString(" ")
		b.WriteString(template.HTMLEscapeString(a.k))
		b.WriteString(`="`)
		b.WriteString(template.HTMLEscapeString(a.v))
		b.WriteString(`"`)
	}
	b.WriteString("></")
	b.WriteString(template.HTMLEscapeString(tag))
	b.WriteString(">")
	return b.String()
}

func buildSafeContextScript(windowGlobal string, contextJSON []byte) (string, error) {
	keyJSON, err := json.Marshal(windowGlobal)
	if err != nil {
		return "", fmt.Errorf("buildSafeContextScript: %w: %w", api.ErrInternal, err)
	}
	safeKey := scriptTagCloseRe.ReplaceAllString(string(keyJSON), "<\\/$1>")
	safeValue := scriptTagCloseRe.ReplaceAllString(string(contextJSON), "<\\/$1>")
	return fmt.Sprintf(`<script>window[%s] = %s;</script>`, safeKey, safeValue), nil
}
