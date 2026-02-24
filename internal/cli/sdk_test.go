package cli

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFilterLinkableSDKTargets(t *testing.T) {
	t.Parallel()

	tmp := t.TempDir()

	sdkRoot := filepath.Join(tmp, "applets")
	if err := os.MkdirAll(sdkRoot, 0o755); err != nil {
		t.Fatalf("mkdir sdk root: %v", err)
	}
	if err := os.WriteFile(filepath.Join(sdkRoot, "package.json"), []byte(`{"name":"@iota-uz/sdk"}`), 0o644); err != nil {
		t.Fatalf("write sdk package.json: %v", err)
	}

	namedConsumer := filepath.Join(tmp, "named-consumer")
	if err := os.MkdirAll(namedConsumer, 0o755); err != nil {
		t.Fatalf("mkdir named consumer: %v", err)
	}
	if err := os.WriteFile(filepath.Join(namedConsumer, "package.json"), []byte(`{"name":"@eai/ali-web"}`), 0o644); err != nil {
		t.Fatalf("write named consumer package.json: %v", err)
	}

	unnamedConsumer := filepath.Join(tmp, "unnamed-consumer")
	if err := os.MkdirAll(unnamedConsumer, 0o755); err != nil {
		t.Fatalf("mkdir unnamed consumer: %v", err)
	}
	if err := os.WriteFile(filepath.Join(unnamedConsumer, "package.json"), []byte(`{"devDependencies":{"@iota-uz/sdk":"0.4.23"}}`), 0o644); err != nil {
		t.Fatalf("write unnamed consumer package.json: %v", err)
	}

	linkable, skipped := filterLinkableSDKTargets([]string{sdkRoot, namedConsumer, unnamedConsumer}, sdkRoot)
	if len(linkable) != 1 || linkable[0] != namedConsumer {
		t.Fatalf("unexpected linkable targets: %#v", linkable)
	}
	if len(skipped) != 2 {
		t.Fatalf("expected 2 skipped targets, got %d", len(skipped))
	}

	reasons := map[string]string{}
	for _, s := range skipped {
		reasons[s.dir] = s.reason
	}

	if reasons[sdkRoot] != "canonical @iota-uz/sdk source is not a consumer target" {
		t.Fatalf("unexpected sdk root skip reason: %q", reasons[sdkRoot])
	}
	if reasons[unnamedConsumer] != "package.json has no `name`; pnpm global link is unreliable for unnamed importers" {
		t.Fatalf("unexpected unnamed skip reason: %q", reasons[unnamedConsumer])
	}
}
