package applet

import (
	"fmt"
	"sync"
)

// Registry manages registered applets in the application.
// It provides thread-safe registration and retrieval of applets.
type Registry interface {
	Register(applet Applet) error
	Get(name string) Applet
	GetByBasePath(basePath string) Applet
	All() []Applet
	Has(name string) bool
}

type appletRegistry struct {
	mu              sync.RWMutex
	appletsByName   map[string]Applet
	appletsByPath   map[string]Applet
	registeredOrder []Applet
}

func NewRegistry() Registry {
	return &appletRegistry{
		appletsByName: make(map[string]Applet),
		appletsByPath: make(map[string]Applet),
	}
}

func (r *appletRegistry) Register(applet Applet) error {
	const op = "appletRegistry.Register"

	r.mu.Lock()
	defer r.mu.Unlock()

	name := applet.Name()
	basePath := applet.BasePath()

	if name == "" {
		return fmt.Errorf("%s: %w: applet name cannot be empty", op, ErrValidation)
	}

	if basePath == "" {
		return fmt.Errorf("%s: %w: applet base path cannot be empty", op, ErrValidation)
	}

	if _, exists := r.appletsByName[name]; exists {
		return fmt.Errorf("%s: %w: applet with name %q already registered", op, ErrValidation, name)
	}

	if _, exists := r.appletsByPath[basePath]; exists {
		return fmt.Errorf("%s: %w: applet with base path %q already registered", op, ErrValidation, basePath)
	}

	r.appletsByName[name] = applet
	r.appletsByPath[basePath] = applet
	r.registeredOrder = append(r.registeredOrder, applet)

	return nil
}

func (r *appletRegistry) Get(name string) Applet {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.appletsByName[name]
}

func (r *appletRegistry) GetByBasePath(basePath string) Applet {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.appletsByPath[basePath]
}

func (r *appletRegistry) All() []Applet {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Applet, len(r.registeredOrder))
	copy(result, r.registeredOrder)
	return result
}

func (r *appletRegistry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.appletsByName[name]
	return exists
}
