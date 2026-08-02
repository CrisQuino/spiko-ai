#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Configuración de Git Hooks (pre-commit + pre-push)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

function success() { echo -e "${GREEN}✅ $1${NC}"; }
function warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
function error()   { echo -e "${RED}❌ $1${NC}"; }
function info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. INSTALAR HUSKY (usando npx si npm no está disponible)
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Instalando Husky ---${NC}"

if command -v npm &> /dev/null; then
  npm install -D husky lint-staged 2>/dev/null && success "husky + lint-staged instalados" || {
    warning "npm install de husky falló, intentando con npx..."
    npx husky-init 2>/dev/null || true
  }
elif command -v npx &> /dev/null; then
  npx husky-init 2>/dev/null && success "husky inicializado" || warning "npx husky-init no disponible"
else
  warning "npm/npx no disponible. Configurando hooks manualmente..."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. CREAR HOOKS MANUALMENTE (fallback si husky no se instaló)
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Creando hooks de git ---${NC}"

mkdir -p .husky

# Pre-commit hook
cat > .husky/pre-commit << 'HUSKY_EOF'
#!/usr/bin/env bash
# Pre-commit hook for SPEECK.AI
# Corre linting, type-check, y tests rápidos antes de cada commit

echo "🔍 Running pre-commit checks..."

# Check for merge conflict markers
if grep -r "<<<<<<< HEAD" src/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ Merge conflict markers found! Fix before committing."
  exit 1
fi

# Run lint
echo "📋 Running ESLint..."
npx next lint --max-warnings=0 || exit 1

# Run type check
echo "🔷 Running TypeScript type check..."
npx tsc --noEmit || exit 1

# Run unit tests (quick mode)
echo "🧪 Running unit tests..."
npx vitest run --reporter=dot || exit 1

echo "✅ All pre-commit checks passed!"
HUSKY_EOF

chmod +x .husky/pre-commit
success "Pre-commit hook creado"

# Pre-push hook
cat > .husky/pre-push << 'HUSKY_EOF'
#!/usr/bin/env bash
# Pre-push hook for SPEECK.AI
# Corre el build completo y tests E2E antes de hacer push

echo "🚀 Running pre-push checks..."

# Ensure we're on a feature branch, not main
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ]; then
  echo "⚠️  You're pushing directly to main!"
  echo "   Create a feature branch and open a PR instead."
  read -p "Are you sure you want to push to main? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Push cancelled."
    exit 1
  fi
fi

# Run full CI suite
echo "🔨 Running build..."
npx next build || exit 1

# Run E2E tests (only if Playwright is installed)
if command -v npx playwright &> /dev/null; then
  echo "🎭 Running E2E tests..."
  npx playwright test --project=chromium || exit 1
fi

echo "✅ All pre-push checks passed!"
HUSKY_EOF

chmod +x .husky/pre-push
success "Pre-push hook creado"

# ═══════════════════════════════════════════════════════════════════════════════
# 3. CONFIGURAR GIT PARA USAR LOS HOOKS
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Configurando git hooks path ---${NC}"

# Si husky está instalado, usa husky. Si no, configura manualmente.
if [ -f "node_modules/.bin/husky" ] || [ -f "node_modules/husky/bin.js" ]; then
  npx husky install 2>/dev/null || true
  success "Husky activado"
else
  # Fallback: configurar git para usar nuestros hooks
  git config core.hooksPath .husky
  success "Git hooks path configurado a .husky/"
fi

echo ""
success "Git hooks configurados!"
info ""
info "Hooks activos:"
info "  pre-commit: lint + typecheck + unit tests"
info "  pre-push:   build + E2E tests + branch protection"
info ""
info "Para saltar hooks (emergencias solo): git commit --no-verify"
