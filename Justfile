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
    pnpm build

# Install npm dependencies
deps-npm:
    pnpm install

# Run npm build in watch mode
watch-npm:
    pnpm exec tsup --config tsup.dev.config.ts --watch

# Lint the npm package
lint-npm:
    pnpm lint

# Run all checks (vet + lint + test)
check: vet lint test

# Clean build artifacts
clean:
    rm -rf dist
    go clean -cache
