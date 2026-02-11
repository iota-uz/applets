# Install the applet CLI from local source
install:
    go install ./cmd/applet

# Run all tests
test:
    go test ./...

# Vet the code
vet:
    go vet ./...

# Format Go code
fmt:
    go fmt ./...

# Run golangci-lint
lint:
    golangci-lint run ./...

# Run golangci-lint with auto-fix
lint-fix:
    golangci-lint run --fix ./...

# Build the npm package
build-npm:
    cd ui && pnpm build

# Install npm dependencies
deps-npm:
    cd ui && pnpm install

# Run npm build in watch mode
watch-npm:
    cd ui && pnpm build --watch

# Lint the npm package
lint-npm:
    cd ui && pnpm lint

# Run all checks (vet + lint + test)
check: vet lint test

# Clean build artifacts
clean:
    rm -rf ui/dist
    go clean -cache
