package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/momobasehq/momobase"
	"github.com/spf13/cobra"
)

// resolve runs the environment and the given flags through the same path serve
// does, so a test sees exactly what newInstance would be handed.
func resolve(t *testing.T, args ...string) (momobase.Config, site) {
	t.Helper()
	cmd := &cobra.Command{Use: "test"}
	var opts serverOptions
	opts.bind(cmd)
	if err := cmd.Flags().Parse(args); err != nil {
		t.Fatalf("parse %v: %v", args, err)
	}
	cfg, s, err := config()
	if err != nil {
		t.Fatalf("config: %v", err)
	}
	opts.apply(cmd, &cfg, &s)
	return cfg, s
}

// TestPrecedence pins the order the whole configuration story rests on: only a flag the
// user typed may override the environment, since an untyped one carries its zero value.
func TestPrecedence(t *testing.T) {
	t.Setenv("APP_ADDR", ":8000")
	t.Setenv("DASHBOARD_PATH", "/admin")
	t.Setenv("DASHBOARD_ENABLED", "true")
	t.Setenv("PUBLIC_DIR", "site")

	cfg, s := resolve(t)
	if cfg.App.Addr != ":8000" || s.dashboardPath != "/admin" || !s.dashboard || cfg.App.PublicDir != "site" {
		t.Errorf("environment alone: got %+v %+v", cfg.App, s)
	}

	// The trailing slash is trimmed here as it is for DASHBOARD_PATH, so the
	// mounted prefix does not depend on how the operator typed it.
	cfg, s = resolve(t, "--addr", ":9191", "--dashboard-path", "/panel/", "--dashboard=false", "--public-dir", "www")
	if cfg.App.Addr != ":9191" || s.dashboardPath != "/panel" || s.dashboard || cfg.App.PublicDir != "www" {
		t.Errorf("flags override: got %+v %+v", cfg.App, s)
	}
}

// TestDefaults pins the two paths the documentation promises: the dashboard on /_,
// and mb_public — momobase's own default — at the root.
func TestDefaults(t *testing.T) {
	cfg, s := resolve(t)
	if s.dashboardPath != "/_" || cfg.App.PublicDir != "mb_public" || !s.dashboard {
		t.Errorf("defaults: got %+v %+v", cfg.App, s)
	}
}

// TestRootIsTheDashboardUnlessAPublicDirectoryTakesIt covers the one decision this
// binary still makes about the root, and that /_ survives momobase's own "/*" route.
func TestRootIsTheDashboardUnlessAPublicDirectoryTakesIt(t *testing.T) {
	serve := func(t *testing.T, publicDir string) *momobase.Instance {
		t.Helper()
		cfg := momobase.DefaultConfig()
		cfg.App.Addr, cfg.App.PublicDir = "127.0.0.1:0", publicDir
		cfg.DB.Path = filepath.Join(t.TempDir(), "momobase.db")
		cfg.Log.Level, cfg.Workers.Enabled = "error", false
		instance, err := newInstance(cfg, site{dashboard: true, dashboardPath: "/_"})
		if err != nil {
			t.Fatalf("newInstance() error = %v", err)
		}
		t.Cleanup(func() { _ = instance.Close() })
		return instance
	}
	get := func(t *testing.T, instance *momobase.Instance, path string) *http.Response {
		t.Helper()
		res, err := instance.App().Test(httptest.NewRequest(http.MethodGet, path, nil))
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		t.Cleanup(func() { _ = res.Body.Close() })
		return res
	}

	bare := serve(t, filepath.Join(t.TempDir(), "absent"))
	res := get(t, bare, "/")
	if res.StatusCode != http.StatusFound || res.Header.Get("Location") != "/_/" {
		t.Errorf("GET / without a public directory = %d %q, want 302 to /_/", res.StatusCode, res.Header.Get("Location"))
	}

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("home"), 0o600); err != nil {
		t.Fatal(err)
	}
	served := serve(t, dir)
	if res = get(t, served, "/"); res.StatusCode != http.StatusOK {
		t.Errorf("GET / with a public directory = %d, want the site itself", res.StatusCode)
	}
	if res = get(t, served, "/_/"); res.StatusCode != http.StatusOK {
		t.Errorf("GET /_/ = %d, want the dashboard behind momobase's own /* route", res.StatusCode)
	}
}
