package validate

import (
	"fmt"
	"strings"

	"github.com/iota-uz/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

// I18n checks that every required message ID localizes for every given locale.
func I18n(bundle *i18n.Bundle, requiredKeys []string, locales ...language.Tag) error {
	if bundle == nil {
		return fmt.Errorf("i18n bundle is nil")
	}
	var missing []string
	for _, locale := range locales {
		localizer := i18n.NewLocalizer(bundle, locale.String())
		for _, key := range requiredKeys {
			_, err := localizer.Localize(&i18n.LocalizeConfig{MessageID: key})
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
