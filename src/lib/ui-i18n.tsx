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
  settings: { loading: string; title: string; subtitle: string; back: string; profileInfo: string; name: string; email: string; currentRole: string; company: string; companyName: string; plan: string; maxUsers: string; viewTeam: string; noCompany: string; companyPlaceholder: string; creating: string; createCompany: string; roleMgmt: string; devOnly: string; roleHelp: string; employee: string; becomeEmployee: string; manager: string; becomeManager: string; needCompany: string; signOut: string; nowManager: string; nowEmployee: string };
  team: { title: string; teamSize: string; teamAvg: string; thisMonth: string; awaiting: string; sessions: string; unknown: string; invited: string; pending: string; noMembers: string; inviteFirst: string; managerTips: string; exportReport: string; emailAddr: string; roleLabel: string; cancel: string; emailPlaceholder: string; tips: string[] };
  admin: { subtitle: string; totalCost: string; activeUsers: string; lessonsToday: string; avgCost: string; lessons: string; thisMonth: string; tokens: string; rangeTotal: string; days: string; months: string; lessonsLeft: string; usersRight: string; perDay: string; perMonth: string; filtered: string; showAll: string; clickFilter: string; date: string; user: string; lang: string; scenario: string; duration: string; cost: string; noAssessments: string; last: string; accessDenied: string; adminRequired: string; yourEmail: string; required: string; refresh: string };
};

const FEATURE_ICONS = ['🎙', '🔥', '⚡', '🎯', '📊', '🤖'];

const en: Dict = {
  hero: {
    tagline: 'Code Your Communication',
    readme1: 'Practice technical English through',
    readme2: 'real production incident simulations',
    badge1: 'AI powered',
    badge2: 'Real-time voice feedback',
    badge3: '24/7 incident scenarios',
  },
  features: {
    titlePre: 'Why Engineers Choose',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: 'Voice-First Practice', description: 'Practice speaking with AI that responds naturally. Build confidence in real conversations, not textbooks.' },
      { icon: '🔥', title: 'Real Scenarios at Work!!!', description: 'From database outages and deployment failures to budget reviews and stakeholder escalations — practice the real situations you will actually face.' },
      { icon: '⚡', title: 'Instant Feedback', description: 'Get real-time corrections on pronunciation, professional vocabulary, and communication clarity.' },
      { icon: '🎯', title: 'Role-Based Training', description: 'Tailored scenarios for Backend Engineers, DevOps, Finance Business Partners, Analysts and more. Practice your specific domain.' },
      { icon: '📊', title: 'Progress Tracking', description: 'See your improvement over time with detailed analytics on fluency, vocabulary, and response speed.' },
      { icon: '🤖', title: 'Powered by AI', description: 'Powered by advanced AI to simulate realistic work conversations and high-pressure moments.' },
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
      { name: 'Starter', cta: 'Start Free', features: ['{freeSessions} scenarios per month', 'Basic AI feedback', 'Instant CEFR assessment each session', '{freeJds} job description', '!Progress dashboard & history', '!Review past sessions with feedback', '!Premium natural voices'] },
      { name: 'Pro', cta: 'Go Pro', features: ['Unlimited scenarios', 'Advanced AI feedback', 'Bonus practice for the most active users', 'Full progress dashboard (CEFR trend & analytics)', 'Review any past session with full feedback', 'Premium natural AI voices', 'Up to {premiumJds} job descriptions', 'Priority support'] },
      { name: 'Enterprise', cta: 'Contact Sales', features: ['Everything in Pro', 'Team dashboard & manager analytics', 'Company-wide shared scenarios', 'Invite & manage members', 'Unlimited members', 'Dedicated support'] },
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
  settings: { loading: 'Loading settings...', title: 'Settings', subtitle: 'Manage your account and company', back: 'Back to Dashboard', profileInfo: 'Profile Information', name: 'Name', email: 'Email', currentRole: 'Current Role', company: 'Company', companyName: 'Company Name', plan: 'Plan', maxUsers: 'Max Users', viewTeam: 'View Team Dashboard', noCompany: "You don't have a company yet. Create one to access team features.", companyPlaceholder: 'Acme Corp', creating: 'Creating...', createCompany: 'Create Company & Become Admin', roleMgmt: 'Role Management', devOnly: 'DEV ONLY', roleHelp: 'For testing purposes. In production, only admins can change roles.', employee: 'Employee', becomeEmployee: 'Become Employee', manager: 'Manager', becomeManager: 'Become Manager', needCompany: 'You need a company to become a manager', signOut: 'Sign Out', nowManager: 'You are now a manager! Refreshing...', nowEmployee: 'You are now an employee! Refreshing...' },
  team: { title: 'TEAM DASHBOARD', teamSize: 'Team size', teamAvg: 'Team average', thisMonth: 'This month', awaiting: 'Awaiting response', sessions: 'sessions', unknown: 'Unknown', invited: 'Invited', pending: 'pending', noMembers: 'no_team_members_yet', inviteFirst: 'invite_first_member()', managerTips: 'manager_tips', exportReport: 'export_report()', emailAddr: 'email_address', roleLabel: 'role', cancel: 'cancel()', emailPlaceholder: 'colleague@company.com', tips: ['Encourage daily 10-15 min practice sessions', 'Monitor team progress and provide feedback', 'Celebrate improvements and milestones'] },
  admin: { subtitle: 'Infrastructure metrics and cost tracking', totalCost: 'Total Cost (Month)', activeUsers: 'Active Users', lessonsToday: 'Lessons Today', avgCost: 'Avg Cost/Lesson', lessons: 'lessons', thisMonth: 'This month', tokens: 'tokens', rangeTotal: 'Range total', days: 'Days', months: 'Months', lessonsLeft: 'lessons (left)', usersRight: 'active users (right)', perDay: 'per day', perMonth: 'per month', filtered: 'filtered', showAll: 'show all', clickFilter: 'Click to filter recent lessons by this user', date: 'Date', user: 'User', lang: 'Lang', scenario: 'Scenario', duration: 'Duration', cost: 'Cost', noAssessments: 'no assessments yet', last: 'last', accessDenied: 'Admin access required', adminRequired: 'Admin access required', yourEmail: 'Your email', required: 'Required', refresh: 'Refresh Page' },
};

const es: Dict = {
  hero: {
    tagline: 'Programa tu comunicación',
    readme1: 'Practica inglés técnico con',
    readme2: 'simulaciones reales de incidentes de producción',
    badge1: 'Impulsado por IA',
    badge2: 'Feedback de voz en tiempo real',
    badge3: 'Escenarios de incidentes 24/7',
  },
  features: {
    titlePre: 'Por qué los ingenieros eligen',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: 'Práctica hablando', description: 'Practica hablando con una IA que responde con naturalidad. Gana confianza en conversaciones reales, no en libros.' },
      { icon: '🔥', title: 'Escenarios reales del trabajo', description: 'Desde caídas de base de datos y fallos de despliegue hasta revisiones de presupuesto y escalamientos con stakeholders: practica las situaciones reales que enfrentarás.' },
      { icon: '⚡', title: 'Feedback instantáneo', description: 'Recibe correcciones en tiempo real sobre pronunciación, vocabulario profesional y claridad al comunicar.' },
      { icon: '🎯', title: 'Entrenamiento por rol', description: 'Escenarios a medida para ingenieros backend, DevOps, Finance Business Partners, analistas y más. Practica tu dominio específico.' },
      { icon: '📊', title: 'Seguimiento del progreso', description: 'Observa tu mejora con analíticas detalladas de fluidez, vocabulario y velocidad de respuesta.' },
      { icon: '🤖', title: 'Impulsado por IA', description: 'Con IA avanzada para simular conversaciones reales del trabajo y momentos de alta presión.' },
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
      { name: 'Starter', cta: 'Empezar gratis', features: ['{freeSessions} escenarios al mes', 'Feedback básico con IA', 'Evaluación CEFR al instante en cada sesión', '{freeJds} descripción de puesto', '!Dashboard de progreso e historial', '!Revisar sesiones anteriores con feedback', '!Voces naturales premium'] },
      { name: 'Pro', cta: 'Hazte Pro', features: ['Escenarios ilimitados', 'Feedback avanzado con IA', 'Práctica bonus para los usuarios más activos', 'Dashboard de progreso completo (tendencia CEFR y analíticas)', 'Revisa cualquier sesión anterior con feedback completo', 'Voces de IA naturales premium', 'Hasta {premiumJds} descripciones de puesto', 'Soporte prioritario'] },
      { name: 'Enterprise', cta: 'Contactar ventas', features: ['Todo lo de Pro', 'Panel de equipo y analíticas del manager', 'Escenarios compartidos de la empresa', 'Invita y gestiona a tus miembros', 'Usuarios ilimitados', 'Soporte dedicado'] },
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
  settings: { loading: 'Cargando ajustes...', title: 'Ajustes', subtitle: 'Gestiona tu cuenta y tu empresa', back: 'Volver al panel', profileInfo: 'Información del perfil', name: 'Nombre', email: 'Email', currentRole: 'Rol actual', company: 'Empresa', companyName: 'Nombre de la empresa', plan: 'Plan', maxUsers: 'Usuarios máx.', viewTeam: 'Ver panel del equipo', noCompany: 'Aún no tienes empresa. Crea una para acceder a las funciones de equipo.', companyPlaceholder: 'Acme Corp', creating: 'Creando...', createCompany: 'Crear empresa y ser admin', roleMgmt: 'Gestión de roles', devOnly: 'SOLO DEV', roleHelp: 'Solo para pruebas. En producción, solo los admins cambian roles.', employee: 'Empleado', becomeEmployee: 'Ser empleado', manager: 'Manager', becomeManager: 'Ser manager', needCompany: 'Necesitas una empresa para ser manager', signOut: 'Cerrar sesión', nowManager: '¡Ahora eres manager! Actualizando...', nowEmployee: '¡Ahora eres empleado! Actualizando...' },
  team: { title: 'PANEL DEL EQUIPO', teamSize: 'Tamaño del equipo', teamAvg: 'Promedio del equipo', thisMonth: 'Este mes', awaiting: 'Esperando respuesta', sessions: 'sesiones', unknown: 'Desconocido', invited: 'Invitado', pending: 'pendiente', noMembers: 'sin_miembros_aun', inviteFirst: 'invitar_primer_miembro()', managerTips: 'tips_manager', exportReport: 'exportar_reporte()', emailAddr: 'correo', roleLabel: 'rol', cancel: 'cancelar()', emailPlaceholder: 'colega@empresa.com', tips: ['Fomenta prácticas diarias de 10-15 min', 'Monitorea el progreso del equipo y da feedback', 'Celebra las mejoras y los logros'] },
  admin: { subtitle: 'Métricas de infraestructura y seguimiento de costos', totalCost: 'Costo total (mes)', activeUsers: 'Usuarios activos', lessonsToday: 'Lecciones hoy', avgCost: 'Costo prom./lección', lessons: 'lecciones', thisMonth: 'Este mes', tokens: 'tokens', rangeTotal: 'Total del rango', days: 'Días', months: 'Meses', lessonsLeft: 'lecciones (izq.)', usersRight: 'usuarios activos (der.)', perDay: 'por día', perMonth: 'por mes', filtered: 'filtrado', showAll: 'ver todos', clickFilter: 'Clic para filtrar las lecciones de este usuario', date: 'Fecha', user: 'Usuario', lang: 'Idioma', scenario: 'Escenario', duration: 'Duración', cost: 'Costo', noAssessments: 'aún sin evaluaciones', last: 'última', accessDenied: 'Se requiere acceso de admin', adminRequired: 'Se requiere acceso de admin', yourEmail: 'Tu email', required: 'Requerido', refresh: 'Recargar página' },
};

const fr: Dict = {
  hero: {
    tagline: 'Codez votre communication',
    readme1: "Pratiquez l'anglais technique avec",
    readme2: "de vraies simulations d'incidents de production",
    badge1: 'Propulsé par IA',
    badge2: 'Retour vocal en temps réel',
    badge3: "Scénarios d'incidents 24/7",
  },
  features: {
    titlePre: 'Pourquoi les ingénieurs choisissent',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: "Pratique à l'oral", description: "Parlez avec une IA qui répond naturellement. Gagnez en confiance dans de vraies conversations, pas dans des manuels." },
      { icon: '🔥', title: 'Vrais scénarios du travail', description: "Des pannes de base de données et échecs de déploiement aux revues budgétaires et escalades avec les parties prenantes : entraînez-vous aux vraies situations que vous rencontrerez." },
      { icon: '⚡', title: 'Retour instantané', description: 'Recevez des corrections en temps réel sur la prononciation, le vocabulaire professionnel et la clarté.' },
      { icon: '🎯', title: 'Entraînement par rôle', description: 'Scénarios adaptés aux ingénieurs backend, DevOps, Finance Business Partners, analystes et plus. Entraînez-vous sur votre domaine.' },
      { icon: '📊', title: 'Suivi de la progression', description: 'Suivez vos progrès avec des analyses détaillées de fluidité, vocabulaire et vitesse de réponse.' },
      { icon: '🤖', title: 'Propulsé par IA', description: "Une IA avancée pour simuler de vraies conversations professionnelles et des moments sous pression." },
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
      { name: 'Starter', cta: 'Commencer gratuitement', features: ['{freeSessions} scénarios par mois', 'Retour IA basique', 'Évaluation CEFR instantanée à chaque session', '{freeJds} fiche de poste', '!Tableau de bord de progression et historique', '!Revoir les sessions passées avec le retour', '!Voix naturelles premium'] },
      { name: 'Pro', cta: 'Passer à Pro', features: ['Scénarios illimités', 'Retour IA avancé', 'Pratique bonus pour les plus actifs', 'Tableau de bord complet (tendance CEFR et analyses)', 'Revoyez toute session passée avec le retour complet', 'Voix IA naturelles premium', "Jusqu'à {premiumJds} fiches de poste", 'Support prioritaire'] },
      { name: 'Enterprise', cta: 'Contacter les ventes', features: ['Tout Pro', "Tableau de bord d'équipe et analyses du manager", "Scénarios partagés de l'entreprise", 'Invitez et gérez vos membres', 'Utilisateurs illimités', 'Support dédié'] },
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
  settings: { loading: 'Chargement des paramètres...', title: 'Paramètres', subtitle: 'Gérez votre compte et votre entreprise', back: 'Retour au tableau de bord', profileInfo: 'Informations du profil', name: 'Nom', email: 'Email', currentRole: 'Rôle actuel', company: 'Entreprise', companyName: "Nom de l'entreprise", plan: 'Forfait', maxUsers: 'Utilisateurs max.', viewTeam: "Voir le tableau de bord de l'équipe", noCompany: "Vous n'avez pas encore d'entreprise. Créez-en une pour accéder aux fonctions d'équipe.", companyPlaceholder: 'Acme Corp', creating: 'Création...', createCompany: "Créer l'entreprise et devenir admin", roleMgmt: 'Gestion des rôles', devOnly: 'DEV UNIQUEMENT', roleHelp: 'À des fins de test. En production, seuls les admins changent les rôles.', employee: 'Employé', becomeEmployee: 'Devenir employé', manager: 'Manager', becomeManager: 'Devenir manager', needCompany: "Vous avez besoin d'une entreprise pour devenir manager", signOut: 'Se déconnecter', nowManager: 'Vous êtes maintenant manager ! Actualisation...', nowEmployee: 'Vous êtes maintenant employé ! Actualisation...' },
  team: { title: "TABLEAU DE BORD DE L'ÉQUIPE", teamSize: "Taille de l'équipe", teamAvg: "Moyenne de l'équipe", thisMonth: 'Ce mois-ci', awaiting: 'En attente de réponse', sessions: 'sessions', unknown: 'Inconnu', invited: 'Invité', pending: 'en attente', noMembers: 'aucun_membre_encore', inviteFirst: 'inviter_premier_membre()', managerTips: 'astuces_manager', exportReport: 'exporter_rapport()', emailAddr: 'adresse_email', roleLabel: 'rôle', cancel: 'annuler()', emailPlaceholder: 'collegue@entreprise.com', tips: ['Encouragez des sessions quotidiennes de 10-15 min', "Suivez la progression de l'équipe et donnez du feedback", 'Célébrez les progrès et les étapes clés'] },
  admin: { subtitle: "Métriques d'infrastructure et suivi des coûts", totalCost: 'Coût total (mois)', activeUsers: 'Utilisateurs actifs', lessonsToday: "Leçons aujourd'hui", avgCost: 'Coût moy./leçon', lessons: 'leçons', thisMonth: 'Ce mois-ci', tokens: 'tokens', rangeTotal: 'Total de la période', days: 'Jours', months: 'Mois', lessonsLeft: 'leçons (g.)', usersRight: 'utilisateurs actifs (d.)', perDay: 'par jour', perMonth: 'par mois', filtered: 'filtré', showAll: 'tout afficher', clickFilter: 'Cliquez pour filtrer les leçons de cet utilisateur', date: 'Date', user: 'Utilisateur', lang: 'Langue', scenario: 'Scénario', duration: 'Durée', cost: 'Coût', noAssessments: 'aucune évaluation', last: 'dernière', accessDenied: 'Accès admin requis', adminRequired: 'Accès admin requis', yourEmail: 'Votre email', required: 'Requis', refresh: 'Actualiser la page' },
};

const pt: Dict = {
  hero: {
    tagline: 'Programe sua comunicação',
    readme1: 'Pratique inglês técnico com',
    readme2: 'simulações reais de incidentes de produção',
    badge1: 'Com tecnologia de IA',
    badge2: 'Feedback de voz em tempo real',
    badge3: 'Cenários de incidentes 24/7',
  },
  features: {
    titlePre: 'Por que engenheiros escolhem',
    titleHi: 'SPEECK',
    items: [
      { icon: '🎙', title: 'Prática falando', description: 'Fale com uma IA que responde naturalmente. Ganhe confiança em conversas reais, não em livros.' },
      { icon: '🔥', title: 'Cenários reais do trabalho', description: 'De quedas de banco de dados e falhas de deploy a revisões de orçamento e escalonamentos com stakeholders: pratique as situações reais que você vai enfrentar.' },
      { icon: '⚡', title: 'Feedback instantâneo', description: 'Receba correções em tempo real sobre pronúncia, vocabulário profissional e clareza na comunicação.' },
      { icon: '🎯', title: 'Treino por função', description: 'Cenários sob medida para engenheiros backend, DevOps, Finance Business Partners, analistas e mais. Pratique o seu domínio.' },
      { icon: '📊', title: 'Acompanhamento do progresso', description: 'Veja sua evolução com análises detalhadas de fluência, vocabulário e velocidade de resposta.' },
      { icon: '🤖', title: 'Com tecnologia de IA', description: 'IA avançada para simular conversas reais do trabalho e momentos de alta pressão.' },
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
      { name: 'Starter', cta: 'Começar grátis', features: ['{freeSessions} cenários por mês', 'Feedback básico com IA', 'Avaliação CEFR na hora em cada sessão', '{freeJds} descrição de vaga', '!Painel de progresso e histórico', '!Revisar sessões anteriores com feedback', '!Vozes naturais premium'] },
      { name: 'Pro', cta: 'Virar Pro', features: ['Cenários ilimitados', 'Feedback avançado com IA', 'Prática bônus para os usuários mais ativos', 'Painel de progresso completo (tendência CEFR e análises)', 'Revise qualquer sessão anterior com feedback completo', 'Vozes de IA naturais premium', 'Até {premiumJds} descrições de vaga', 'Suporte prioritário'] },
      { name: 'Enterprise', cta: 'Falar com vendas', features: ['Tudo do Pro', 'Painel da equipe e análises do gestor', 'Cenários compartilhados da empresa', 'Convide e gerencie seus membros', 'Usuários ilimitados', 'Suporte dedicado'] },
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
  settings: { loading: 'Carregando ajustes...', title: 'Ajustes', subtitle: 'Gerencie sua conta e sua empresa', back: 'Voltar ao painel', profileInfo: 'Informações do perfil', name: 'Nome', email: 'Email', currentRole: 'Função atual', company: 'Empresa', companyName: 'Nome da empresa', plan: 'Plano', maxUsers: 'Usuários máx.', viewTeam: 'Ver painel da equipe', noCompany: 'Você ainda não tem empresa. Crie uma para acessar os recursos de equipe.', companyPlaceholder: 'Acme Corp', creating: 'Criando...', createCompany: 'Criar empresa e virar admin', roleMgmt: 'Gestão de funções', devOnly: 'SÓ DEV', roleHelp: 'Apenas para testes. Em produção, só admins mudam funções.', employee: 'Funcionário', becomeEmployee: 'Virar funcionário', manager: 'Manager', becomeManager: 'Virar manager', needCompany: 'Você precisa de uma empresa para virar manager', signOut: 'Sair', nowManager: 'Agora você é manager! Atualizando...', nowEmployee: 'Agora você é funcionário! Atualizando...' },
  team: { title: 'PAINEL DA EQUIPE', teamSize: 'Tamanho da equipe', teamAvg: 'Média da equipe', thisMonth: 'Este mês', awaiting: 'Aguardando resposta', sessions: 'sessões', unknown: 'Desconhecido', invited: 'Convidado', pending: 'pendente', noMembers: 'sem_membros_ainda', inviteFirst: 'convidar_primeiro_membro()', managerTips: 'dicas_manager', exportReport: 'exportar_relatorio()', emailAddr: 'endereco_email', roleLabel: 'função', cancel: 'cancelar()', emailPlaceholder: 'colega@empresa.com', tips: ['Incentive práticas diárias de 10-15 min', 'Acompanhe o progresso da equipe e dê feedback', 'Comemore melhorias e conquistas'] },
  admin: { subtitle: 'Métricas de infraestrutura e controle de custos', totalCost: 'Custo total (mês)', activeUsers: 'Usuários ativos', lessonsToday: 'Lições hoje', avgCost: 'Custo méd./lição', lessons: 'lições', thisMonth: 'Este mês', tokens: 'tokens', rangeTotal: 'Total do período', days: 'Dias', months: 'Meses', lessonsLeft: 'lições (esq.)', usersRight: 'usuários ativos (dir.)', perDay: 'por dia', perMonth: 'por mês', filtered: 'filtrado', showAll: 'ver todos', clickFilter: 'Clique para filtrar as lições deste usuário', date: 'Data', user: 'Usuário', lang: 'Idioma', scenario: 'Cenário', duration: 'Duração', cost: 'Custo', noAssessments: 'ainda sem avaliações', last: 'última', accessDenied: 'Acesso de admin necessário', adminRequired: 'Acesso de admin necessário', yourEmail: 'Seu email', required: 'Necessário', refresh: 'Recarregar página' },
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
