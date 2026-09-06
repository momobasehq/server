<div align="center">

<img src="dashboard/public/brand.svg" alt="" width="80" height="80">

<h1>Momobase Server</h1>

<p>
Payment orchestration in a single binary: the HTTP API, the payment adapters
compiled into it, and the administration dashboard.
</p>

<p>
<a href="https://github.com/momobasehq/server/releases/latest"><img src="https://img.shields.io/github/v/release/momobasehq/server?label=release" alt="Latest release"></a>
<a href="https://github.com/momobasehq/server/pkgs/container/server"><img src="https://img.shields.io/badge/ghcr.io-momobasehq%2Fserver-2496ed?logo=docker&logoColor=white" alt="Container image"></a>
<a href="https://momobasehq.github.io/"><img src="https://img.shields.io/badge/docs-momobasehq.github.io-informational" alt="Documentation"></a>
<a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT licence"></a>
</p>

</div>

Run this if you want Momobase as a service. If you need your own adapters compiled into
your own process, embed [the library](https://github.com/momobasehq/momobase) instead.

## Quick start

Docker Compose, with PostgreSQL:

```sh
cp .env.example .env   # set POSTGRES_PASSWORD and the three secrets below
docker compose up -d
docker compose run --rm momobase seed-admin --email you@example.com --password 'change me'
```

Or a release binary, with SQLite:

```sh
unzip momobase_<version>_<os>_<arch>.zip   # from the releases page
./momobase seed-admin --email you@example.com --password 'change me'
./momobase serve
```

That starts unconfigured, on development placeholders and a local SQLite file. Set the
secrets below before it is anything but a local instance.

The API is then on `http://localhost:9090`, the dashboard on
`http://localhost:9090/dashboard/`. Sign in with the administrator you just seeded.

## Secrets

Three values have no safe default, and `APP_ENV=staging` or `production` refuses to
start without them:

| Variable                       | Generate with           | Requirement                                  |
| ------------------------------ | ----------------------- | -------------------------------------------- |
| `ENCRYPTION_MASTER_KEY_BASE64` | `openssl rand -base64 32` | decodes to exactly 32 bytes                 |
| `ADMIN_OAUTH_SECRET`           | `openssl rand -hex 32`  | 32 characters or more                        |
| `APP_OAUTH_SECRET`             | `openssl rand -hex 32`  | 32 characters or more, different from the admin one |

Back the encryption key up with the database. Without it, stored provider
configuration cannot be decrypted.

## Configuration

Settings come from the environment, from a `.env` file in the working directory, or from
flags, in that order of precedence — a `.env` value never overrides one already set in
the real environment. `.env.example` lists every variable with its default; below is the
subset a deployment usually touches. What each one does is in the
[configuration reference](https://momobasehq.github.io/reference/configuration).

| Variable                                              | Default                 | Notes                               |
| ----------------------------------------------------- | ----------------------- | ----------------------------------- |
| `APP_ADDR`                                            | `:9090`                 | Listen address                      |
| `APP_ENV`                                             | `development`           | `staging`/`production` gate secrets |
| `APP_PUBLIC_URL`                                      | `http://localhost:9090` | Must be `https://` in production    |
| `CORS_ALLOWED_ORIGINS`                                | localhost               | Comma-separated                     |
| `TRUSTED_PROXY_CIDRS`                                 | —                       | Set behind a proxy, or rate limiting keys every client to one bucket |
| `DB_TYPE`                                             | `sqlite`                | `sqlite`, `postgres`, `mysql`       |
| `DB_PATH`                                             | `./data/momobase.db`    | SQLite only; `/data/momobase.db` in the container |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | —                       | PostgreSQL and MySQL                |
| `WORKERS_ENABLED`                                     | `true`                  | Disable on all but one replica      |
| `AUTO_MIGRATE`                                        | `true`                  | Disable to migrate deliberately     |
| `DASHBOARD_ENABLED`                                   | `true`                  | Set false to serve the API alone    |
| `DASHBOARD_PATH`                                      | `/dashboard`            | URL prefix for the dashboard        |

`--addr`, `--dashboard` and `--dashboard-path` are the flag equivalents.

## Commands

```sh
momobase serve                              # also what a bare `momobase` does
momobase seed-admin --email … --password …  # one-time, fails if the address exists
momobase version
momobase --help
```

## Providers

A build can only execute the rails compiled into it. This one registers `dummy`, a
deterministic simulator that moves no money, so a fresh deployment can be exercised end
to end. `providers/providers.go` is where an adapter is added, and where `dummy` is
removed for a build that must not run it — both one-line changes, then rebuild.

## License

Released under [MIT License](./LICENSE.txt).
