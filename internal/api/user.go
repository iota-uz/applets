package api

// AppletUser is the minimal user interface that applets need.
// Implementations are provided by the host application.
type AppletUser interface {
	ID() uint
	DisplayName() string
	HasPermission(name string) bool
	PermissionNames() []string
}

// DetailedUser extends AppletUser with email and name fields for richer UserContext.
type DetailedUser interface {
	AppletUser
	Email() string
	FirstName() string
	LastName() string
}
