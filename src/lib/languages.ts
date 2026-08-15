/**
 * Supported practice languages.
 * Single source of truth for the UI selector, the AI prompt, TTS voice and STT locale.
 */

export type LanguageCode = 'en' | 'fr' | 'pt';

export type LanguageConfig = {
  code: LanguageCode;
  label: string; // English label for the UI
  nativeLabel: string; // Native label shown in the selector
  flag: string;
  promptName: string; // How the language is named to the AI ("English", "French"...)
  bcp47: string; // Locale used for Web Speech STT and Google TTS languageCode
  ttsVoice: string; // A Google Cloud TTS voice for this language
  ttsRate: number;
};

export const LANGUAGES: Record<LanguageCode, LanguageConfig> = {
  en: {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    flag: '🇬🇧',
    promptName: 'English',
    bcp47: 'en-US',
    ttsVoice: 'en-US-Neural2-C',
    ttsRate: 1.0,
  },
  fr: {
    code: 'fr',
    label: 'French',
    nativeLabel: 'Français',
    flag: '🇫🇷',
    promptName: 'French',
    bcp47: 'fr-FR',
    ttsVoice: 'fr-FR-Neural2-A',
    ttsRate: 1.0,
  },
  pt: {
    code: 'pt',
    label: 'Portuguese',
    nativeLabel: 'Português',
    flag: '🇧🇷',
    promptName: 'Portuguese',
    bcp47: 'pt-BR',
    ttsVoice: 'pt-BR-Neural2-A',
    ttsRate: 1.0,
  },
};

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LANGUAGE_LIST: LanguageConfig[] = Object.values(LANGUAGES);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && value in LANGUAGES;
}

/** Resolve any (possibly untrusted) input into a valid language config, falling back to English. */
export function getLanguage(code?: string | null): LanguageConfig {
  if (isLanguageCode(code)) return LANGUAGES[code];
  return LANGUAGES[DEFAULT_LANGUAGE];
}
