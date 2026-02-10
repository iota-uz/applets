package rpccodegen

import (
	"testing"

	"github.com/iota-uz/applets"
	"github.com/stretchr/testify/require"
)

func TestEmitTypeScript(t *testing.T) {
	t.Parallel()

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
					"PingResult": {Fields: []applets.TypedField{{Name: "ok", Type: applets.TypeRef{Kind: "boolean"}}}},
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
