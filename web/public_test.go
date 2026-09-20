package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

// TestRedirectRootSendsTheRootToTheDashboard covers the default install, where the
// library serves no public directory and / would otherwise be a 404.
func TestRedirectRootSendsTheRootToTheDashboard(t *testing.T) {
	app := fiber.New()
	MountDashboard(app, "/_")
	RedirectRoot(app, "/_/")

	res, err := app.Test(httptest.NewRequest(http.MethodGet, "/", nil))
	if err != nil {
		t.Fatalf("GET /: %v", err)
	}
	defer func() { _ = res.Body.Close() }()
	// Found, not moved permanently: dropping in a public directory later must still win.
	if res.StatusCode != http.StatusFound || res.Header.Get(fiber.HeaderLocation) != "/_/" {
		t.Errorf("GET /: got %d %q, want 302 to /_/", res.StatusCode, res.Header.Get(fiber.HeaderLocation))
	}
}
