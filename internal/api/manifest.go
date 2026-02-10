package api

// ViteManifest represents a Vite build manifest.json structure.
type ViteManifest map[string]ViteManifestEntry

// ViteManifestEntry is a single entry in the Vite manifest.
type ViteManifestEntry struct {
	File    string   `json:"file"`
	Src     string   `json:"src,omitempty"`
	IsEntry bool     `json:"isEntry,omitempty"`
	CSS     []string `json:"css,omitempty"`
	Imports []string `json:"imports,omitempty"`
}

// ResolvedAssets holds resolved CSS/JS paths from a manifest.
type ResolvedAssets struct {
	CSSFiles []string
	JSFiles  []string
}
