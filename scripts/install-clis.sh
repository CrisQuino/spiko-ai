#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Instalador de CLIs: gh, vercel, supabase
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

info "Detectando sistema operativo..."

IS_WINDOWS=false
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  IS_WINDOWS=true
  info "Windows detectado (Git Bash)"
else
  info "Unix-like detectado"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 1. GITHUB CLI (gh)
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- GitHub CLI (gh) ---${NC}"

if command -v gh &> /dev/null; then
  success "gh ya está instalado: $(gh --version | head -1)"
else
  warning "gh no está instalado. Instalando..."
  
  if [ "$IS_WINDOWS" = true ]; then
    # Windows: usar winget o descargar directamente
    info "Descargando gh para Windows..."
    if command -v winget &> /dev/null; then
      winget install --id GitHub.cli || warning "winget falló, intentando método alternativo..."
    else
      # Descargar manualmente
      GH_URL="https://github.com/cli/cli/releases/latest/download/gh_2.53.0_windows_amd64.zip"
      TEMP_DIR="$TEMP/gh-install"
      mkdir -p "$TEMP_DIR"
      curl -L -o "$TEMP_DIR/gh.zip" "$GH_URL" 2>/dev/null || {
        error "No se pudo descargar gh. Descárgalo manualmente de: https://cli.github.com/"
        echo ""
        echo "Alternativa: Ve a https://github.com/cli/cli/releases y descarga el .exe"
        exit 1
      }
    fi
  else
    # macOS / Linux
    if command -v brew &> /dev/null; then
      brew install gh
    elif command -v apt &> /dev/null; then
      curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
      sudo apt update && sudo apt install gh -y
    else
      error "No se pudo instalar gh automáticamente."
      info "Ve a https://cli.github.com/ e instálalo manualmente"
      exit 1
    fi
  fi
  
  if command -v gh &> /dev/null; then
    success "gh instalado: $(gh --version | head -1)"
  else
    error "gh no se instaló correctamente"
    exit 1
  fi
fi

info "Autenticando con GitHub..."
if ! gh auth status &> /dev/null; then
  warning "No estás autenticado con GitHub CLI"
  info "Ejecuta: gh auth login"
  info "Sigue las instrucciones (recomendado: HTTPS + navegador)"
  gh auth login
fi
success "Autenticado con GitHub"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. SUPABASE CLI
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Supabase CLI ---${NC}"

if command -v supabase &> /dev/null; then
  success "supabase ya está instalado: $(supabase --version | head -1)"
else
  warning "supabase CLI no está instalado. Instalando..."
  
  if [ "$IS_WINDOWS" = true ]; then
    info "Para Windows, instala con npm: npm install -g supabase"
    if command -v npm &> /dev/null; then
      npm install -g supabase
    elif command -v npx &> /dev/null; then
      npx supabase --version &> /dev/null || npm install -g supabase
    else
      error "npm no disponible. Descarga Supabase CLI manualmente:"
      info "https://github.com/supabase/cli/releases"
      exit 1
    fi
  else
    # macOS / Linux
    if command -v brew &> /dev/null; then
      brew install supabase/tap/supabase
    else
      curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
    fi
  fi
  
  if command -v supabase &> /dev/null; then
    success "supabase instalado: $(supabase --version | head -1)"
  else
    error "supabase CLI no se instaló correctamente"
    exit 1
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 3. VERCEL CLI
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Vercel CLI ---${NC}"

if command -v vercel &> /dev/null; then
  success "vercel ya está instalado: $(vercel --version | head -1)"
else
  warning "vercel CLI no está instalado. Instalando..."
  
  if command -v npm &> /dev/null; then
    npm install -g vercel
  elif command -v npx &> /dev/null; then
    info "Instalando vercel globalmente..."
    npx install -g vercel || npm install -g vercel
  else
    error "npm no disponible. Descarga Vercel CLI manualmente:"
    info "https://vercel.com/download"
    exit 1
  fi
  
  if command -v vercel &> /dev/null; then
    success "vercel instalado: $(vercel --version | head -1)"
  else
    error "vercel CLI no se instaló correctamente"
    exit 1
  fi
fi

info "Autenticando con Vercel..."
if ! vercel whoami &> /dev/null; then
  warning "No estás autenticado con Vercel"
  info "Ejecuta: vercel login"
  vercel login
fi
success "Autenticado con Vercel"

echo ""
success "¡Todas las CLIs están instaladas y autenticadas!"
