# 🚀 SPEECK.AI CI/CD Pipeline

Este documento describe el pipeline de integración continua, testing y despliegue para SPEECK.AI.

---

## 📋 Stack de Testing

| Capa | Herramienta | Uso |
|------|-------------|-----|
| **Unit Tests** | Vitest + jsdom | Lógica de negocio (CEFR, costos, utilities) |
| **Component Tests** | React Testing Library | Componentes React aislados |
| **E2E Tests** | Playwright | Flujos completos de usuario |
| **Type Check** | TypeScript (`tsc --noEmit`) | Cero errores de tipos en CI |
| **Lint** | ESLint (Next.js) | Consistencia de código |
| **CI** | GitHub Actions | Automatización en cada PR/push |
| **CD** | Vercel | Deploy automático + Preview URLs |
| **DB Migrations** | Supabase CLI | Control de versiones de base de datos |

---

## 🎯 Comandos Disponibles

```bash
# Desarrollo
npm run dev              # Inicia servidor de desarrollo

# Testing
npm run test             # Ejecuta tests unitarios (Vitest, watch mode)
npm run test -- --run    # Ejecuta tests unitarios (una sola vez)
npm run test:ui          # Ejecuta tests con UI interactiva
npm run test:e2e         # Ejecuta tests E2E (Playwright)
npm run test:e2e:ui      # Ejecuta E2E con UI interactiva

# Calidad de código
npm run lint             # Ejecuta ESLint
npm run typecheck        # Verifica tipos TypeScript
npm run ci               # Ejecuta TODO: lint + typecheck + tests + build

# Build
npm run build            # Build de producción
```

---

## 🔄 Flujo de Trabajo (Git)

```
main     ──────────────────────────────────────► producción (Vercel)
            │
            └──► feature/nueva-funcion ──► PR ──► Preview URL
            │
            └──► fix/correccion-bug ────► PR ──► Preview URL
```

### Reglas:
1. **Nunca hagas push directo a `main`**
2. Crea una rama: `git checkout -b feature/descripcion`
3. Abre un Pull Request
4. CI corre automáticamente: lint → typecheck → unit tests → build → E2E tests
5. Solo mergea cuando todos los checks pasen ✅

---

## 🧪 Tests Implementados

### Unit Tests (`src/lib/__tests__/`)`

| Archivo | Qué testea |
|---------|-----------|
| `cefr-evaluator.test.ts` | Evaluación CEFR, penalización por clarificaciones, technical jargon |
| `cost-calculator.test.ts` | Cálculo de costos Claude, proyecciones mensuales, eficiencia |

### E2E Tests (`e2e/`)`

| Archivo | Qué testea |
|---------|-----------|
| `demo.spec.ts` | Landing page → Demo → Conversación → CEFR assessment |

---

## 🏗️ Pipeline de CI (GitHub Actions)

El workflow `.github/workflows/ci.yml` se ejecuta en cada push/PR y tiene 4 jobs:

### Job 1: `test` — Lint + TypeCheck + Unit Tests
- Corre ESLint
- Verifica tipos TypeScript (`tsc --noEmit`)
- Ejecuta tests unitarios con coverage
- Sub artefacto de coverage

### Job 2: `build` — Build Verification
- Dependiente del job `test` (solo corre si pasa)
- Build de Next.js para verificar que no hay errores de build

### Job 3: `e2e` — Playwright Tests
- Dependiente del job `build`
- Instala browsers de Playwright
- Corre tests E2E en Chromium
- Sub reporte HTML

### Job 4: `migrations` — Supabase Migrations Check
- Verifica que existe directorio `migrations/`
- Chequea que no hay conflictos de merge en archivos SQL

---

## 🗄️ Supabase Migrations

### Estructura esperada:
```
migrations/
├── 001_initial_schema.sql
├── 002_auth_and_profiles.sql
└── 003_lesson_tracking.sql
```

### Comandos Supabase CLI:
```bash
# Instalar CLI
npm install -g supabase

# Inicializar (ya hecho)
supabase init

# Crear nueva migration
supabase migration new nombre_de_cambio

# Aplicar en local (resetea la DB)
supabase db reset

# Aplicar en producción
supabase db push

# Generar types desde la DB
supabase gen types typescript --project-id <ref> --schema public > src/types/database.ts
```

---

## 🔐 Secrets Requeridos (GitHub)

Configura estos secrets en **Settings → Secrets and variables → Actions**:

| Secret | Descripción |
|--------|-------------|
| `ANTHROPIC_API_KEY` | API key de Claude (para build) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key de Supabase |
| `SUPABASE_ACCESS_TOKEN` | Token de acceso de Supabase CLI (opcional, para db push) |

---

## 🚀 Despliegue

### Producción (Vercel)
1. Conecta tu repo de GitHub a Vercel
2. Configura las variables de entorno en Vercel
3. Cada push a `main` hace deploy automático
4. Cada PR genera una **Preview URL** única

### Variables de Entorno por Entorno:
```
Production:  spiko.ai
Preview:     https://spiko-ai-git-<branch>.vercel.app
Local:       http://localhost:3000
```

---

## 📊 Coverage

Los tests unitarios generan un reporte de coverage en `coverage/`. El workflow sube esto como artefacto en cada run.

```bash
# Ver coverage local
npm run test -- --run --coverage
# Abre coverage/index.html en tu navegador
```

---

## 🆘 Troubleshooting

### "Tests fallan en CI pero pasan local"
- Verifica que no hayas olvidado hacer `npm install`
- Asegúrate de que no hay archivos no commiteados que afecten el comportamiento

### "Build falla por variables de entorno"
- Verifica que todos los `NEXT_PUBLIC_*` y secrets están configurados en GitHub
- Recuerda que `NEXT_PUBLIC_*` variables se inyectan en build time

### "Playwright tests fallan"
- Ejecuta localmente: `npx playwright test --ui`
- Revisa que el servidor dev esté corriendo: `npm run dev`
- Actualiza browsers: `npx playwright install`

---

## 📁 Estructura del Pipeline

```
spiko-mvp/
├── .github/
│   └── workflows/
│       └── ci.yml              # Pipeline principal
├── e2e/
│   └── demo.spec.ts            # Tests E2E con Playwright
├── src/
│   ├── lib/
│   │   └── __tests__/          # Tests unitarios
│   │       ├── cefr-evaluator.test.ts
│   │       └── cost-calculator.test.ts
│   └── test/
│       └── setup.ts            # Setup de Vitest
├── vitest.config.ts            # Configuración Vitest
├── playwright.config.ts        # Configuración Playwright
└── PIPELINE.md                 # Este documento
```
