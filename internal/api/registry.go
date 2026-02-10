package api

// Registry manages registered applets.
type Registry interface {
	Register(applet Applet) error
	Get(name string) Applet
	GetByBasePath(basePath string) Applet
	All() []Applet
	Has(name string) bool
}
