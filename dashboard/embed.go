package dashboard

import (
	"embed"
	"io/fs"
)

// The all: prefix is load-bearing: without it the pattern skips the underscore-prefixed
// chunks Rollup emits, and the served app 404s at run time with no build error.
//
//go:embed all:dist
var assets embed.FS

// FS returns the embedded dashboard assets rooted at the build output directory,
// so a path matches the URL the built index.html references.
func FS() fs.FS {
	sub, err := fs.Sub(assets, "dist")
	if err != nil {
		// dist is embedded above, so this is unreachable outside a broken build.
		panic("dashboard: " + err.Error())
	}
	return sub
}
