# The dashboard bundle in dashboard/dist is committed and embedded by dashboard/embed.go,
# so this image needs no Node stage. Rebuild the bundle with `make dashboard` when the
# dashboard source changes; a stale dist ships silently otherwise.

FROM golang:1.26-alpine AS build

# Momobase's SQLite driver links through cgo, so the build needs a C toolchain even
# for a deployment that runs PostgreSQL: the driver is compiled either way.
RUN apk add --no-cache gcc musl-dev

WORKDIR /src

# Dependencies resolve from the manifests alone, so this layer survives every source
# edit that does not change them.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=dev
RUN CGO_ENABLED=1 GOOS=linux go build \
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
