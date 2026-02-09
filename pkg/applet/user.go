package applet

// AppletUser is the minimal user interface that applets need.
// Implementations should be provided by the host application (e.g., iota-sdk).
//
// Permission flattening (from roles, groups, etc.) is the host's responsibility.
// HasPermission and PermissionNames should reflect the fully resolved set.
type AppletUser interface {
	ID() uint
	DisplayName() string
	HasPermission(name string) bool
	PermissionNames() []string
}

// DetailedUser is an optional extension of AppletUser that provides
// individual name fields and email for richer UserContext output.
// If the user does not implement DetailedUser, UserContext will use
// DisplayName() for FirstName and leave Email/LastName empty.
type DetailedUser interface {
	AppletUser
	Email() string
	FirstName() string
	LastName() string
}
