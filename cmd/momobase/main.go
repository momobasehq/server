// Command momobase runs the Momobase payment orchestration server with the
// adapters compiled into it and the administration dashboard served alongside.
//
// The momobase library reads no environment of its own: this binary is the host,
// so reading configuration is its job and every setting below is resolved here.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/momobasehq/momobase"

	"github.com/momobasehq/server/providers"
	"github.com/momobasehq/server/web"
)

// version is stamped at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "momobase:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) > 0 {
		switch args[0] {
		case "version":
			fmt.Println(version)
			return nil
		case "seed-admin":
			return seedAdmin(args[1:])
		case "serve":
			args = args[1:]
		}
	}
	return serve(args)
}

// dashboard holds the settings that belong to this binary rather than to the
// Momobase library, which knows nothing about a dashboard.
type dashboard struct {
	enabled bool
	path    string
}

// newInstance builds the server from the environment and mounts the dashboard.
// Flags are resolved after the environment so a flag always wins.
func newInstance(args []string) (*momobase.Instance, dashboard, error) {
	cfg, dash, err := config()
	if err != nil {
		return nil, dash, err
	}

	flags := flag.NewFlagSet("momobase", flag.ContinueOnError)
	addr := flags.String("addr", cfg.App.Addr, "address the HTTP server listens on")
	path := flags.String("dashboard-path", dash.path, "URL prefix the dashboard is served under")
	enabled := flags.Bool("dashboard", dash.enabled, "serve the administration dashboard")
	if err := flags.Parse(args); err != nil {
		return nil, dash, err
	}
	cfg.App.Addr = *addr
	dash.path = strings.TrimSuffix(*path, "/")
	dash.enabled = *enabled

	// Validated after the flags so a flag cannot smuggle in a setting the
	// environment alone would have been rejected for.
	if err := cfg.Validate(); err != nil {
		return nil, dash, err
	}

	instance, err := momobase.New(
		momobase.WithConfig(cfg),
		momobase.WithProviders(providers.All()),
	)
	if err != nil {
		return nil, dash, err
	}
	if dash.enabled {
		web.MountDashboard(instance.App(), dash.path)
	}
	return instance, dash, nil
}

func serve(args []string) error {
	instance, dash, err := newInstance(args)
	if err != nil {
		return err
	}
	defer func() { _ = instance.Close() }()

	instance.Logger().Info("momobase starting",
		"version", version,
		"addr", instance.Addr(),
		"dashboard", dashboardTarget(dash),
	)
	return instance.Run()
}

func dashboardTarget(dash dashboard) string {
	if !dash.enabled {
		return "disabled"
	}
	return dash.path + "/"
}

// seedAdmin creates the first administrator and exits. It is not idempotent:
// running it twice with the same address fails on the uniqueness constraint.
func seedAdmin(args []string) error {
	flags := flag.NewFlagSet("seed-admin", flag.ContinueOnError)
	email := flags.String("email", env("ADMIN_EMAIL", ""), "administrator email address")
	password := flags.String("password", env("ADMIN_PASSWORD", ""), "administrator password")
	name := flags.String("name", env("ADMIN_NAME", "Administrator"), "administrator display name")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if *email == "" || *password == "" {
		return errors.New("seed-admin needs -email and -password (or ADMIN_EMAIL and ADMIN_PASSWORD)")
	}

	// The dashboard is not mounted for a one-shot command, and never needs to be.
	instance, _, err := newInstance([]string{"-dashboard=false"})
	if err != nil {
		return err
	}
	defer func() { _ = instance.Close() }()
	return instance.SeedAdmin(context.Background(), *email, *password, *name)
}

// config resolves the server's configuration from the environment, starting from
// Momobase's development defaults and replacing what a deployment sets.
//
// The variable names and units are the ones .env.example documents: the library
// stopped reading the environment, so reading it is this binary's job and the
// names it answers to are part of its interface.
//
// Validation is left to the caller, which runs it after applying flags.
func config() (momobase.Config, dashboard, error) {
	cfg := momobase.DefaultConfig()
	dash := dashboard{enabled: true, path: "/dashboard"}

	cfg.App.Name = env("APP_NAME", cfg.App.Name)
	cfg.App.Env = env("APP_ENV", cfg.App.Env)
	cfg.App.Addr = env("APP_ADDR", cfg.App.Addr)
	cfg.App.PublicURL = env("APP_PUBLIC_URL", cfg.App.PublicURL)
	if origins := list("CORS_ALLOWED_ORIGINS"); origins != nil {
		cfg.App.CORSAllowedOrigins = origins
	}
	cfg.App.TrustedProxyCIDRs = list("TRUSTED_PROXY_CIDRS")

	cfg.Log.Level = env("LOG_LEVEL", cfg.Log.Level)

	cfg.DB.Type = env("DB_TYPE", cfg.DB.Type)
	cfg.DB.Path = env("DB_PATH", cfg.DB.Path)
	cfg.DB.Host = env("DB_HOST", cfg.DB.Host)
	cfg.DB.Port = env("DB_PORT", cfg.DB.Port)
	cfg.DB.User = env("DB_USER", cfg.DB.User)
	cfg.DB.Password = env("DB_PASSWORD", cfg.DB.Password)
	cfg.DB.Name = env("DB_NAME", cfg.DB.Name)
	cfg.DB.SSLMode = env("DB_SSLMODE", cfg.DB.SSLMode)

	cfg.Security.EncryptionMasterKeyBase64 = env("ENCRYPTION_MASTER_KEY_BASE64", cfg.Security.EncryptionMasterKeyBase64)
	cfg.Security.AdminOAuthSecret = env("ADMIN_OAUTH_SECRET", cfg.Security.AdminOAuthSecret)
	cfg.Security.AppOAuthSecret = env("APP_OAUTH_SECRET", cfg.Security.AppOAuthSecret)
	cfg.Security.AppClientIDPrefix = env("APP_CLIENT_ID_PREFIX", cfg.Security.AppClientIDPrefix)
	cfg.Security.AppClientSecretPrefix = env("APP_CLIENT_SECRET_PREFIX", cfg.Security.AppClientSecretPrefix)

	var err error
	for _, field := range []struct {
		key    string
		unit   time.Duration
		target *time.Duration
	}{
		{"ADMIN_ACCESS_TTL_MINUTES", time.Minute, &cfg.Security.AdminAccessTTL},
		{"ADMIN_REFRESH_TTL_HOURS", time.Hour, &cfg.Security.AdminRefreshTTL},
		{"APP_ACCESS_TTL_MINUTES", time.Minute, &cfg.Security.AppAccessTTL},
		{"APP_REFRESH_TTL_HOURS", time.Hour, &cfg.Security.AppRefreshTTL},
		{"HEALTH_CHECK_INTERVAL_SECONDS", time.Second, &cfg.Workers.HealthInterval},
		{"RECONCILIATION_INTERVAL_SECONDS", time.Second, &cfg.Workers.ReconciliationInterval},
		{"CLEANUP_INTERVAL_SECONDS", time.Second, &cfg.Workers.CleanupInterval},
	} {
		if *field.target, err = duration(field.key, field.unit, *field.target); err != nil {
			return cfg, dash, err
		}
	}

	for _, field := range []struct {
		key    string
		target *bool
	}{
		{"WORKERS_ENABLED", &cfg.Workers.Enabled},
		{"HEALTH_WORKER_ENABLED", &cfg.Workers.HealthEnabled},
		{"RECONCILIATION_WORKER_ENABLED", &cfg.Workers.ReconciliationEnabled},
		{"CLEANUP_WORKER_ENABLED", &cfg.Workers.CleanupEnabled},
		{"AUTO_MIGRATE", &cfg.Features.AutoMigrate},
		{"DASHBOARD_ENABLED", &dash.enabled},
	} {
		if *field.target, err = boolean(field.key, *field.target); err != nil {
			return cfg, dash, err
		}
	}

	dash.path = strings.TrimSuffix(env("DASHBOARD_PATH", dash.path), "/")
	return cfg, dash, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// list returns nil when the variable is unset, so a caller can tell "not
// configured" from "configured empty" and keep its own default.
func list(key string) []string {
	raw := os.Getenv(key)
	if raw == "" {
		return nil
	}
	var out []string
	for _, value := range strings.Split(raw, ",") {
		if value = strings.TrimSpace(value); value != "" {
			out = append(out, value)
		}
	}
	return out
}

func boolean(key string, fallback bool) (bool, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return false, fmt.Errorf("%s must be a boolean, got %q", key, raw)
	}
	return value, nil
}

// duration reads a positive whole number of the unit the variable is named for,
// so ADMIN_ACCESS_TTL_MINUTES=15 means fifteen minutes.
func duration(key string, unit time.Duration, fallback time.Duration) (time.Duration, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be a positive integer, got %q", key, raw)
	}
	if value <= 0 {
		return 0, fmt.Errorf("%s must be greater than zero, got %d", key, value)
	}
	return time.Duration(value) * unit, nil
}
