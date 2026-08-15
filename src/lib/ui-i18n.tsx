'use client';

/**
 * App-wide UI internationalization for STATIC page content, so learners (even
 * at A1) can navigate the site in their own language. A single locale is held
 * in a context, persisted to localStorage, and switched from a header selector
 * rendered globally. Practice/scenario content stays in the practice language
 * (handled elsewhere) — this only covers the site chrome.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const UI_LOCALES = ['en', 'es', 'fr', 'pt'] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const UI_LOCALE_LABELS: Record<UiLocale, string> = { en: 'EN', es: 'ES', fr: 'FR', pt: 'PT' };

type Feature = { icon: string; title: string; description: string };
type Step = { title: string; description: string };
type Plan = { name: string; cta: string; features: string[] };

type Dict = {
  hero: { tagline: string; readme1: string; readme2: string; badge1: string; badge2: string; badge3: string };
  features: { titlePre: string; titleHi: string; items: Feature[] };
  steps: { titlePre: string; titleHi: string; items: Step[] };
  pricing: { titlePre: string; titleHi: string; popular: string; perMo: string; plans: Plan[] };
  footer: { tagline: string };
  dashboard: {
    welcome: string; subtitle: string; completed: string; overall: string;
    speakingTime: string; recently: string; noActivity: string; mostRecent: string; tips: string[];
  };
  auth: { loginSubtitle: string; signupSubtitle: string; orEmail: string; orCreate: string; namePlaceholder: string; companyPlaceholder: string; createAccount: string; haveAccount: string };
  session: { fallbackTitle: string; level: string; tokens: string; jargon: string; terms: string; skills: { pronunciation: string; fluency: string; vocabulary: string; grammar: string; interaction: string; comprehension: string } };
  invite: { loading: string; invalid: string; goHome: string; title: string; subtitle: string; invitedAs: string; email: string; expires: string; createJoin: string; haveSignIn: string; benefits: string };
};

const FEATURE_ICONS = ['🎙', '🔥', '⚡', '🎯', '📊', '🤖'];

const en: Dict = {
  hero: {
    tagline: 'Code Your Communication',
    readme1: 'Practice technical English through',
    readme2: 'real production incident simulations',
    badge1: 'Claude Sonnet powered',
    badge2: 'Real-time voice feedback',
    badge3: '24/7 incident scenarios',
  },
  features: {
    titlePre: 'Why Engineers Choose',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: 'Voice-First Practice', description: 'Practice speaking with AI that responds naturally. Build confidence in real conversations, not textbooks.' },
      { icon: '🔥', title: 'Real Production Scenarios', description: 'Database crashes, network outages, deployment failures — practice the incidents you will actually face.' },
      { icon: '⚡', title: 'Instant Feedback', description: 'Get real-time corrections on pronunciation, technical vocabulary, and communication clarity.' },
      { icon: '🎯', title: 'Role-Based Training', description: 'Tailored scenarios for DBAs, DevOps, SREs, and Backend Engineers. Practice your specific domain.' },
      { icon: '📊', title: 'Progress Tracking', description: 'See your improvement over time with detailed analytics on fluency, vocabulary, and response speed.' },
      { icon: '🤖', title: 'Powered by Claude', description: 'Powered by advanced AI to simulate realistic technical conversations and emergencies.' },
    ],
  },
  steps: {
    titlePre: 'Get Fluent in',
    titleHi: '3 Steps',
    items: [
      { title: 'Choose Your Scenario', description: 'Select a language, a job description, and your level — scenarios are generated from your real role.' },
      { title: 'Start the Conversation', description: 'Speak with AI characters (PMs, engineers, customers) who react realistically to your responses.' },
      { title: 'Get Feedback & Improve', description: 'Receive an instant CEFR assessment. Review transcripts and track your progress over time.' },
    ],
  },
  pricing: {
    titlePre: 'Simple, Transparent',
    titleHi: 'Pricing',
    popular: 'POPULAR',
    perMo: '/mo',
    plans: [
      { name: 'Starter', cta: 'Start Free', features: ['3 scenarios per month', 'Basic feedback', 'Progress tracking', 'Community support'] },
      { name: 'Pro', cta: 'Go Pro', features: ['Unlimited scenarios', 'Advanced AI feedback', 'Custom scenarios', 'Voice analytics', 'Priority support', 'Export transcripts'] },
      { name: 'Team', cta: 'Contact Sales', features: ['Everything in Pro', 'Team dashboard', 'SSO integration', 'Custom integrations', 'Dedicated support', 'Up to 50 users'] },
    ],
  },
  footer: { tagline: 'Built for engineers, by engineers' },
  dashboard: {
    welcome: 'Welcome back', subtitle: 'Track your progress and improve your technical English',
    completed: 'completed', overall: 'Overall performance', speakingTime: 'Total speaking time',
    recently: 'Recently', noActivity: 'No activity', mostRecent: 'Most recent session',
    tips: [
      'Practice daily for 10-15 minutes for best results',
      'Focus on technical vocabulary specific to your role',
      'Try different difficulty levels to challenge yourself',
    ],
  },
  auth: { loginSubtitle: 'Access your training dashboard', signupSubtitle: 'Start your English training', orEmail: 'or use email', orCreate: 'or create account', namePlaceholder: 'Your Name', companyPlaceholder: 'Company Name', createAccount: 'create account', haveAccount: 'already have account' },
  session: { fallbackTitle: 'Practice session', level: 'level', tokens: 'tokens', jargon: 'technical jargon', terms: 'terms', skills: { pronunciation: 'Pronunciation', fluency: 'Fluency', vocabulary: 'Vocabulary', grammar: 'Grammar', interaction: 'Interaction', comprehension: 'Comprehension' } },
  invite: { loading: 'Loading invitation...', invalid: 'Invalid Invitation', goHome: 'Go to Home', title: "You're Invited!", subtitle: 'Join your team on SPEECK.AI', invitedAs: 'has invited you to join their team as a', email: 'Email', expires: 'Expires', createJoin: 'Create Account & Join Team', haveSignIn: 'Already have an account? Sign In', benefits: "By joining, you'll get access to team practice sessions and progress tracking" },
};

const es: Dict = {
  hero: {
    tagline: 'Programa tu comunicación',
    readme1: 'Practica inglés técnico con',
    readme2: 'simulaciones reales de incidentes de producción',
    badge1: 'Impulsado por Claude Sonnet',
    badge2: 'Feedback de voz en tiempo real',
    badge3: 'Escenarios de incidentes 24/7',
  },
  features: {
    titlePre: 'Por qué los ingenieros eligen',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: 'Práctica hablando', description: 'Practica hablando con una IA que responde con naturalidad. Gana confianza en conversaciones reales, no en libros.' },
      { icon: '🔥', title: 'Escenarios reales de producción', description: 'Caídas de base de datos, cortes de red, fallos de despliegue: practica los incidentes que enfrentarás de verdad.' },
      { icon: '⚡', title: 'Feedback instantáneo', description: 'Recibe correcciones en tiempo real sobre pronunciación, vocabulario técnico y claridad al comunicar.' },
      { icon: '🎯', title: 'Entrenamiento por rol', description: 'Escenarios a medida para DBAs, DevOps, SREs e ingenieros backend. Practica tu dominio específico.' },
      { icon: '📊', title: 'Seguimiento del progreso', description: 'Observa tu mejora con analíticas detalladas de fluidez, vocabulario y velocidad de respuesta.' },
      { icon: '🤖', title: 'Impulsado por Claude', description: 'Con IA avanzada para simular conversaciones y emergencias técnicas realistas.' },
    ],
  },
  steps: {
    titlePre: 'Habla con fluidez en',
    titleHi: '3 pasos',
    items: [
      { title: 'Elige tu escenario', description: 'Selecciona un idioma, una descripción de puesto y tu nivel: los escenarios se generan desde tu rol real.' },
      { title: 'Empieza la conversación', description: 'Habla con personajes de IA (PMs, ingenieros, clientes) que reaccionan de forma realista a tus respuestas.' },
      { title: 'Recibe feedback y mejora', description: 'Obtén una evaluación CEFR al instante. Revisa las transcripciones y sigue tu progreso.' },
    ],
  },
  pricing: {
    titlePre: 'Precios simples y',
    titleHi: 'transparentes',
    popular: 'POPULAR',
    perMo: '/mes',
    plans: [
      { name: 'Starter', cta: 'Empezar gratis', features: ['3 escenarios al mes', 'Feedback básico', 'Seguimiento del progreso', 'Soporte de la comunidad'] },
      { name: 'Pro', cta: 'Hazte Pro', features: ['Escenarios ilimitados', 'Feedback avanzado con IA', 'Escenarios personalizados', 'Analíticas de voz', 'Soporte prioritario', 'Exportar transcripciones'] },
      { name: 'Team', cta: 'Contactar ventas', features: ['Todo lo de Pro', 'Panel de equipo', 'Integración SSO', 'Integraciones personalizadas', 'Soporte dedicado', 'Hasta 50 usuarios'] },
    ],
  },
  footer: { tagline: 'Hecho por ingenieros, para ingenieros' },
  dashboard: {
    welcome: 'Bienvenido de nuevo', subtitle: 'Sigue tu progreso y mejora tu inglés técnico',
    completed: 'completadas', overall: 'Rendimiento general', speakingTime: 'Tiempo total hablando',
    recently: 'Reciente', noActivity: 'Sin actividad', mostRecent: 'Sesión más reciente',
    tips: [
      'Practica a diario 10-15 minutos para mejores resultados',
      'Enfócate en el vocabulario técnico de tu rol',
      'Prueba distintos niveles de dificultad para retarte',
    ],
  },
  auth: { loginSubtitle: 'Accede a tu panel de entrenamiento', signupSubtitle: 'Empieza tu entrenamiento de inglés', orEmail: 'o usa tu email', orCreate: 'o crea una cuenta', namePlaceholder: 'Tu nombre', companyPlaceholder: 'Nombre de la empresa', createAccount: 'crear cuenta', haveAccount: 'ya tengo cuenta' },
  session: { fallbackTitle: 'Sesión de práctica', level: 'nivel', tokens: 'tokens', jargon: 'jerga técnica', terms: 'términos', skills: { pronunciation: 'Pronunciación', fluency: 'Fluidez', vocabulary: 'Vocabulario', grammar: 'Gramática', interaction: 'Interacción', comprehension: 'Comprensión' } },
  invite: { loading: 'Cargando invitación...', invalid: 'Invitación no válida', goHome: 'Ir al inicio', title: '¡Estás invitado!', subtitle: 'Únete a tu equipo en SPEECK.AI', invitedAs: 'te ha invitado a unirte a su equipo como', email: 'Email', expires: 'Vence', createJoin: 'Crear cuenta y unirse', haveSignIn: '¿Ya tienes cuenta? Inicia sesión', benefits: 'Al unirte, tendrás acceso a las prácticas del equipo y al seguimiento del progreso' },
};

const fr: Dict = {
  hero: {
    tagline: 'Codez votre communication',
    readme1: "Pratiquez l'anglais technique avec",
    readme2: "de vraies simulations d'incidents de production",
    badge1: 'Propulsé par Claude Sonnet',
    badge2: 'Retour vocal en temps réel',
    badge3: "Scénarios d'incidents 24/7",
  },
  features: {
    titlePre: 'Pourquoi les ingénieurs choisissent',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: "Pratique à l'oral", description: "Parlez avec une IA qui répond naturellement. Gagnez en confiance dans de vraies conversations, pas dans des manuels." },
      { icon: '🔥', title: 'Scénarios de production réels', description: "Pannes de base de données, coupures réseau, échecs de déploiement : entraînez-vous aux incidents réels." },
      { icon: '⚡', title: 'Retour instantané', description: 'Recevez des corrections en temps réel sur la prononciation, le vocabulaire technique et la clarté.' },
      { icon: '🎯', title: 'Entraînement par rôle', description: 'Scénarios adaptés aux DBA, DevOps, SRE et ingénieurs backend. Entraînez-vous sur votre domaine.' },
      { icon: '📊', title: 'Suivi de la progression', description: 'Suivez vos progrès avec des analyses détaillées de fluidité, vocabulaire et vitesse de réponse.' },
      { icon: '🤖', title: 'Propulsé par Claude', description: 'Une IA avancée pour simuler des conversations et des urgences techniques réalistes.' },
    ],
  },
  steps: {
    titlePre: 'Devenez fluide en',
    titleHi: '3 étapes',
    items: [
      { title: 'Choisissez votre scénario', description: "Sélectionnez une langue, une fiche de poste et votre niveau : les scénarios sont générés à partir de votre rôle." },
      { title: 'Démarrez la conversation', description: 'Parlez avec des personnages IA (PM, ingénieurs, clients) qui réagissent de façon réaliste.' },
      { title: 'Recevez un retour et progressez', description: 'Obtenez une évaluation CEFR instantanée. Relisez les transcriptions et suivez vos progrès.' },
    ],
  },
  pricing: {
    titlePre: 'Des tarifs simples et',
    titleHi: 'transparents',
    popular: 'POPULAIRE',
    perMo: '/mois',
    plans: [
      { name: 'Starter', cta: 'Commencer gratuitement', features: ['3 scénarios par mois', 'Retour basique', 'Suivi de la progression', 'Support communautaire'] },
      { name: 'Pro', cta: 'Passer à Pro', features: ['Scénarios illimités', 'Retour IA avancé', 'Scénarios personnalisés', 'Analyses vocales', 'Support prioritaire', 'Export des transcriptions'] },
      { name: 'Team', cta: 'Contacter les ventes', features: ['Tout Pro', "Tableau de bord d'équipe", 'Intégration SSO', 'Intégrations personnalisées', 'Support dédié', "Jusqu'à 50 utilisateurs"] },
    ],
  },
  footer: { tagline: 'Conçu par des ingénieurs, pour des ingénieurs' },
  dashboard: {
    welcome: 'Bon retour', subtitle: 'Suivez votre progression et améliorez votre anglais technique',
    completed: 'terminées', overall: 'Performance globale', speakingTime: 'Temps de parole total',
    recently: 'Récemment', noActivity: 'Aucune activité', mostRecent: 'Session la plus récente',
    tips: [
      'Pratiquez 10 à 15 minutes par jour pour de meilleurs résultats',
      'Concentrez-vous sur le vocabulaire technique de votre rôle',
      'Essayez différents niveaux de difficulté pour vous challenger',
    ],
  },
  auth: { loginSubtitle: 'Accédez à votre tableau de bord', signupSubtitle: "Commencez votre entraînement en anglais", orEmail: "ou utilisez l'email", orCreate: 'ou créez un compte', namePlaceholder: 'Votre nom', companyPlaceholder: "Nom de l'entreprise", createAccount: 'créer un compte', haveAccount: "j'ai déjà un compte" },
  session: { fallbackTitle: 'Session de pratique', level: 'niveau', tokens: 'tokens', jargon: 'jargon technique', terms: 'termes', skills: { pronunciation: 'Prononciation', fluency: 'Aisance', vocabulary: 'Vocabulaire', grammar: 'Grammaire', interaction: 'Interaction', comprehension: 'Compréhension' } },
  invite: { loading: "Chargement de l'invitation...", invalid: 'Invitation invalide', goHome: "Aller à l'accueil", title: 'Vous êtes invité !', subtitle: 'Rejoignez votre équipe sur SPEECK.AI', invitedAs: "vous a invité à rejoindre son équipe en tant que", email: 'Email', expires: 'Expire le', createJoin: 'Créer un compte et rejoindre', haveSignIn: 'Vous avez déjà un compte ? Connectez-vous', benefits: "En rejoignant, vous accédez aux sessions de pratique de l'équipe et au suivi de la progression" },
};

const pt: Dict = {
  hero: {
    tagline: 'Programe sua comunicação',
    readme1: 'Pratique inglês técnico com',
    readme2: 'simulações reais de incidentes de produção',
    badge1: 'Com tecnologia Claude Sonnet',
    badge2: 'Feedback de voz em tempo real',
    badge3: 'Cenários de incidentes 24/7',
  },
  features: {
    titlePre: 'Por que engenheiros escolhem',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: 'Prática falando', description: 'Fale com uma IA que responde naturalmente. Ganhe confiança em conversas reais, não em livros.' },
      { icon: '🔥', title: 'Cenários reais de produção', description: 'Quedas de banco de dados, falhas de rede, erros de deploy: pratique os incidentes que você vai enfrentar.' },
      { icon: '⚡', title: 'Feedback instantâneo', description: 'Receba correções em tempo real sobre pronúncia, vocabulário técnico e clareza na comunicação.' },
      { icon: '🎯', title: 'Treino por função', description: 'Cenários sob medida para DBAs, DevOps, SREs e engenheiros backend. Pratique o seu domínio.' },
      { icon: '📊', title: 'Acompanhamento do progresso', description: 'Veja sua evolução com análises detalhadas de fluência, vocabulário e velocidade de resposta.' },
      { icon: '🤖', title: 'Com tecnologia Claude', description: 'IA avançada para simular conversas e emergências técnicas realistas.' },
    ],
  },
  steps: {
    titlePre: 'Fale com fluência em',
    titleHi: '3 passos',
    items: [
      { title: 'Escolha seu cenário', description: 'Selecione um idioma, uma descrição de vaga e seu nível: os cenários são gerados a partir da sua função real.' },
      { title: 'Comece a conversa', description: 'Fale com personagens de IA (PMs, engenheiros, clientes) que reagem de forma realista às suas respostas.' },
      { title: 'Receba feedback e melhore', description: 'Obtenha uma avaliação CEFR na hora. Revise as transcrições e acompanhe seu progresso.' },
    ],
  },
  pricing: {
    titlePre: 'Preços simples e',
    titleHi: 'transparentes',
    popular: 'POPULAR',
    perMo: '/mês',
    plans: [
      { name: 'Starter', cta: 'Começar grátis', features: ['3 cenários por mês', 'Feedback básico', 'Acompanhamento do progresso', 'Suporte da comunidade'] },
      { name: 'Pro', cta: 'Virar Pro', features: ['Cenários ilimitados', 'Feedback avançado com IA', 'Cenários personalizados', 'Análises de voz', 'Suporte prioritário', 'Exportar transcrições'] },
      { name: 'Team', cta: 'Falar com vendas', features: ['Tudo do Pro', 'Painel da equipe', 'Integração SSO', 'Integrações personalizadas', 'Suporte dedicado', 'Até 50 usuários'] },
    ],
  },
  footer: { tagline: 'Feito por engenheiros, para engenheiros' },
  dashboard: {
    welcome: 'Bem-vindo de volta', subtitle: 'Acompanhe seu progresso e melhore seu inglês técnico',
    completed: 'concluídas', overall: 'Desempenho geral', speakingTime: 'Tempo total falando',
    recently: 'Recente', noActivity: 'Sem atividade', mostRecent: 'Sessão mais recente',
    tips: [
      'Pratique 10-15 minutos por dia para melhores resultados',
      'Foque no vocabulário técnico específico da sua função',
      'Experimente diferentes níveis de dificuldade para se desafiar',
    ],
  },
  auth: { loginSubtitle: 'Acesse seu painel de treino', signupSubtitle: 'Comece seu treino de inglês', orEmail: 'ou use seu email', orCreate: 'ou crie uma conta', namePlaceholder: 'Seu nome', companyPlaceholder: 'Nome da empresa', createAccount: 'criar conta', haveAccount: 'já tenho conta' },
  session: { fallbackTitle: 'Sessão de prática', level: 'nível', tokens: 'tokens', jargon: 'jargão técnico', terms: 'termos', skills: { pronunciation: 'Pronúncia', fluency: 'Fluência', vocabulary: 'Vocabulário', grammar: 'Gramática', interaction: 'Interação', comprehension: 'Compreensão' } },
  invite: { loading: 'Carregando convite...', invalid: 'Convite inválido', goHome: 'Ir para o início', title: 'Você foi convidado!', subtitle: 'Junte-se à sua equipe no SPEECK.AI', invitedAs: 'convidou você para entrar na equipe como', email: 'Email', expires: 'Expira em', createJoin: 'Criar conta e entrar', haveSignIn: 'Já tem uma conta? Entrar', benefits: 'Ao entrar, você terá acesso às práticas da equipe e ao acompanhamento do progresso' },
};

const DICTS: Record<UiLocale, Dict> = { en, es, fr, pt };

// Ensure the icons stay consistent regardless of locale.
for (const loc of UI_LOCALES) {
  DICTS[loc].features.items.forEach((it, i) => (it.icon = FEATURE_ICONS[i]));
}

type Ctx = { locale: UiLocale; setLocale: (l: UiLocale) => void; d: Dict };
const UiI18nContext = createContext<Ctx | null>(null);

function detectInitial(): UiLocale {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem('ui_locale');
  if (saved && (UI_LOCALES as readonly string[]).includes(saved)) return saved as UiLocale;
  const nav = (window.navigator.language || 'en').slice(0, 2).toLowerCase();
  return (UI_LOCALES as readonly string[]).includes(nav) ? (nav as UiLocale) : 'en';
}

export function UiI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>('en');

  useEffect(() => {
    setLocaleState(detectInitial());
  }, []);

  const setLocale = (l: UiLocale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem('ui_locale', l);
    } catch {
      /* ignore */
    }
  };

  return <UiI18nContext.Provider value={{ locale, setLocale, d: DICTS[locale] }}>{children}</UiI18nContext.Provider>;
}

export function useUi(): Ctx {
  const ctx = useContext(UiI18nContext);
  if (!ctx) throw new Error('useUi must be used within UiI18nProvider');
  return ctx;
}

/**
 * Compact, inline language selector. Placed inside each page's own nav/header
 * (not fixed/floating) so it stays consistent and never overlaps content or
 * breaks on mobile. `className` lets callers tweak spacing per header.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useUi();
  return (
    <div className={`inline-flex gap-1 items-center ${className}`}>
      <span className="font-mono text-xs text-gray-400 mr-1">lang:</span>
      {UI_LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`px-2.5 py-1 rounded-md font-mono text-xs transition-all ${
            locale === l
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
              : 'bg-white/60 text-gray-600 hover:bg-white'
          }`}
        >
          {UI_LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
