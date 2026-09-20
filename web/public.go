package web

import "github.com/gofiber/fiber/v3"

// RedirectRoot answers / with a Found redirect to target, handing the root to the
// dashboard when momobase's public directory has not taken it. Found, not 301: a
// public directory added later must not be skipped by a redirect a browser cached.
func RedirectRoot(app *fiber.App, target string) {
	app.Get("/", func(c fiber.Ctx) error {
		return c.Redirect().Status(fiber.StatusFound).To(target)
	})
}
