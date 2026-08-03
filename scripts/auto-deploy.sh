#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SPEECK.AI - Auto Deploy Script
# Hace commit + push automático usando el token de GitHub
# USO: bash scripts/auto-deploy.sh "mensaje del commit"
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

# ─── CONFIG ───
TOKEN_FILE=".github-token"
REPO_OWNER="CrisQuino"
REPO_NAME="spiko-ai"
BRANCH="main"

# ─── VALIDAR TOKEN ───
if [ ! -f "$TOKEN_FILE" ]; then
  error "Token file no encontrado: $TOKEN_FILE"
  info "Crea el archivo con tu GitHub Personal Access Token"
  exit 1
fi

TOKEN=$(cat "$TOKEN_FILE" | tr -d ' \n\r')
if [ -z "$TOKEN" ]; then
  error "El archivo $TOKEN_FILE está vacío"
  exit 1
fi

# ─── MENSAJE DE COMMIT ───
COMMIT_MSG="${1:-"auto: update from Kimi $(date +%Y-%m-%d_%H:%M)"}"
info "Commit message: $COMMIT_MSG"

# ─── CONFIGURAR GIT CON TOKEN ───
info "Configurando autenticación con token..."
git remote remove origin-token 2>/dev/null || true
git remote add origin-token "https://${TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git" 2>/dev/null || \
  git remote set-url origin-token "https://${TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"

# ─── ADD + COMMIT ───
info "Agregando cambios..."
git add -A

if git diff --cached --quiet; then
  warning "No hay cambios para commitear"
  exit 0
fi

git commit -m "$COMMIT_MSG" || {
  warning "Commit falló o no hay cambios nuevos"
  exit 0
}
success "Commit creado"

# ─── PUSH ───
info "Haciendo push a ${BRANCH}..."
git push origin-token "${BRANCH}" --force-with-lease
success "Push exitoso!"

# ─── LIMPIAR URL CON TOKEN (seguridad) ───
git remote remove origin-token 2>/dev/null || true
git remote add origin "https://github.com/${REPO_OWNER}/${REPO_NAME}.git" 2>/dev/null || true

# ─── STATUS ───
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOY AUTOMÁTICO COMPLETADO${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Repositorio:${NC} https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo -e "${BLUE}Vercel:${NC}     https://vercel.com/sppeck-ai/${REPO_NAME}"
echo ""
echo -e "${YELLOW}El deploy en Vercel se activará automáticamente en 1-2 minutos${NC}"
