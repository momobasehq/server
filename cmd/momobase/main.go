// Command momobase runs the Momobase payment orchestration server with the
// adapters compiled into it and the administration dashboard served alongside.
//
// The momobase library reads no environment of its own: this binary is the host,
// so reading configuration is its job and every setting below is resolved here.
package main

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/momobasehq/momobase"
	"github.com/spf13/cobra"

	"github.com/momobasehq/server/providers"
	"github.com/momobasehq/server/web"
)

// version is stamped at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	// A .env beside the binary is a development convenience. godotenv never
	// overwrites a variable the real environment already set, so a container that
	// passes its configuration in still wins, and a missing file is the normal
	// case rather than an error.
	_ = godotenv.Load()

	if err := newRootCommand().Execute(); err != nil {
		os.Exit(1)
	}
}

// dashboard holds the settings that belong to this binary rather than to the
// Momobase library, which knows nothing about a dashboard.
type dashboard struct {
	enabled bool
	path    string
}

// serverOptions carries the flags that override the environment.
type serverOptions struct {
	addr          string
	dashboardPath string
	dashboard     bool
}

// apply overrides the resolved configuration with the flags the user actually
// typed. Reading only the flags that changed is what keeps the order flag >
// environment > default without the environment having to be read before the
// command tree, and its flag defaults, exist.
func (o *serverOptions) apply(cmd *cobra.Command, cfg *momobase.Config, dash *dashboard) {
	flags := cmd.Flags()
	if flags.Changed("addr") {
		cfg.App.Addr = o.addr
	}
	if flags.Changed("dashboard-path") {
		dash.path = strings.TrimSuffix(o.dashboardPath, "/")
	}
	if flags.Changed("dashboard") {
		dash.enabled = o.dashboard
	}
}

func (o *serverOptions) bind(cmd *cobra.Command) {
	flags := cmd.Flags()
	flags.StringVar(&o.addr, "addr", "", "address the HTTP server listens on (default $APP_ADDR)")
	flags.StringVar(&o.dashboardPath, "dashboard-path", "", "URL prefix the dashboard is served under (default $DASHBOARD_PATH)")
	// Registered false rather than true only so pflag stays quiet about a default
	// that apply never reads; DASHBOARD_ENABLED, and its own default of true, is
	// what decides this when the flag is absent.
	flags.BoolVar(&o.dashboard, "dashboard", false, "serve the administration dashboard (default $DASHBOARD_ENABLED)")
}

func newRootCommand() *cobra.Command {
	serve := newServeCommand()
	root := &cobra.Command{
		Use:   "momobase",
		Short: "Momobase payment orchestration server",
		Long: `Momobase payment orchestration server.

Configuration is read from the environment and from a .env file in the working
directory; .env.example lists every variable. Flags override both.`,
		Version: version,
		// A failure to start is not a usage mistake, so it must not print the usage.
		SilenceUsage: true,
		// Root runs the server itself, so without this a mistyped subcommand would
		// be silently accepted as a positional argument and start one instead.
		Args: cobra.NoArgs,
		// The binary serves when given no subcommand, which is what the container
		// image and a bare `bin/momobase` both rely on.
		RunE: serve.RunE,
	}
	root.SetErrPrefix("momobase:")
	// The same flag values back both commands, so `momobase --addr` and
	// `momobase serve --addr` resolve identically.
	root.Flags().AddFlagSet(serve.Flags())
	root.AddCommand(serve, newSeedAdminCommand(), newVersionCommand(), newSelfUpdateCommand())
	return root
}

func newServeCommand() *cobra.Command {
	var opts serverOptions
	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Run the API server and the dashboard",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			cfg, dash, err := config()
			if err != nil {
				return err
			}
			opts.apply(cmd, &cfg, &dash)

			instance, err := newInstance(cfg, dash)
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
		},
	}
	opts.bind(cmd)
	return cmd
}

// seed-admin creates the first administrator and exits. It is not idempotent:
// running it twice with the same address fails on the uniqueness constraint.
func newSeedAdminCommand() *cobra.Command {
	var email, password, name string
	cmd := &cobra.Command{
		Use:   "seed-admin",
		Short: "Create the first administrator and exit",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			email = cmp.Or(email, os.Getenv("ADMIN_EMAIL"))
			password = cmp.Or(password, os.Getenv("ADMIN_PASSWORD"))
			name = cmp.Or(name, os.Getenv("ADMIN_NAME"), "Administrator")
			if email == "" || password == "" {
				return errors.New("seed-admin needs --email and --password (or ADMIN_EMAIL and ADMIN_PASSWORD)")
			}

			cfg, dash, err := config()
			if err != nil {
				return err
			}
			// The dashboard is not mounted for a one-shot command, and never needs to be.
			dash.enabled = false

			instance, err := newInstance(cfg, dash)
			if err != nil {
				return err
			}
			defer func() { _ = instance.Close() }()
			return instance.SeedAdmin(context.Background(), email, password, name)
		},
	}
	flags := cmd.Flags()
	flags.StringVar(&email, "email", "", "administrator email address (default $ADMIN_EMAIL)")
	flags.StringVar(&password, "password", "", "administrator password (default $ADMIN_PASSWORD)")
	flags.StringVar(&name, "name", "", "administrator display name (default $ADMIN_NAME)")
	return cmd
}

func newVersionCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print the version and exit",
		Args:  cobra.NoArgs,
		Run: func(*cobra.Command, []string) {
			fmt.Println(version)
		},
	}
}

// newInstance builds the server from a fully resolved configuration and mounts the
// dashboard when it is enabled.
func newInstance(cfg momobase.Config, dash dashboard) (*momobase.Instance, error) {
	// Validated after the flags have been applied so a flag cannot smuggle in a
	// setting the environment alone would have been rejected for.
	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	instance, err := momobase.New(
		momobase.WithConfig(cfg),
		momobase.WithProviders(providers.All()),
	)
	if err != nil {
		return nil, err
	}
	if dash.enabled {
		web.MountDashboard(instance.App(), dash.path)
	}
	return instance, nil
}

func dashboardTarget(dash dashboard) string {
	if !dash.enabled {
		return "disabled"
	}
	return dash.path + "/"
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
