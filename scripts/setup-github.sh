#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Configuración de GitHub: Repo, Secrets, Branch Protection
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

# Verificar que gh está autenticado
if ! gh auth status &> /dev/null; then
  error "No estás autenticado con GitHub CLI"
  info "Ejecuta primero: gh auth login"
  exit 1
fi

# Obtener el usuario de GitHub
GH_USER=$(gh api user -q '.login' 2>/dev/null || echo "")
if [ -z "$GH_USER" ]; then
  error "No se pudo obtener tu usuario de GitHub"
  exit 1
fi
success "Usuario GitHub detectado: $GH_USER"

REPO_NAME="spiko-ai"
REPO_URL="https://github.com/$GH_USER/$REPO_NAME"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. INICIALIZAR GIT (si no está)
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Inicializando Git ---${NC}"

if [ ! -d ".git" ]; then
  info "Inicializando repositorio git..."
  git init
  git branch -M main
  success "Repositorio git inicializado"
else
  success "Repositorio git ya existe"
fi

# Configurar git user (si no está configurado)
if [ -z "$(git config --global user.name 2>/dev/null || true)" ]; then
  warning "Git user.name no configurado"
  read -p "Ingresa tu nombre para git commits: " GIT_NAME
  git config --global user.name "$GIT_NAME"
fi

if [ -z "$(git config --global user.email 2>/dev/null || true)" ]; then
  warning "Git user.email no configurado"
  read -p "Ingresa tu email para git commits: " GIT_EMAIL
  git config --global user.email "$GIT_EMAIL"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. CREAR REPO EN GITHUB (si no existe)
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Creando repositorio en GitHub ---${NC}"

if gh repo view "$GH_USER/$REPO_NAME" &> /dev/null; then
  warning "El repositorio $GH_USER/$REPO_NAME ya existe"
  info "Usando repositorio existente"
else
  info "Creando repositorio $REPO_NAME en GitHub..."
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push || {
    warning "No se pudo crear automáticamente. Creando manualmente..."
    gh repo create "$REPO_NAME" --public
    git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git" 2>/dev/null || true
  }
  success "Repositorio creado: $REPO_URL"
fi

# Asegurar que origin está configurado
if ! git remote get-url origin &> /dev/null; then
  git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
  success "Remote 'origin' configurado"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. CONFIGURAR SECRETS EN GITHUB
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Configurando Secrets de GitHub ---${NC}"

info "Leyendo variables de entorno desde .env.local..."

# Función para extraer valor de .env.local
get_env_value() {
  local key="$1"
  local value=""
  if [ -f ".env.local" ]; then
    value=$(grep "^${key}=" .env.local | head -1 | cut -d'=' -f2- | sed 's/^["'"'"']*//;s/["'"'"']*$//' || true)
  fi
  echo "$value"
}

# Extraer valores
ANTHROPIC_KEY=$(get_env_value "ANTHROPIC_API_KEY")
SUPABASE_URL=$(get_env_value "NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON=$(get_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE=$(get_env_value "SUPABASE_SERVICE_ROLE_KEY")

# Pedir valores faltantes
if [ -z "$ANTHROPIC_KEY" ]; then
  warning "ANTHROPIC_API_KEY no encontrado en .env.local"
  read -s -p "Ingresa tu ANTHROPIC_API_KEY: " ANTHROPIC_KEY
  echo ""
fi

if [ -z "$SUPABASE_URL" ]; then
  warning "NEXT_PUBLIC_SUPABASE_URL no encontrado en .env.local"
  read -p "Ingresa tu NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
fi

if [ -z "$SUPABASE_ANON" ]; then
  warning "NEXT_PUBLIC_SUPABASE_ANON_KEY no encontrado en .env.local"
  read -s -p "Ingresa tu NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON
  echo ""
fi

info "Configurando secrets en GitHub..."

# Función para setear secret
set_secret() {
  local name="$1"
  local value="$2"
  if [ -n "$value" ]; then
    echo "$value" | gh secret set "$name" --repo "$GH_USER/$REPO_NAME" 2>/dev/null && success "Secret '$name' configurado" || warning "No se pudo configurar '$name'"
  else
    warning "Secret '$name' está vacío, saltando..."
  fi
}

set_secret "ANTHROPIC_API_KEY" "$ANTHROPIC_KEY"
set_secret "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
set_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON"
set_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE"

# ═══════════════════════════════════════════════════════════════════════════════
# 4. PROTEGER LA RAMA MAIN
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Configurando protección de rama main ---${NC}"

info "Configurando reglas de protección para 'main'..."

# Crear ruleset de protección vía API
gh api "repos/$GH_USER/$REPO_NAME/rulesets" \
  --method POST \
  --header "Accept: application/vnd.github+json" \
  --field "name=Protect main branch" \
  --field "enforcement=active" \
  --field "target=branch" \
  --field "conditions={\"ref_name\":{\"include\":[\"~DEFAULT_BRANCH\"],\"exclude\":[]}}" \
  --field "rules={\"required_status_checks\":{\"required_status_checks\":[{\"context\":\"Lint / TypeCheck / Unit Tests\",\"integration_id\":0}]},\"pull_request\":{\"dismiss_stale_reviews_on_push\":true,\"require_code_owner_review\":false,\"require_last_push_approval\":false,\"required_approving_review_count\":1,\"required_review_thread_resolution\":false},\"required_signatures\":false,\"strict_required_status_checks_policy\":true}" \
  2>/dev/null && success "Protección de rama configurada" || warning "No se pudo configurar protección automática (configúrala manualmente en GitHub)"

info ""
info "NOTA: Ve a GitHub → Settings → Branches → Add rule para 'main'"
info "Recomendado activar:"
info "  ✓ Require a pull request before merging"
info "  ✓ Require status checks to pass"
info "  ✓ Restrict pushes that create files larger than 100MB"

echo ""
success "GitHub configurado: $REPO_URL"
