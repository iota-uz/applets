package rpccodegen

import (
	"testing"

	"github.com/iota-uz/applets"
	"github.com/stretchr/testify/require"
)

func TestEmitTypeScript(t *testing.T) {
	t.Parallel()

	strRef := applets.TypeRef{Kind: "string"}
	numRef := applets.TypeRef{Kind: "number"}
	boolRef := applets.TypeRef{Kind: "boolean"}
	nullRef := applets.TypeRef{Kind: "null"}

	cases := []struct {
		name         string
		desc         *applets.TypedRouterDescription
		typeName     string
		wantContains []string
		wantErr      bool
	}{
		{
			name: "SingleMethod",
			desc: &applets.TypedRouterDescription{
				Methods: []applets.TypedMethodDescription{
					{
						Name:   "demo.ping",
						Params: applets.TypeRef{Kind: "named", Name: "PingParams"},
						Result: applets.TypeRef{Kind: "named", Name: "PingResult"},
					},
				},
				Types: map[string]applets.TypedTypeObject{
					"PingParams": {Fields: []applets.TypedField{}},
					"PingResult": {Fields: []applets.TypedField{{Name: "ok", Type: boolRef}}},
				},
			},
			typeName: "DemoRPC",
			wantContains: []string{
				`export type DemoRPC`,
				`"demo.ping": { params: PingParams; result: PingResult }`,
				`export type PingParams = Record<string, never>`,
				`export interface PingResult`,
				`ok: boolean`,
			},
		},
		{
			name: "MultipleMethodsSortedOutput",
			desc: &applets.TypedRouterDescription{
				Methods: []applets.TypedMethodDescription{
					{Name: "z.last", Params: strRef, Result: strRef},
					{Name: "a.first", Params: numRef, Result: numRef},
				},
			},
			typeName: "SortRPC",
			wantContains: []string{
				"\"a.first\": { params: number; result: number }\n  \"z.last\"",
			},
		},
		{
			name: "ArrayTypes",
			desc: &applets.TypedRouterDescription{
				Methods: []applets.TypedMethodDescription{
					{
						Name:   "items.list",
						Params: applets.TypeRef{Kind: "named", Name: "ListParams"},
						Result: applets.TypeRef{Kind: "named", Name: "ListResult"},
					},
				},
				Types: map[string]applets.TypedTypeObject{
					"ListParams": {Fields: []applets.TypedField{}},
					"ListResult": {Fields: []applets.TypedField{
						{Name: "tags", Type: applets.TypeRef{Kind: "array", Elem: &strRef}},
						{Name: "scores", Type: applets.TypeRef{Kind: "array", Elem: &numRef}},
						{Name: "unknown", Type: applets.TypeRef{Kind: "array"}},
					}},
				},
			},
			typeName: "ArrayRPC",
			wantContains: []string{
				"tags: string[]",
				"scores: number[]",
				"unknown: unknown[]",
			},
		},
		{
			name: "RecordTypes",
			desc: &applets.TypedRouterDescription{
				Methods: []applets.TypedMethodDescription{
					{
						Name:   "meta.get",
						Params: applets.TypeRef{Kind: "named", Name: "MetaParams"},
						Result: applets.TypeRef{Kind: "named", Name: "MetaResult"},
					},
				},
				Types: map[string]applets.TypedTypeObject{
					"MetaParams": {Fields: []applets.TypedField{}},
					"MetaResult": {Fields: []applets.TypedField{
						{Name: "labels", Type: applets.TypeRef{Kind: "record", Value: &strRef}},
						{Name: "counts", Type: applets.TypeRef{Kind: "record", Value: &numRef}},
						{Name: "any", Type: applets.TypeRef{Kind: "record"}},
					}},
				},
			},
			typeName: "RecordRPC",
			wantContains: []string{
				"labels: Record<string, string>",
				"counts: Record<string, number>",
				"any: Record<string, unknown>",
			},
		},
		{
			name: "UnionAndOptionalFields",
			desc: &applets.TypedRouterDescription{
				Methods: []applets.TypedMethodDescription{
					{
						Name:   "user.get",
						Params: applets.TypeRef{Kind: "named", Name: "GetParams"},
						Result: applets.TypeRef{Kind: "named", Name: "GetResult"},
					},
				},
				Types: map[string]applets.TypedTypeObject{
					"GetParams": {Fields: []applets.TypedField{
						{Name: "id", Type: strRef},
					}},
					"GetResult": {Fields: []applets.TypedField{
						{Name: "name", Type: strRef},
						{Name: "bio", Optional: true, Type: applets.TypeRef{Kind: "union", Union: []applets.TypeRef{strRef, nullRef}}},
						{Name: "age", Optional: true, Type: numRef},
					}},
				},
			},
			typeName: "UserRPC",
			wantContains: []string{
				"id: string",
				"name: string",
				"bio?: string | null",
				"age?: number",
			},
		},
		{
			name:     "NilDescription",
			desc:     nil,
			typeName: "DemoRPC",
			wantErr:  true,
		},
		{
			name:     "EmptyTypeName",
			desc:     &applets.TypedRouterDescription{},
			typeName: "",
			wantErr:  true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			out, err := EmitTypeScript(tc.desc, tc.typeName)
			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			for _, want := range tc.wantContains {
				require.Contains(t, out, want)
			}
		})
	}
}
