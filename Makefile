BIN ?= bin/momobase
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

build:
	CGO_ENABLED=1 go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o $(BIN) ./cmd/momobase

test:
	CGO_ENABLED=1 go test -race ./...

vet:
	go vet ./...

fmt:
	gofmt -w $$(git ls-files '*.go')

fmt-check:
	@test -z "$$(gofmt -l $$(git ls-files '*.go'))" || (gofmt -l $$(git ls-files '*.go'); exit 1)

tidy:
	go mod tidy

# Rebuilds the bundle dashboard/embed.go embeds. dashboard/dist is committed, so run
# this and commit the result whenever the dashboard source changes.
dashboard:
	cd dashboard && pnpm install && pnpm run build

quality: fmt-check vet test

.PHONY: build test vet fmt fmt-check tidy dashboard quality
