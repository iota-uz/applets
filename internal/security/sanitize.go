package security

import "html"

// SanitizeForJSON escapes dangerous characters before JSON serialization to prevent XSS.
// Returns a new sanitized structure. Supports maps, slices, and strings.
func SanitizeForJSON(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}
	sanitized := make(map[string]interface{}, len(data))
	for key, value := range data {
		sanitized[key] = sanitizeValue(value)
	}
	return sanitized
}

func sanitizeValue(value interface{}) interface{} {
	switch v := value.(type) {
	case string:
		return html.EscapeString(v)
	case map[string]interface{}:
		return SanitizeForJSON(v)
	case []interface{}:
		out := make([]interface{}, len(v))
		for i, item := range v {
			out[i] = sanitizeValue(item)
		}
		return out
	case []string:
		out := make([]string, len(v))
		for i, s := range v {
			out[i] = html.EscapeString(s)
		}
		return out
	case []map[string]interface{}:
		out := make([]map[string]interface{}, len(v))
		for i, m := range v {
			out[i] = SanitizeForJSON(m)
		}
		return out
	default:
		return value
	}
}
