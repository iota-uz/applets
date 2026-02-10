package main

import (
	"github.com/iota-uz/applets/internal/cli"
)

func main() {
	cli.Execute(cli.NewRootCommand())
}
