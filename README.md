<div align="center">

<img src="dashboard/public/brand.svg" alt="" width="80" height="80">

<h1>Momobase Server</h1>

<p>
The runnable distribution of <a href="https://github.com/momobasehq/momobase">Momobase</a>:
a single binary carrying the payment orchestration API, the payment adapters compiled
into it, and the administration dashboard.
</p>

<p>
<a href="https://github.com/momobasehq/server/actions/workflows/ci.yml"><img src="https://github.com/momobasehq/server/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
<a href="https://github.com/momobasehq/server/releases/latest"><img src="https://img.shields.io/github/v/release/momobasehq/server?label=release" alt="Latest release"></a>
<a href="https://github.com/momobasehq/server/pkgs/container/server"><img src="https://img.shields.io/badge/ghcr.io-momobasehq%2Fserver-2496ed?logo=docker&logoColor=white" alt="Container image"></a>
<a href="go.mod"><img src="https://img.shields.io/github/go-mod/go-version/momobasehq/server" alt="Go version"></a>
<a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT licence"></a>
</p>

</div>

Momobase itself is a Go library you embed. This repository is the batteries-included host
built on it — if you want to compile your own adapters into your own process, embed the
library directly instead.

## Run it

```sh
cp .env.example .env      # fill in the three secrets, see below
docker compose up -d
docker compose run --rm momobase seed-admin --email you@example.com --password 'change me'
```

The API is on `http://localhost:9090` and the dashboard on `http://localhost:9090/dashboard/`.

Or run the binary directly against SQLite:

```sh
cp .env.example .env      # every variable the binary reads, with its default
make build
bin/momobase serve
```

`.env.example` lists every variable and is the authoritative list; the table below is
the subset a deployment usually sets. A `.env` in the working directory is loaded at
start-up and never overrides a variable the real environment already set. Flags beat
both: `--addr`, `--dashboard`, and `--dashboard-path`. Run `momobase --help` for the
commands.

## Generate the secrets

Three values have no safe default. `APP_ENV=production` or `staging` refuses to start
without them:

```sh
$ openssl rand -base64 32      # ENCRYPTION_MASTER_KEY_BASE64
2xNqLv8mRkYc7wEo0pTz4sBd9fHj6aUn3iXg1rVe5Q0=

$ openssl rand -hex 32         # ADMIN_OAUTH_SECRET
c93f1a7e05d84b26f1a0c73e8b25d940e7c86a31f5b02d74e9a13c68f0b47d25

$ openssl rand -hex 32         # APP_OAUTH_SECRET
8a05e71c3b96d240f8c15b73a09e46d215f8c07b3ae94d61c05a72f8b31e690d
```

The encryption key must decode to exactly 32 bytes, so `-base64 32` is a requirement
rather than a suggestion. The two signing secrets need 32 characters or more, and should
differ from each other. Back the encryption key up with the database: without it, stored
provider configuration cannot be decrypted.

## Configuration

The Momobase library reads no environment of its own. This binary is the host, so it does
that reading and passes a `momobase.Config` down. Everything is set through the
environment; see `cmd/momobase/main.go` for the full list and
[the configuration reference](https://momobasehq.github.io/reference/configuration) for
what each field does.

| Variable                                             | Default                 | Notes                             |
| ---------------------------------------------------- | ----------------------- | --------------------------------- |
| `APP_ADDR`                                           | `:9090`                 | Listen address                    |
| `APP_ENV`                                            | `development`           | `staging`/`production` gate secrets |
| `APP_PUBLIC_URL`                                     | `http://localhost:9090` | Must be `https://` in production  |
| `CORS_ALLOWED_ORIGINS`                               | localhost               | Comma-separated                   |
| `DB_TYPE`                                            | `sqlite`                | `sqlite`, `postgres`, `mysql`     |
| `DB_PATH`                                            | `/data/momobase.db`     | SQLite only                       |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | —                       | PostgreSQL and MySQL              |
| `ENCRYPTION_MASTER_KEY_BASE64`                       | dev placeholder         | See above                         |
| `ADMIN_OAUTH_SECRET` `APP_OAUTH_SECRET`              | dev placeholders        | See above                         |
| `WORKERS_ENABLED`                                    | `true`                  | Disable on all but one replica    |
| `*_TTL_MINUTES` `*_TTL_HOURS` `*_INTERVAL_SECONDS`   | see `.env.example`      | Whole numbers in the named unit   |
| `AUTO_MIGRATE`                                       | `true`                  | Disable to migrate deliberately   |
| `DASHBOARD_ENABLED`                                  | `true`                  | Set false to serve the API alone  |
| `DASHBOARD_PATH`                                     | `/dashboard`            | URL prefix for the dashboard      |

## Commands

```sh
momobase serve                              # default
momobase seed-admin --email … --password …  # one-time, not idempotent
momobase version
```

## Providers

`providers/providers.go` is the single place that decides which rails a build can
execute. It currently registers only `dummy`, the deterministic simulator that moves no
money, so a fresh deployment can be exercised end to end. Add an adapter with one line
there; remove `dummy` for a build that must not run it.

## The dashboard

`dashboard/` is a Vite/React application whose built bundle in `dashboard/dist` is
embedded by `dashboard/embed.go`. The bundle is not committed, so it has to be built
before the Go packages compile: `make build`, `make test` and `make vet` build it when
it is missing or older than the dashboard sources, the workflows run `make dashboard`
before anything Go, and the Dockerfile builds it in its own Node stage.

That means a bare `go build` fails on a fresh clone until the bundle exists. Building it
needs Node and pnpm; run `make dashboard` to force a rebuild.

## Releases

Pushing a `v*.*.*` tag builds and publishes:

- binaries for linux and macOS on amd64 and arm64, attached to the GitHub release with
  `SHA256SUMS`;
- a multi-arch image at `ghcr.io/momobasehq/server`, tagged with the version and `latest`.

Each binary is built on a runner of its own architecture because the SQLite driver links
through cgo, which makes cross-compiling more trouble than a matrix. Windows is not built
for that same reason.

## Development

```sh
make quality      # fmt-check + vet + test
make build
make dashboard    # force a rebuild of the embedded bundle
```

## License

MIT
