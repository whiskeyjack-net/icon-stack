import { createI18n, activeLanguage } from '@whiskeyjack-net/i18n'
import de from './locales/de.json'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import ja from './locales/ja.json'
import pt from './locales/pt.json'
import zh from './locales/zh.json'

// One createI18n() wires language detection, the `en` fallback, and
// <html lang/dir> (RTL) sync. Add a locale = add a JSON file + a line here.
//
// Key parity across every file is pinned by src/i18n/locales.test.ts, which also
// checks that {{interpolation}} placeholders survive translation -- a dropped
// placeholder renders the raw token to the user, and no type checks that.
const locales: Record<string, Record<string, unknown>> = { de, en, es, fr, it, ja, pt, zh }

export const SUPPORTED_LANGUAGES = Object.keys(locales)
export { activeLanguage }
export default createI18n(locales)
