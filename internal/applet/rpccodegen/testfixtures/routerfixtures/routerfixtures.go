package routerfixtures

import (
	"context"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/iota-uz/applets"
)

type pingParams struct {
	Msg string `json:"msg"`
}

type pingResult struct {
	OK bool `json:"ok"`
}

// richParams exercises arrays, maps, nested structs, pointers, time, and uuid.
type richParams struct {
	ID uuid.UUID `json:"id"`
}

type richResult struct {
	Tags      []string          `json:"tags"`
	Scores    []int             `json:"scores"`
	Labels    map[string]string `json:"labels"`
	CreatedAt time.Time         `json:"createdAt"`
	Nested    nestedObj         `json:"nested"`
	OptName   *string           `json:"optName,omitempty"`
	Ignored   string            `json:"-"`
}

type nestedObj struct {
	Value float64 `json:"value"`
}

func addProcedure[P, R any](r *applets.TypedRPCRouter, name string, h func(context.Context, P) (R, error)) {
	if err := applets.AddProcedure(r, name, applets.Procedure[P, R]{Handler: h}); err != nil {
		panic(err)
	}
}

func Router() *applets.TypedRPCRouter {
	r := applets.NewTypedRPCRouter()
	addProcedure(r, "fixtures.ping", func(_ context.Context, p pingParams) (pingResult, error) {
		return pingResult{OK: p.Msg != ""}, nil
	})
	addProcedure(r, "fixtures.rich", func(_ context.Context, p richParams) (richResult, error) {
		return richResult{}, nil
	})
	return r
}

func RouterWithDeps(_ io.Reader, _ *int) *applets.TypedRPCRouter {
	return Router()
}

func RouterBadReturn() int {
	return 42
}
