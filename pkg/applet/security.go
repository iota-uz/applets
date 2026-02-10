package applet

import (
	"html"
	"regexp"
	"strings"
)

// sanitizeForJSON removes or escapes dangerous characters before JSON serialization.
// Prevents XSS attacks by HTML-escaping string values in nested maps and arrays.
// Returns a new sanitized structure without modifying the original.
// Supports: maps, arrays/slices, strings, and basic JSON primitives (numbers, bools, null).
func sanitizeForJSON(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}

	sanitized := make(map[string]interface{}, len(data))
	for key, value := range data {
		sanitized[key] = sanitizeValue(value)
	}
	return sanitized
}

// sanitizeValue recursively sanitizes a value, handling maps, arrays, and strings.
func sanitizeValue(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		// HTML-escape string values to prevent XSS
		return html.EscapeString(v)
	case map[string]interface{}:
		// Recursively sanitize nested maps
		return sanitizeForJSON(v)
	case []interface{}:
		// Recursively sanitize arrays/slices
		sanitized := make([]interface{}, len(v))
		for i, item := range v {
			sanitized[i] = sanitizeValue(item)
		}
		return sanitized
	case []string:
		// Handle []string specifically (common case)
		sanitized := make([]string, len(v))
		for i, s := range v {
			sanitized[i] = html.EscapeString(s)
		}
		return sanitized
	case []map[string]interface{}:
		// Handle []map[string]interface{} specifically
		sanitized := make([]map[string]interface{}, len(v))
		for i, m := range v {
			sanitized[i] = sanitizeForJSON(m)
		}
		return sanitized
	default:
		// Pass through basic JSON primitives (numbers, bools, null) unchanged
		// These are safe and don't need sanitization
		return value
	}
}

// validatePermissions ensures permissions are valid permission names.
// Returns only valid permissions, filtering out malformed ones.
// Limits to maxPermissions to prevent DoS attacks.
func validatePermissions(permissions []string) []string {
	const maxPermissions = 100
	const maxPermissionLength = 255

	if len(permissions) == 0 {
		return []string{}
	}

	validated := make([]string, 0, len(permissions))
	seen := make(map[string]struct{}, len(permissions))
	for _, rawPerm := range permissions {
		perm := normalizePermissionName(rawPerm)

		// Skip empty or overly long permissions
		if len(perm) == 0 || len(perm) > maxPermissionLength {
			continue
		}

		// Validate permission format
		if !isValidPermissionFormat(perm) {
			continue
		}

		// Skip duplicates after normalization
		if _, ok := seen[perm]; ok {
			continue
		}
		seen[perm] = struct{}{}

		validated = append(validated, perm)

		// Prevent DoS by limiting total permissions
		if len(validated) >= maxPermissions {
			break
		}
	}
	return validated
}

// normalizePermissionName trims whitespace and preserves case so hosts can use
// PascalCase permission names (e.g. "BiChat.Access") that match their domain.
func normalizePermissionName(perm string) string {
	return strings.TrimSpace(perm)
}

// permissionRegex validates permission format: Segment.Segment (letters, digits, underscores, dots)
// Example valid permissions: "BiChat.Access", "User.Create", "bichat.access"
var permissionRegex = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$`)

// isValidPermissionFormat checks if permission follows the format: segment.segment...
// Allows PascalCase to align with SDK/host permission names.
func isValidPermissionFormat(perm string) bool {
	return permissionRegex.MatchString(perm)
}
