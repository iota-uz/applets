package cli

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/iota-uz/applets/config"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/spf13/cobra"
)

func NewSecretsCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "secrets",
		Short: "Manage applet secrets",
	}
	cmd.AddCommand(newSecretsSetCommand())
	cmd.AddCommand(newSecretsListCommand())
	cmd.AddCommand(newSecretsDeleteCommand())
	return cmd
}

func newSecretsSetCommand() *cobra.Command {
	var appletName string
	var key string
	var value string
	cmd := &cobra.Command{
		Use:   "set",
		Short: "Set an applet secret",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if strings.TrimSpace(appletName) == "" {
				return errors.New("--name is required")
			}
			if strings.TrimSpace(key) == "" {
				return errors.New("--key is required")
			}
			root, cfg, err := config.LoadFromCWD()
			if err != nil {
				return err
			}
			_, err = config.ResolveApplet(cfg, appletName)
			if err != nil {
				return err
			}
			engineCfg := cfg.EffectiveEngineConfig(appletName)
			switch engineCfg.Backends.Secrets {
			case config.SecretsBackendEnv:
				envKey := appletSecretEnvKey(appletName, key)
				if err := os.Setenv(envKey, value); err != nil {
					return err
				}
				cmd.Println("Set process-local env secret:", envKey)
				cmd.Println("Note: persist this in your shell/session manager for runtime use.")
				return nil
			case config.SecretsBackendPostgres:
				ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				defer cancel()
				pool, err := openSecretsDBPool(ctx)
				if err != nil {
					return err
				}
				defer pool.Close()

				masterKeyBytes, err := os.ReadFile(resolvePath(root, engineCfg.Secrets.MasterKeyFile))
				if err != nil {
					return fmt.Errorf("read master key file: %w", err)
				}
				cipherText, err := encryptWithMasterKey(strings.TrimSpace(string(masterKeyBytes)), value)
				if err != nil {
					return err
				}
				_, err = pool.Exec(ctx, `
INSERT INTO applet_engine_secrets(applet_id, secret_name, cipher_text)
VALUES ($1, $2, $3)
ON CONFLICT (applet_id, secret_name)
DO UPDATE SET cipher_text = EXCLUDED.cipher_text, updated_at = NOW()
`, appletName, key, cipherText)
				if err != nil {
					return fmt.Errorf("set postgres secret: %w", err)
				}
				cmd.Println("Secret set:", key)
				return nil
			default:
				return fmt.Errorf("unsupported secrets backend: %s", engineCfg.Backends.Secrets)
			}
		},
	}
	cmd.Flags().StringVar(&appletName, "name", "", "Applet name")
	cmd.Flags().StringVar(&key, "key", "", "Secret key")
	cmd.Flags().StringVar(&value, "value", "", "Secret value")
	return cmd
}

func newSecretsListCommand() *cobra.Command {
	var appletName string
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List secret keys for an applet",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if strings.TrimSpace(appletName) == "" {
				return errors.New("--name is required")
			}
			_, cfg, err := config.LoadFromCWD()
			if err != nil {
				return err
			}
			_, err = config.ResolveApplet(cfg, appletName)
			if err != nil {
				return err
			}
			engineCfg := cfg.EffectiveEngineConfig(appletName)
			switch engineCfg.Backends.Secrets {
			case config.SecretsBackendEnv:
				prefix := appletSecretEnvKey(appletName, "")
				keys := make([]string, 0)
				for _, item := range os.Environ() {
					if !strings.HasPrefix(item, prefix) {
						continue
					}
					idx := strings.IndexByte(item, '=')
					if idx <= 0 {
						continue
					}
					keys = append(keys, item[:idx])
				}
				sort.Strings(keys)
				for _, secretKey := range keys {
					cmd.Println(secretKey)
				}
				return nil
			case config.SecretsBackendPostgres:
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				pool, err := openSecretsDBPool(ctx)
				if err != nil {
					return err
				}
				defer pool.Close()

				rows, err := pool.Query(ctx, `
SELECT secret_name
FROM applet_engine_secrets
WHERE applet_id = $1
ORDER BY secret_name ASC
`, appletName)
				if err != nil {
					return fmt.Errorf("list postgres secrets: %w", err)
				}
				defer rows.Close()
				for rows.Next() {
					var name string
					if scanErr := rows.Scan(&name); scanErr != nil {
						return fmt.Errorf("scan secret row: %w", scanErr)
					}
					cmd.Println(name)
				}
				return rows.Err()
			default:
				return fmt.Errorf("unsupported secrets backend: %s", engineCfg.Backends.Secrets)
			}
		},
	}
	cmd.Flags().StringVar(&appletName, "name", "", "Applet name")
	return cmd
}

func newSecretsDeleteCommand() *cobra.Command {
	var appletName string
	var key string
	cmd := &cobra.Command{
		Use:   "delete",
		Short: "Delete an applet secret",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if strings.TrimSpace(appletName) == "" {
				return errors.New("--name is required")
			}
			if strings.TrimSpace(key) == "" {
				return errors.New("--key is required")
			}
			_, cfg, err := config.LoadFromCWD()
			if err != nil {
				return err
			}
			_, err = config.ResolveApplet(cfg, appletName)
			if err != nil {
				return err
			}
			engineCfg := cfg.EffectiveEngineConfig(appletName)
			switch engineCfg.Backends.Secrets {
			case config.SecretsBackendEnv:
				envKey := appletSecretEnvKey(appletName, key)
				if err := os.Unsetenv(envKey); err != nil {
					return err
				}
				cmd.Println("Deleted process-local env secret:", envKey)
				return nil
			case config.SecretsBackendPostgres:
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				pool, err := openSecretsDBPool(ctx)
				if err != nil {
					return err
				}
				defer pool.Close()

				commandTag, err := pool.Exec(ctx, `
DELETE FROM applet_engine_secrets
WHERE applet_id = $1 AND secret_name = $2
`, appletName, key)
				if err != nil {
					return fmt.Errorf("delete postgres secret: %w", err)
				}
				if commandTag.RowsAffected() == 0 {
					return fmt.Errorf("secret not found: %s", key)
				}
				cmd.Println("Secret deleted:", key)
				return nil
			default:
				return fmt.Errorf("unsupported secrets backend: %s", engineCfg.Backends.Secrets)
			}
		},
	}
	cmd.Flags().StringVar(&appletName, "name", "", "Applet name")
	cmd.Flags().StringVar(&key, "key", "", "Secret key")
	return cmd
}

func openSecretsDBPool(ctx context.Context) (*pgxpool.Pool, error) {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		return nil, errors.New("DATABASE_URL is required for postgres secrets backend")
	}
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}
	return pool, nil
}

func resolvePath(root, value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if strings.HasPrefix(value, "/") {
		return value
	}
	return strings.TrimSpace(root + string(os.PathSeparator) + value)
}

func appletSecretEnvKey(appletName, key string) string {
	prefix := normalizeSecretSegment(appletName)
	if strings.TrimSpace(key) == "" {
		return "IOTA_APPLET_SECRET_" + prefix + "_"
	}
	return fmt.Sprintf("IOTA_APPLET_SECRET_%s_%s", prefix, normalizeSecretSegment(key))
}

func normalizeSecretSegment(input string) string {
	var b strings.Builder
	b.Grow(len(input))
	for _, r := range input {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(unicode.ToUpper(r))
		default:
			b.WriteByte('_')
		}
	}
	return strings.Trim(b.String(), "_")
}

func encryptWithMasterKey(rawMasterKey, plaintext string) (string, error) {
	key, err := decodeMasterKey(rawMasterKey)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("create cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("create gcm: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	cipherText := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	payload := append(nonce, cipherText...)
	return base64.StdEncoding.EncodeToString(payload), nil
}

func decodeMasterKey(raw string) ([]byte, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("secrets master key is required")
	}
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return nil, fmt.Errorf("decode secrets master key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("secrets master key must decode to 32 bytes (got %d)", len(key))
	}
	return key, nil
}
