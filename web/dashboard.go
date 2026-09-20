// Package web serves the administration dashboard bundled into the binary and the
// public directory an operator puts beside it.
package web

import (
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"mime"
	"path"
	"strings"

	"github.com/gofiber/fiber/v3"

	"github.com/momobasehq/server/dashboard"
)

// indexFile is the application shell every dashboard visit resolves to: the dashboard
// routes on the URL hash, which browsers never send, so there is no SPA fallback.
const indexFile = "index.html"

// handler serves the embedded dashboard bundle out of an fs.FS.
type handler struct {
	assets fs.FS
	etags  map[string]string
}

// newHandler indexes the bundle and precomputes an entity tag per file. embed.FS reports
// a zero ModTime, so without one every asset is re-downloaded in full on every load.
func newHandler(assets fs.FS) *handler {
	h := &handler{assets: assets, etags: make(map[string]string)}
	_ = fs.WalkDir(assets, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		data, err := fs.ReadFile(assets, name)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(data)
		h.etags[name] = `"` + hex.EncodeToString(sum[:16]) + `"`
		return nil
	})
	return h
}

// serve serves one embedded asset, or the application shell at the root.
func (h *handler) serve(c fiber.Ctx) error {
	// Cleaning an absolute path collapses any ".." before it is used as a key, so a
	// traversal attempt resolves to a name that simply is not in the bundle.
	name := strings.TrimPrefix(path.Clean("/"+c.Params("*")), "/")
	if name == "" || name == "." {
		name = indexFile
	}
	etag, ok := h.etags[name]
	if !ok {
		return fiber.ErrNotFound
	}
	data, err := fs.ReadFile(h.assets, name)
	if err != nil {
		return fiber.ErrNotFound
	}

	// The shell names the hashed assets, so a cached copy would point at a bundle the next
	// deploy replaced; the assets carry their hash and can never change under it.
	if name == indexFile {
		c.Set(fiber.HeaderCacheControl, "no-cache")
	} else {
		c.Set(fiber.HeaderCacheControl, "public, max-age=31536000, immutable")
	}
	c.Set(fiber.HeaderETag, etag)
	if match := c.Get(fiber.HeaderIfNoneMatch); match != "" && strings.Contains(match, etag) {
		return c.SendStatus(fiber.StatusNotModified)
	}

	contentType := mime.TypeByExtension(path.Ext(name))
	if contentType == "" {
		contentType = fiber.MIMEOctetStream
	}
	c.Set(fiber.HeaderContentType, contentType)
	return c.Send(data)
}

// MountDashboard serves the embedded administration dashboard under dashboardPath
// on the instance's Fiber application. Call it after momobase.New and before Run.
func MountDashboard(app *fiber.App, dashboardPath string) {
	h := newHandler(dashboard.FS())
	redirect := func(c fiber.Ctx) error {
		return c.Redirect().Status(fiber.StatusMovedPermanently).To(dashboardPath + "/")
	}
	app.Get(dashboardPath+"/*", func(c fiber.Ctx) error {
		if c.Path() == dashboardPath {
			return redirect(c)
		}
		return h.serve(c)
	})
}
