package applet

// collectUserPermissionNames returns the user's permission names (trimmed, case preserved).
func collectUserPermissionNames(u AppletUser) []string {
	if u == nil {
		return []string{}
	}
	raw := u.PermissionNames()
	perms := make([]string, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, name := range raw {
		normalized := normalizePermissionName(name)
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		perms = append(perms, normalized)
	}
	return perms
}
