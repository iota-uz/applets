package rpc

import (
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/iota-uz/applets/internal/api"
)

const maxDescribeDepth = 32

// DescribeTypedRPCRouter returns a JSON-serializable description of the router (for codegen).
func DescribeTypedRPCRouter(r *TypedRPCRouter) (*api.TypedRouterDescription, error) {
	if r == nil {
		return nil, fmt.Errorf("router is nil")
	}
	defs := make(map[string]api.TypedTypeObject)
	seen := make(map[reflect.Type]bool)
	methods := make([]api.TypedMethodDescription, 0, len(r.procs))
	for _, p := range r.procs {
		params := describeType(p.paramType, defs, seen, 0)
		result := describeType(p.resultType, defs, seen, 0)
		methods = append(methods, api.TypedMethodDescription{
			Name:               p.name,
			RequirePermissions: append([]string(nil), p.requirePermissions...),
			Params:             params,
			Result:             result,
		})
	}
	sort.Slice(methods, func(i, j int) bool { return methods[i].Name < methods[j].Name })
	return &api.TypedRouterDescription{Methods: methods, Types: defs}, nil
}

func describeType(t reflect.Type, defs map[string]api.TypedTypeObject, seen map[reflect.Type]bool, depth int) api.TypeRef {
	if t == nil || depth > maxDescribeDepth {
		return api.TypeRef{Kind: "unknown"}
	}
	for t.Kind() == reflect.Pointer {
		elem := t.Elem()
		ref := describeType(elem, defs, seen, depth+1)
		return api.TypeRef{
			Kind:  "union",
			Union: []api.TypeRef{ref, {Kind: "null"}},
		}
	}
	if isTime(t) || isUUID(t) {
		return api.TypeRef{Kind: "string"}
	}
	switch t.Kind() {
	case reflect.Invalid, reflect.Uintptr, reflect.Complex64, reflect.Complex128,
		reflect.Chan, reflect.Func, reflect.Interface, reflect.Pointer, reflect.UnsafePointer:
		return api.TypeRef{Kind: "unknown"}
	case reflect.String:
		return api.TypeRef{Kind: "string"}
	case reflect.Bool:
		return api.TypeRef{Kind: "boolean"}
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64,
		reflect.Float32, reflect.Float64:
		return api.TypeRef{Kind: "number"}
	case reflect.Slice, reflect.Array:
		elem := describeType(t.Elem(), defs, seen, depth+1)
		return api.TypeRef{Kind: "array", Elem: &elem}
	case reflect.Map:
		if t.Key().Kind() != reflect.String {
			return api.TypeRef{Kind: "unknown"}
		}
		value := describeType(t.Elem(), defs, seen, depth+1)
		return api.TypeRef{Kind: "record", Value: &value}
	case reflect.Struct:
		if t.Name() == "" {
			return api.TypeRef{Kind: "unknown"}
		}
		name := tsTypeName(t)
		if !seen[t] {
			seen[t] = true
			defs[name] = api.TypedTypeObject{
				Fields: describeStructFields(t, defs, seen, depth+1),
			}
		}
		return api.TypeRef{Kind: "named", Name: name}
	default:
		return api.TypeRef{Kind: "unknown"}
	}
}

func describeStructFields(t reflect.Type, defs map[string]api.TypedTypeObject, seen map[reflect.Type]bool, depth int) []api.TypedField {
	fields := make([]api.TypedField, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.Anonymous || f.PkgPath != "" {
			continue
		}
		jsonName, optional, skip := parseJSONTag(f.Tag.Get("json"), f.Name)
		if skip {
			continue
		}
		ref := describeType(f.Type, defs, seen, depth)
		fields = append(fields, api.TypedField{Name: jsonName, Optional: optional, Type: ref})
	}
	return fields
}

func parseJSONTag(tag string, fallback string) (string, bool, bool) {
	if tag == "-" {
		return "", false, true
	}
	if tag == "" {
		return lowerFirst(fallback), false, false
	}
	parts := strings.Split(tag, ",")
	name := parts[0]
	if name == "" {
		name = lowerFirst(fallback)
	}
	optional := false
	for _, p := range parts[1:] {
		if p == "omitempty" {
			optional = true
		}
	}
	return name, optional, false
}

func lowerFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToLower(s[:1]) + s[1:]
}

func tsTypeName(t reflect.Type) string {
	if strings.HasSuffix(t.PkgPath(), "/rpc") {
		return t.Name()
	}
	pkgLast := pathLastSegment(t.PkgPath())
	if pkgLast == "" {
		return t.Name()
	}
	return exportName(pkgLast) + t.Name()
}

func exportName(s string) string {
	if s == "" {
		return s
	}
	parts := strings.FieldsFunc(s, func(r rune) bool { return r == '-' || r == '_' || r == '/' })
	var b strings.Builder
	for _, p := range parts {
		if p == "" {
			continue
		}
		b.WriteString(strings.ToUpper(p[:1]))
		if len(p) > 1 {
			b.WriteString(p[1:])
		}
	}
	return b.String()
}

func pathLastSegment(pkgPath string) string {
	pkgPath = strings.TrimSuffix(pkgPath, "/")
	if pkgPath == "" {
		return ""
	}
	i := strings.LastIndex(pkgPath, "/")
	if i == -1 {
		return pkgPath
	}
	return pkgPath[i+1:]
}

func isTime(t reflect.Type) bool {
	return t.PkgPath() == "time" && t.Name() == "Time"
}

func isUUID(t reflect.Type) bool {
	return t.PkgPath() == "github.com/google/uuid" && t.Name() == "UUID"
}
