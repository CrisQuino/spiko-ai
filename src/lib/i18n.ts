/**
 * Lightweight i18n for the demo/practice UI chrome.
 *
 * Fixed labels are translated with curated dictionaries (instant, free,
 * reliable). Dynamic content (the scenario title and the AI's turns) is
 * produced by the LLM directly in the practice language, so it isn't here.
 */

import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from './languages';

type Dict = Record<string, string>;

const EN: Dict = {
  back_home: 'cd ../home',
  title_fallback: 'Technical Practice Session',
  desc_from_jd: 'A realistic workplace scenario, generated from your job description.',
  desc_generic: 'Practice handling a realistic workplace situation.',
  practice_out_loud: 'Practice speaking professional {lang} out loud.',
  checking_auth: 'Checking authentication…',
  demo_mode_active: 'Demo Mode Active',
  demo_bullet_time: 'Limited to 2 minutes of conversation',
  demo_bullet_audio: 'Basic audio quality (browser text-to-speech)',
  cefr_included: 'Full CEFR assessment included',
  signup: 'Sign up',
  signup_tail: 'for unlimited time + premium AI voices!',
  full_access: 'Full Access Mode',
  full_bullet_time: 'Extended practice time (5+ minutes)',
  full_bullet_audio: 'Premium AI voice quality',
  full_bullet_history: 'Progress tracking & history',
  start: 'Start practice',
  recording: 'RECORDING',
  playing: 'PLAYING',
  ready: 'Ready',
  well_done: 'Well done!',
  time: 'Time',
  clarifications: 'Clarifications',
  grading: 'Grading your language against CEFR…',
  evaluating: 'Evaluating your performance…',
  try_again: 'Try again',
  your_response: 'type your response…',
  listening: 'listening… speak now',
};

const FR: Dict = {
  back_home: 'cd ../accueil',
  title_fallback: 'Session d’entraînement technique',
  desc_from_jd: 'Un scénario professionnel réaliste, généré à partir de votre fiche de poste.',
  desc_generic: 'Entraînez-vous à gérer une situation professionnelle réaliste.',
  practice_out_loud: 'Entraînez-vous à parler un {lang} professionnel à voix haute.',
  checking_auth: 'Vérification de l’authentification…',
  demo_mode_active: 'Mode démo actif',
  demo_bullet_time: 'Limité à 2 minutes de conversation',
  demo_bullet_audio: 'Qualité audio basique (synthèse vocale du navigateur)',
  cefr_included: 'Évaluation CECR complète incluse',
  signup: 'Inscrivez-vous',
  signup_tail: 'pour un temps illimité + des voix IA premium !',
  full_access: 'Accès complet',
  full_bullet_time: 'Temps d’entraînement prolongé (5 min et plus)',
  full_bullet_audio: 'Voix IA de qualité premium',
  full_bullet_history: 'Suivi de progression et historique',
  start: 'Commencer l’entraînement',
  recording: 'ENREGISTREMENT',
  playing: 'LECTURE',
  ready: 'Prêt',
  well_done: 'Bravo !',
  time: 'Temps',
  clarifications: 'Clarifications',
  grading: 'Évaluation de votre langue selon le CECR…',
  evaluating: 'Évaluation de votre performance…',
  try_again: 'Réessayer',
  your_response: 'tapez votre réponse…',
  listening: 'écoute… parlez maintenant',
};

const PT: Dict = {
  back_home: 'cd ../inicio',
  title_fallback: 'Sessão de prática técnica',
  desc_from_jd: 'Um cenário de trabalho realista, gerado a partir da sua descrição de vaga.',
  desc_generic: 'Pratique como lidar com uma situação de trabalho realista.',
  practice_out_loud: 'Pratique falar {lang} profissional em voz alta.',
  checking_auth: 'Verificando a autenticação…',
  demo_mode_active: 'Modo demo ativo',
  demo_bullet_time: 'Limitado a 2 minutos de conversa',
  demo_bullet_audio: 'Qualidade de áudio básica (síntese de voz do navegador)',
  cefr_included: 'Avaliação CEFR completa incluída',
  signup: 'Cadastre-se',
  signup_tail: 'para tempo ilimitado + vozes de IA premium!',
  full_access: 'Acesso completo',
  full_bullet_time: 'Tempo de prática estendido (5+ minutos)',
  full_bullet_audio: 'Voz de IA de qualidade premium',
  full_bullet_history: 'Acompanhamento de progresso e histórico',
  start: 'Começar a prática',
  recording: 'GRAVANDO',
  playing: 'REPRODUZINDO',
  ready: 'Pronto',
  well_done: 'Muito bem!',
  time: 'Tempo',
  clarifications: 'Esclarecimentos',
  grading: 'Avaliando seu idioma segundo o CEFR…',
  evaluating: 'Avaliando seu desempenho…',
  try_again: 'Tentar novamente',
  your_response: 'digite sua resposta…',
  listening: 'ouvindo… fale agora',
};

const DICTS: Record<LanguageCode, Dict> = { en: EN, fr: FR, pt: PT };

export type Translate = (key: keyof typeof EN, vars?: Record<string, string>) => string;

/** Build a translator for the given language code. */
export function makeT(code?: string | null): Translate {
  const lang: LanguageCode = isLanguageCode(code) ? code : DEFAULT_LANGUAGE;
  const dict = DICTS[lang] || EN;
  return (key, vars) => {
    let s = dict[key as string] ?? EN[key as string] ?? (key as string);
    if (vars) {
      for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
    }
    return s;
  };
}
