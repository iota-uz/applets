package context

import (
	"maps"
	"strings"

	"github.com/iota-uz/applets/internal/api"
	"golang.org/x/text/language"
)

func (b *ContextBuilder) getAllTranslations(locale language.Tag) map[string]string {
	localeKey := locale.String()
	b.translationsMu.RLock()
	if cached, ok := b.translationsCache[localeKey]; ok {
		b.translationsMu.RUnlock()
		return maps.Clone(cached)
	}
	b.translationsMu.RUnlock()

	b.translationsMu.Lock()
	defer b.translationsMu.Unlock()
	if cached, ok := b.translationsCache[localeKey]; ok {
		return maps.Clone(cached)
	}

	mode := b.config.I18n.Mode
	if mode == "" {
		mode = api.TranslationModeAll
	}
	if mode == api.TranslationModeNone {
		out := make(map[string]string)
		b.translationsCache[localeKey] = out
		return maps.Clone(out)
	}

	var prefixes []string
	if mode == api.TranslationModePrefixes {
		for _, p := range b.config.I18n.Prefixes {
			p = strings.TrimSpace(p)
			if p != "" {
				prefixes = append(prefixes, p)
			}
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

	messages := b.bundle.Messages()
	localeMessages, exists := messages[locale]
	if !exists {
		if b.logger != nil {
			b.logger.WithField("locale", locale.String()).Warn("No translations found for locale")
		}
		out := make(map[string]string)
		b.translationsCache[localeKey] = out
		return maps.Clone(out)
	}

	translations := make(map[string]string)
	for messageID, mt := range localeMessages {
		if mt == nil {
			continue
		}
		if mode == api.TranslationModePrefixes {
			matched := false
			for _, p := range prefixes {
				if strings.HasPrefix(messageID, p) {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		if mt.Other == "" {
			continue
		}
		translations[messageID] = mt.Other
	}
	b.translationsCache[localeKey] = translations
	return maps.Clone(translations)
}
