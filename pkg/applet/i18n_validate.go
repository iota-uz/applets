package applet

import (
	"fmt"
	"strings"

	"github.com/iota-uz/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

// ValidateI18n checks that every required message ID localizes successfully for every given locale.
// Use with Config.I18n.RequiredKeys (e.g. nav item keys) in CI to fail fast when a key is missing.
// Returns an error listing any missing keys per locale.
func ValidateI18n(bundle *i18n.Bundle, requiredKeys []string, locales ...language.Tag) error {
	if bundle == nil {
		return fmt.Errorf("i18n bundle is nil")
	}

	var missing []string
	for _, locale := range locales {
		localizer := i18n.NewLocalizer(bundle, locale.String())
		for _, key := range requiredKeys {
			_, err := localizer.Localize(&i18n.LocalizeConfig{
				MessageID: key,
			})
			if err != nil {
				missing = append(missing, fmt.Sprintf("%s:%s", locale.String(), key))
			}
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("i18n missing required keys: %s", strings.Join(missing, ", "))
	}
	return nil
}
