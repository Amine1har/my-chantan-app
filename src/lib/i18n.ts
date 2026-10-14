import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'dv'])

const SAVED_LANG_KEY = 'app:lang'
const DEFAULT_LANG = 'en'

const localeModules = import.meta.glob('@/locales/*.json', { eager: true }) as Record<string, { default: Record<string, string> }>
const resources: Record<string, { translation: Record<string, string> }> = {}
for (const [path, mod] of Object.entries(localeModules)) {
  const code = path.split('/').pop()!.replace('.json', '')
  resources[code] = { translation: mod.default }
}

const normalize = (l: string | null | undefined): string => (l || '').toLowerCase().split('-')[0]
// A language exists only when its catalog has real keys — the scaffold's empty
// {} stub must not defeat the pre-i18n document-root escape below.
const realLangs = Object.keys(resources).filter((c) => Object.keys(resources[c].translation || {}).length > 0)
const hasCatalog = (l: string): boolean => !!l && realLangs.includes(l)
const storedRaw = typeof window !== 'undefined' ? localStorage.getItem(SAVED_LANG_KEY) : null
const stored = normalize(storedRaw)
const docLang = typeof document !== 'undefined' ? normalize(document.documentElement.lang) : ''
// Boot order: validated stored choice → document root → project default.
// A project with no real catalogs yet (pre-i18n) honors the document root as-is.
const initialLang = stored && hasCatalog(stored)
  ? stored
  : docLang && (hasCatalog(docLang) || realLangs.length === 0)
    ? docLang
    : DEFAULT_LANG
// Overwrite a stale/invalid stored value so it can't poison future visits.
if (typeof window !== 'undefined' && storedRaw !== initialLang) {
  try { localStorage.setItem(SAVED_LANG_KEY, initialLang) } catch {}
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
  // Keys are the full source-language text. Without these flags i18next would
  // interpret dots/colons as nested namespaces and fail to find them. Setting
  // both to false makes the key string literal and treats missing keys as
  // their own fallback value (source text).
  keySeparator: false,
  nsSeparator: false,
})

if (typeof document !== 'undefined') {
  const apply = (lng: string) => {
    document.documentElement.lang = lng
    document.documentElement.dir = RTL_LANGS.has(normalize(lng)) ? 'rtl' : 'ltr'
  }
  apply(initialLang)
  i18n.on('languageChanged', (lng) => {
    apply(lng)
    try { localStorage.setItem(SAVED_LANG_KEY, lng) } catch {}
  })
}

export default i18n
