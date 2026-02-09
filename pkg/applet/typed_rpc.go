package applet

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strings"
)

type Procedure[P any, R any] struct {
	RequirePermissions []string
	Handler            func(ctx context.Context, params P) (R, error)
}

type TypedRPCRouter struct {
	procs []*typedProcedure
}

type typedProcedure struct {
	name               string
	requirePermissions []string
	paramType          reflect.Type
	resultType         reflect.Type
	method             RPCMethod
}

func NewTypedRPCRouter() *TypedRPCRouter {
	return &TypedRPCRouter{procs: make([]*typedProcedure, 0)}
}

func AddProcedure[P any, R any](r *TypedRPCRouter, name string, p Procedure[P, R]) error {
	const op = "TypedRPCRouter.Add"

	if r == nil {
		return fmt.Errorf("%s: %w: TypedRPCRouter is nil", op, ErrInvalid)
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("%s: %w: procedure name is empty", op, ErrInvalid)
	}
	if p.Handler == nil {
		return fmt.Errorf("%s: %w: procedure handler is nil", op, ErrInvalid)
	}

	paramType := reflect.TypeOf((*P)(nil)).Elem()
	resultType := reflect.TypeOf((*R)(nil)).Elem()

	method := RPCMethod{
		RequirePermissions: p.RequirePermissions,
		Handler: func(ctx context.Context, params json.RawMessage) (any, error) {
			var decoded P
			trimmed := bytes.TrimSpace(params)
			if len(trimmed) > 0 && !bytes.Equal(trimmed, []byte("null")) {
				dec := json.NewDecoder(bytes.NewReader(trimmed))
				dec.DisallowUnknownFields()
				if err := dec.Decode(&decoded); err != nil {
					return nil, fmt.Errorf("%s: %w: invalid params: %w", op, ErrInvalid, err)
				}
				if err := dec.Decode(&struct{}{}); err != io.EOF {
					return nil, fmt.Errorf("%s: %w: invalid params: %w", op, ErrInvalid, err)
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

func (r *TypedRPCRouter) Config() *RPCConfig {
	methods := make(map[string]RPCMethod, len(r.procs))
	for _, p := range r.procs {
		methods[p.name] = p.method
	}

	return &RPCConfig{
		Path:    "/rpc",
		Methods: methods,
	}
}
