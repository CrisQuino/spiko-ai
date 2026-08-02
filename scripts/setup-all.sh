#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SPEECK.AI - Script Maestro de Configuración de Infraestructura
# ═══════════════════════════════════════════════════════════════════════════════
# Este script automatiza la configuración completa del pipeline:
# GitHub → GitHub Actions → Vercel → Supabase
#
# USO:
#   1. Asegúrate de tener tus credenciales a mano
#   2. Corre: bash scripts/setup-all.sh
#   3. Sigue las instrucciones en pantalla
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

function banner() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
  echo ""
}

function success() { echo -e "${GREEN}✅ $1${NC}"; }
function warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
function error()   { echo -e "${RED}❌ $1${NC}"; }
function info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }

function pause() {
  echo ""
  read -p "Presiona ENTER para continuar..."
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# 0. VALIDACIONES PREVIAS
# ═══════════════════════════════════════════════════════════════════════════════
banner "0. VALIDACIÓN DE ENTORNO"

info "Verificando herramientas base..."

if ! command -v git &> /dev/null; then
  error "Git no está instalado. Instálalo primero: https://git-scm.com/downloads"
  exit 1
fi
success "Git: $(git --version | head -1)"

if ! command -v node &> /dev/null; then
  error "Node.js no está instalado. Descárgalo de https://nodejs.org/ (versión 20+)"
  exit 1
fi
success "Node.js: $(node --version)"

if [ ! -f ".env.local" ]; then
  warning "No se encontró .env.local"
  warning "Necesitas este archivo con las variables de entorno"
  info "Ejemplo: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, etc."
  exit 1
fi
success "Archivo .env.local encontrado"

# Verificar que tiene npm (o usar npx del runtime)
if command -v npm &> /dev/null; then
  NPM="npm"
  success "npm: $(npm --version)"
elif command -v npx &> /dev/null; then
  NPM="npx"
  success "npx disponible (usando como fallback)"
else
  warning "npm/npx no encontrado. Intentando instalar..."
  # En Windows/Git Bash, node puede estar en el PATH pero npm no
  # Intentamos encontrar npm junto al node
  NODE_DIR="$(dirname "$(which node)")"
  if [ -f "$NODE_DIR/npm" ]; then
    NPM="$NODE_DIR/npm"
    success "npm encontrado en: $NPM"
  elif [ -f "$NODE_DIR/npm.cmd" ]; then
    NPM="$NODE_DIR/npm.cmd"
    success "npm.cmd encontrado en: $NPM"
  else
    error "No se pudo encontrar npm. Instala Node.js correctamente desde https://nodejs.org/"
    exit 1
  fi
fi

pause

# ═══════════════════════════════════════════════════════════════════════════════
# 1. INSTALAR CLIs NECESARIAS
# ═══════════════════════════════════════════════════════════════════════════════
banner "1. INSTALANDO CLIs (GitHub, Vercel, Supabase)"

bash scripts/install-clis.sh "$NPM"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# 2. CONFIGURAR GIT Y GITHUB
# ═══════════════════════════════════════════════════════════════════════════════
banner "2. CONFIGURANDO GITHUB"

bash scripts/setup-github.sh

pause

# ═══════════════════════════════════════════════════════════════════════════════
# 3. CONFIGURAR SUPABASE
# ═══════════════════════════════════════════════════════════════════════════════
banner "3. CONFIGURANDO SUPABASE"

bash scripts/setup-supabase.sh

pause

# ═══════════════════════════════════════════════════════════════════════════════
# 4. CONFIGURAR VERCEL
# ═══════════════════════════════════════════════════════════════════════════════
banner "4. CONFIGURANDO VERCEL (Hosting + CD)"

bash scripts/setup-vercel.sh

pause

# ═══════════════════════════════════════════════════════════════════════════════
# 5. CONFIGURAR PRE-COMMIT HOOKS
# ═══════════════════════════════════════════════════════════════════════════════
banner "5. CONFIGURANDO GIT HOOKS (Pre-commit + Pre-push)"

bash scripts/setup-hooks.sh

pause

# ═══════════════════════════════════════════════════════════════════════════════
# 6. PRIMER PUSH Y VERIFICACIÓN
# ═══════════════════════════════════════════════════════════════════════════════
banner "6. PRIMER PUSH Y VERIFICACIÓN"

info "Haciendo primer commit de todo el pipeline..."

git add -A
git commit -m "🔧 ci: setup complete pipeline (Vitest, Playwright, GitHub Actions, Vercel, Supabase)" || warning "No hay cambios nuevos para commitear"

info "Haciendo push a origin main..."
git push -u origin main || warning "Push falló o ya existe"

success "¡Pipeline configurado! 🎉"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  CONFIGURACIÓN COMPLETA${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Próximos pasos:${NC}"
echo ""
echo "  1. Ve a GitHub y verifica que el workflow CI está corriendo:"
echo -e "     ${BLUE}https://github.com/TU_USUARIO/spiko-ai/actions${NC}"
echo ""
echo "  2. Ve a Vercel y verifica el deploy:"
echo -e "     ${BLUE}https://vercel.com/dashboard${NC}"
echo ""
echo "  3. Ve a Supabase y verifica las migraciones:"
echo -e "     ${BLUE}https://supabase.com/dashboard${NC}"
echo ""
echo -e "  ${YELLOW}Comandos útiles:${NC}"
echo "    npm run dev          # Desarrollo local"
echo "    npm run test         # Tests unitarios"
echo "    npm run test:e2e     # Tests E2E"
echo "    npm run ci           # Todo el pipeline local"
echo "    git push             # Trigger automático de CI/CD"
echo ""
