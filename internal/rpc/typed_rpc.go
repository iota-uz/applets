package rpc

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strings"

	"github.com/iota-uz/applets/internal/api"
)

type typedProcedure struct {
	name               string
	requirePermissions []string
	paramType          reflect.Type
	resultType         reflect.Type
	method             api.RPCMethod
}

// TypedRPCRouter holds typed RPC procedures and can produce RPCConfig.
type TypedRPCRouter struct {
	procs []*typedProcedure
}

// NewTypedRPCRouter returns a new TypedRPCRouter.
func NewTypedRPCRouter() *TypedRPCRouter {
	return &TypedRPCRouter{procs: make([]*typedProcedure, 0)}
}

// AddProcedure registers a typed procedure.
func AddProcedure[P any, R any](r *TypedRPCRouter, name string, p api.Procedure[P, R]) error {
	const op = "rpc.AddProcedure"
	if r == nil {
		return fmt.Errorf("%s: %w: TypedRPCRouter is nil", op, api.ErrInvalid)
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("%s: %w: procedure name is empty", op, api.ErrInvalid)
	}
	if p.Handler == nil {
		return fmt.Errorf("%s: %w: procedure handler is nil", op, api.ErrInvalid)
	}
	paramType := reflect.TypeOf((*P)(nil)).Elem()
	resultType := reflect.TypeOf((*R)(nil)).Elem()
	method := api.RPCMethod{
		RequirePermissions: p.RequirePermissions,
		Handler: func(ctx context.Context, params json.RawMessage) (any, error) {
			var decoded P
			trimmed := bytes.TrimSpace(params)
			if len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null")) {
				dec := json.NewDecoder(bytes.NewReader(trimmed))
				dec.DisallowUnknownFields()
				if err := dec.Decode(&decoded); err != nil {
					return nil, fmt.Errorf("%s: %w: invalid params: %w", op, api.ErrInvalid, err)
				}
				if err := dec.Decode(&struct{}{}); err != io.EOF {
					return nil, fmt.Errorf("%s: %w: invalid params: %w", op, api.ErrInvalid, err)
				}
			}
			res, err := p.Handler(ctx, decoded)
			if err != nil {
				return nil, err
			}
			return res, nil
		},
	}
	r.procs = append(r.procs, &typedProcedure{
		name:               name,
		requirePermissions: p.RequirePermissions,
		paramType:          paramType,
		resultType:         resultType,
		method:             method,
	})
	return nil
}

// Config returns the RPC config for this router.
func (r *TypedRPCRouter) Config() *api.RPCConfig {
	methods := make(map[string]api.RPCMethod, len(r.procs))
	for _, p := range r.procs {
		methods[p.name] = p.method
	}
	return &api.RPCConfig{
		Path:    "/rpc",
		Methods: methods,
	}
}
