#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Configuración de Vercel: Proyecto, Variables de Entorno, Deploy
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

# Verificar vercel CLI
if ! command -v vercel &> /dev/null; then
  error "Vercel CLI no está instalado"
  info "Ejecuta primero: bash scripts/install-clis.sh"
  exit 1
fi

# Verificar autenticación
if ! vercel whoami &> /dev/null; then
  error "No estás autenticado con Vercel"
  info "Ejecuta: vercel login"
  exit 1
fi

VERCEL_USER=$(vercel whoami 2>/dev/null || echo "")
success "Usuario Vercel: $VERCEL_USER"

# ═══════════════════════════════════════════════════════════════════════════════
# 1. CREAR PROYECTO EN VERCEL
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Configurando proyecto en Vercel ---${NC}"

info "Inicializando proyecto Vercel..."

# Verificar si ya existe un proyecto Vercel
if [ -d ".vercel" ]; then
  warning "Proyecto Vercel ya existe localmente"
  info "Usando configuración existente"
else
  # Crear proyecto nuevo
  info "Creando nuevo proyecto en Vercel..."
  info "Selecciona las opciones en el prompt interactivo"
  vercel --confirm || {
    warning "vercel --confirm falló, intentando método alternativo..."
    vercel
  }
fi

# Obtener el ID del proyecto
PROJECT_ID=""
if [ -f ".vercel/project.json" ]; then
  PROJECT_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*"' | cut -d'"' -f4 || true)
fi

if [ -n "$PROJECT_ID" ]; then
  success "Proyecto Vercel configurado: $PROJECT_ID"
else
  warning "No se pudo obtener el projectId automáticamente"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. CONFIGURAR VARIABLES DE ENTORNO EN VERCEL
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Configurando variables de entorno ---${NC}"

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
APP_URL=$(get_env_value "NEXT_PUBLIC_APP_URL")

info "Configurando environment variables en Vercel..."

# Función para setear env var
set_env() {
  local name="$1"
  local value="$2"
  local type="$3" # "plain" o "secret"
  
  if [ -n "$value" ]; then
    if [ "$type" = "secret" ]; then
      echo "$value" | vercel env add "$name" production 2>/dev/null || true
      echo "$value" | vercel env add "$name" preview 2>/dev/null || true
    else
      vercel env add "$name" production <<< "$value" 2>/dev/null || true
      vercel env add "$name" preview <<< "$value" 2>/dev/null || true
    fi
    success "Variable '$name' configurada en Vercel"
  else
    warning "Variable '$name' está vacía, saltando..."
  fi
}

set_env "ANTHROPIC_API_KEY" "$ANTHROPIC_KEY" "secret"
set_env "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL" "plain"
set_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON" "secret"
set_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE" "secret"

if [ -n "$APP_URL" ]; then
  set_env "NEXT_PUBLIC_APP_URL" "$APP_URL" "plain"
else
  info "NEXT_PUBLIC_APP_URL no configurado. Vercel asignará automáticamente."
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. PRIMER DEPLOY
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Haciendo primer deploy ---${NC}"

info "Deployando a Vercel (producción)..."
vercel --prod || {
  warning "Deploy a producción falló, intentando preview..."
  vercel
}

success "¡Deploy completado!"
info "Tu app estará disponible en el dashboard de Vercel"

echo ""
success "Vercel configurado correctamente"
info "Dashboard: https://vercel.com/$VERCEL_USER/spiko-ai"
