package security

import (
	"regexp"
	"strings"

	"github.com/iota-uz/applets/internal/api"
)

const maxPermissions = 100
const maxPermissionLength = 255

var permissionRegex = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$`)

// ValidatePermissions filters and validates permission names. Returns only valid ones.
// Always returns a non-nil slice (empty slice for no permissions) to ensure correct JSON serialization.
func ValidatePermissions(permissions []string) []string {
	if len(permissions) == 0 {
		return []string{}
	}
	validated := make([]string, 0, len(permissions))
	seen := make(map[string]struct{}, len(permissions))
	for _, raw := range permissions {
		perm := strings.TrimSpace(raw)
		if perm == "" || len(perm) > maxPermissionLength || !permissionRegex.MatchString(perm) {
			continue
		}
		if _, ok := seen[perm]; ok {
			continue
		}
		seen[perm] = struct{}{}
		validated = append(validated, perm)
		if len(validated) >= maxPermissions {
			break
		}
	}
	return validated
}

// CollectUserPermissionNames returns the user's permission names, validated and deduplicated.
// Always returns a non-nil slice (empty slice for no permissions) to ensure correct JSON serialization.
func CollectUserPermissionNames(u api.AppletUser) []string {
	if u == nil {
		return []string{}
	}
	raw := u.PermissionNames()
	return ValidatePermissions(raw)
}
