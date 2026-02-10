package routerfixtures

import (
	"context"
	"io"

	"github.com/iota-uz/applets"
)

type pingParams struct {
	Msg string `json:"msg"`
}

type pingResult struct {
	OK bool `json:"ok"`
}

func Router() *applets.TypedRPCRouter {
	r := applets.NewTypedRPCRouter()
	if err := applets.AddProcedure(r, "fixtures.ping", applets.Procedure[pingParams, pingResult]{
		Handler: func(ctx context.Context, params pingParams) (pingResult, error) {
			return pingResult{OK: params.Msg != ""}, nil
		},
	}); err != nil {
		panic(err)
	}
	return r
}

func RouterWithDeps(_ io.Reader, _ *int) *applets.TypedRPCRouter {
	return Router()
}

func RouterBadReturn() int {
	return 42
}
