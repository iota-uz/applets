package applet

import (
	"maps"
	"strings"

	"github.com/iota-uz/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

// getAllTranslations returns applet translation key/value pairs for the provided locale.
// Results are cached per locale and shaped by the configured I18n mode:
//   - all: include all translation keys
//   - prefixes: include only keys matching configured prefixes
//   - none: include no translations
//
// The returned map is safe to mutate (it is a copy of the cached data).
func (b *ContextBuilder) getAllTranslations(locale language.Tag) map[string]string {
	localeKey := locale.String()

	b.translationsMu.RLock()
	if cached, ok := b.translationsCache[localeKey]; ok {
		b.translationsMu.RUnlock()
		return maps.Clone(cached)
	}
	b.translationsMu.RUnlock()

	b.translationsMu.Lock()
	if cached, ok := b.translationsCache[localeKey]; ok {
		b.translationsMu.Unlock()
		return maps.Clone(cached)
	}
	defer b.translationsMu.Unlock()

	mode := b.config.I18n.Mode
	if mode == "" {
		mode = TranslationModeAll
	}
	if mode == TranslationModeNone {
		out := make(map[string]string)
		b.translationsCache[localeKey] = out
		return maps.Clone(out)
	}

	prefixes := make([]string, 0, len(b.config.I18n.Prefixes))
	if mode == TranslationModePrefixes {
		for _, p := range b.config.I18n.Prefixes {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			prefixes = append(prefixes, p)
		}
		if len(prefixes) == 0 {
			out := make(map[string]string)
			b.translationsCache[localeKey] = out
			return maps.Clone(out)
		}
	}

	if b.bundle == nil {
		out := make(map[string]string)
		b.translationsCache[localeKey] = out
		return maps.Clone(out)
	}

	// Get all messages for the user's locale
	messages := b.bundle.Messages()
	localeMessages, exists := messages[locale]
	if !exists {
		// Locale not found, return empty map
		if b.logger != nil {
			b.logger.WithField("locale", locale.String()).Warn("No translations found for locale")
		}
		out := make(map[string]string)
		b.translationsCache[localeKey] = out
		return maps.Clone(out)
	}

	translations := make(map[string]string, len(localeMessages))
	if mode == TranslationModePrefixes {
		translations = make(map[string]string)
	}

	// Create localizer for the user's locale
	localizer := i18n.NewLocalizer(b.bundle, locale.String())

	for messageID := range localeMessages {
		if mode == TranslationModePrefixes {
			match := false
			for _, p := range prefixes {
				if strings.HasPrefix(messageID, p) {
					match = true
					break
				}
			}
			if !match {
				continue
			}
		}
		translation, err := localizer.Localize(&i18n.LocalizeConfig{
			MessageID: messageID,
		})
		if err != nil {
			if b.logger != nil {
				b.logger.WithError(err).WithField("message_id", messageID).Debug("Skipping message ID with no direct string (e.g. parent key)")
			}
			continue
		}
		translations[messageID] = translation
	}

	b.translationsCache[localeKey] = translations
	return maps.Clone(translations)
}
