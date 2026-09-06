# dashboard/dist is not committed, so the bundle dashboard/embed.go embeds is built here
# and copied into the Go build. --platform pins this stage to the builder's own
# architecture: the bundle is the same bytes everywhere, so running Vite under emulation
# once per target platform would cost minutes for an identical result.
FROM --platform=$BUILDPLATFORM node:24-alpine AS dashboard

RUN corepack enable

WORKDIR /src/dashboard

# The dependency install survives every edit that does not touch the manifests.
COPY dashboard/package.json dashboard/pnpm-lock.yaml dashboard/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY dashboard/ ./
RUN pnpm run build

FROM golang:1.26-alpine AS build

WORKDIR /src

# Dependencies resolve from the manifests alone, so this layer survives every source
# edit that does not change them.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=dashboard /src/dashboard/dist ./dashboard/dist

# The SQLite driver is pure Go, so nothing here links against libc and the binary
# runs on any base image regardless of the C library it ships.
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags "-s -w -X main.version=${VERSION}" \
    -o /out/momobase ./cmd/momobase

FROM alpine:3.22

# ca-certificates for outbound provider APIs over TLS, tzdata because scheduling and
# reporting resolve real time zones.
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 10001 -h /home/momobase momobase \
    && mkdir -p /data && chown momobase:momobase /data

COPY --from=build /out/momobase /usr/local/bin/momobase

USER momobase
WORKDIR /home/momobase

# The default database path lives on the volume rather than the container's writable
# layer, so a SQLite deployment survives a restart without extra configuration.
ENV APP_ADDR=:9090 \
    DB_PATH=/data/momobase.db
VOLUME ["/data"]
EXPOSE 9090

# /healthz is the lightweight readiness endpoint; it does not call providers, so a
# provider outage does not restart the container.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:9090/healthz >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/usr/local/bin/momobase"]
CMD ["serve"]
