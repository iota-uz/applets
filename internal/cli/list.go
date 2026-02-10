package cli

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/iota-uz/applets/internal/config"
)

// NewListCommand returns the `applet list` subcommand.
func NewListCommand() *cobra.Command {
	return &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "List configured applets",
		Long:    `Print a table of all applets defined in .applets/config.toml.`,
		Example: `  applet list`,
		Args:    cobra.NoArgs,
		RunE:    runList,
	}
}

func runList(cmd *cobra.Command, _ []string) error {
	_, cfg, err := config.LoadFromCWD()
	if err != nil {
		return err
	}

	names := cfg.AppletNames()
	if len(names) == 0 {
		cmd.Println("No applets configured.")
		return nil
	}

	// Compute column widths
	nameW, baseW, webW, portW := len("NAME"), len("BASE_PATH"), len("WEB"), len("VITE_PORT")
	type row struct {
		name, base, web, port string
	}
	rows := make([]row, 0, len(names))
	for _, name := range names {
		a := cfg.Applets[name]
		r := row{
			name: name,
			base: a.BasePath,
			web:  a.Web,
			port: fmt.Sprintf("%d", a.Dev.VitePort),
		}
		if len(r.name) > nameW {
			nameW = len(r.name)
		}
		if len(r.base) > baseW {
			baseW = len(r.base)
		}
		if len(r.web) > webW {
			webW = len(r.web)
		}
		if len(r.port) > portW {
			portW = len(r.port)
		}
		rows = append(rows, r)
	}

	fmtStr := fmt.Sprintf("%%-%ds  %%-%ds  %%-%ds  %%-%ds\n", nameW, baseW, webW, portW)

	cmd.Printf(fmtStr, "NAME", "BASE_PATH", "WEB", "VITE_PORT")
	cmd.Printf(fmtStr, strings.Repeat("-", nameW), strings.Repeat("-", baseW), strings.Repeat("-", webW), strings.Repeat("-", portW))
	for _, r := range rows {
		cmd.Printf(fmtStr, r.name, r.base, r.web, r.port)
	}

	return nil
}
