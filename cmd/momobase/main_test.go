package main

import (
	"testing"

	"github.com/spf13/cobra"
)

// resolve runs the environment and the given flags through the same path serve
// does, so a test sees exactly what newInstance would be handed.
func resolve(t *testing.T, args ...string) (string, dashboard) {
	t.Helper()
	cmd := &cobra.Command{Use: "test"}
	var opts serverOptions
	opts.bind(cmd)
	if err := cmd.Flags().Parse(args); err != nil {
		t.Fatalf("parse %v: %v", args, err)
	}
	cfg, dash, err := config()
	if err != nil {
		t.Fatalf("config: %v", err)
	}
	opts.apply(cmd, &cfg, &dash)
	return cfg.App.Addr, dash
}

// TestPrecedence pins the order the whole configuration story rests on. Only a
// flag the user typed may override the environment: a flag left alone carries its
// registered zero value, so reading it unconditionally would silently blank the
// address and switch the dashboard off on every deployment that configures them.
func TestPrecedence(t *testing.T) {
	t.Setenv("APP_ADDR", ":8000")
	t.Setenv("DASHBOARD_PATH", "/admin")
	t.Setenv("DASHBOARD_ENABLED", "true")

	addr, dash := resolve(t)
	if addr != ":8000" || dash.path != "/admin" || !dash.enabled {
		t.Errorf("environment alone: got %q %+v", addr, dash)
	}

	// The trailing slash is trimmed here as it is for DASHBOARD_PATH, so the
	// mounted prefix does not depend on how the operator typed it.
	addr, dash = resolve(t, "--addr", ":9191", "--dashboard-path", "/panel/", "--dashboard=false")
	if addr != ":9191" || dash.path != "/panel" || dash.enabled {
		t.Errorf("flags override: got %q %+v", addr, dash)
	}
}
