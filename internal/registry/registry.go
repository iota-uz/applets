package registry

import (
	"fmt"
	"sync"

	"github.com/iota-uz/applets/internal/api"
)

type appletRegistry struct {
	mu              sync.RWMutex
	appletsByName   map[string]api.Applet
	appletsByPath   map[string]api.Applet
	registeredOrder []api.Applet
}

// New returns a new Registry.
func New() api.Registry {
	return &appletRegistry{
		appletsByName: make(map[string]api.Applet),
		appletsByPath: make(map[string]api.Applet),
	}
}

func (r *appletRegistry) Register(applet api.Applet) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	name := applet.Name()
	basePath := applet.BasePath()
	if name == "" {
		return fmt.Errorf("registry: %w: applet name cannot be empty", api.ErrValidation)
	}
	if basePath == "" {
		return fmt.Errorf("registry: %w: applet base path cannot be empty", api.ErrValidation)
	}
	if _, exists := r.appletsByName[name]; exists {
		return fmt.Errorf("registry: %w: applet %q already registered", api.ErrValidation, name)
	}
	if _, exists := r.appletsByPath[basePath]; exists {
		return fmt.Errorf("registry: %w: base path %q already registered", api.ErrValidation, basePath)
	}
	r.appletsByName[name] = applet
	r.appletsByPath[basePath] = applet
	r.registeredOrder = append(r.registeredOrder, applet)
	return nil
}

func (r *appletRegistry) Get(name string) api.Applet {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.appletsByName[name]
}

func (r *appletRegistry) GetByBasePath(basePath string) api.Applet {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.appletsByPath[basePath]
}

func (r *appletRegistry) All() []api.Applet {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]api.Applet, len(r.registeredOrder))
	copy(out, r.registeredOrder)
	return out
}

func (r *appletRegistry) Has(name string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.appletsByName[name]
	return ok
}
