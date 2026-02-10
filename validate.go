package applets

import (
	"github.com/iota-uz/applets/internal/validate"
	"github.com/iota-uz/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

func ValidateAppletName(name string) error {
	return validate.AppletName(name)
}

func ValidateConfig(config Config) error {
	return validate.Config(config)
}

func ValidateI18n(bundle *i18n.Bundle, requiredKeys []string, locales ...language.Tag) error {
	return validate.I18n(bundle, requiredKeys, locales...)
}
