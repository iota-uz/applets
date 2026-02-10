package api

import "context"

// Procedure defines a typed RPC procedure (params P, result R).
type Procedure[P any, R any] struct {
	RequirePermissions []string
	Handler            func(ctx context.Context, params P) (R, error)
}

// TypedRouterDescription is the JSON-serializable description of a TypedRPCRouter (for codegen).
type TypedRouterDescription struct {
	Methods []TypedMethodDescription   `json:"methods"`
	Types   map[string]TypedTypeObject `json:"types"`
}

// TypedMethodDescription describes a single RPC method.
type TypedMethodDescription struct {
	Name               string   `json:"name"`
	RequirePermissions []string `json:"requirePermissions,omitempty"`
	Params             TypeRef  `json:"params"`
	Result             TypeRef  `json:"result"`
}

// TypedTypeObject describes a type for codegen.
type TypedTypeObject struct {
	Fields []TypedField `json:"fields"`
}

// TypedField describes a struct field.
type TypedField struct {
	Name     string  `json:"name"`
	Optional bool    `json:"optional"`
	Type     TypeRef `json:"type"`
}

// TypeRef describes a type reference (for codegen).
type TypeRef struct {
	Kind  string    `json:"kind"`
	Name  string    `json:"name,omitempty"`
	Elem  *TypeRef  `json:"elem,omitempty"`
	Value *TypeRef  `json:"value,omitempty"`
	Union []TypeRef `json:"union,omitempty"`
}
