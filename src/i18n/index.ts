import { createI18n, activeLanguage } from '@whiskeyjack-net/i18n'
import en from './locales/en.json'
import es from './locales/es.json'

// One createI18n() wires language detection, the `en` fallback, and
// <html lang/dir> (RTL) sync. Add a locale = add a JSON file + a line here.
const locales: Record<string, Record<string, unknown>> = { en, es }

export const SUPPORTED_LANGUAGES = Object.keys(locales)
export { activeLanguage }
export default createI18n(locales)
