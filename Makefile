BIN ?= bin/momobase
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

# dashboard/embed.go embeds dashboard/dist, which is not committed, so the bundle has
# to exist before anything compiles the Go packages. Depending on the tracked dashboard
# sources keeps a source edit from shipping a stale bundle without forcing a Vite run
# on every build.
BUNDLE := dashboard/dist/index.html
DASHBOARD_SRC := $(shell git ls-files dashboard ':!:dashboard/*.go' 2>/dev/null)

build: $(BUNDLE)
	CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o $(BIN) ./cmd/momobase

# The race detector is the one thing here that still needs cgo: it is implemented in C
# and refuses to run without it, whatever the SQLite driver is compiled from.
test: $(BUNDLE)
	CGO_ENABLED=1 go test -race ./...

vet: $(BUNDLE)
	go vet ./...

fmt:
	gofmt -w $$(git ls-files '*.go')

fmt-check:
	@test -z "$$(gofmt -l $$(git ls-files '*.go'))" || (gofmt -l $$(git ls-files '*.go'); exit 1)

tidy:
	go mod tidy

# `make dashboard` forces a rebuild; the file target lets every other rule ask for the
# bundle and get one only when it is missing or older than the sources.
$(BUNDLE) dashboard: $(DASHBOARD_SRC)
	cd dashboard && pnpm install --frozen-lockfile && pnpm run build

quality: fmt-check vet test

.PHONY: build test vet fmt fmt-check tidy dashboard quality
