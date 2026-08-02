#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Configuración de Supabase: CLI, Migrations, Types
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

# Verificar supabase CLI
if ! command -v supabase &> /dev/null; then
  error "Supabase CLI no está instalado"
  info "Ejecuta primero: bash scripts/install-clis.sh"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 1. EXTRAER REF DEL PROYECTO
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Detectando proyecto Supabase ---${NC}"

# Extraer el ref del proyecto desde la URL
SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" .env.local 2>/dev/null | cut -d'=' -f2- | sed 's/^["'"'"']*//;s/["'"'"']*$//' || true)

if [ -n "$SUPABASE_URL" ]; then
  # Extraer el project ref (la parte antes de .supabase.co)
  PROJECT_REF=$(echo "$SUPABASE_URL" | sed -n 's|https://\(.*\)\.supabase\.co|\1|p')
  if [ -n "$PROJECT_REF" ]; then
    success "Project Ref detectado: $PROJECT_REF"
  else
    warning "No se pudo extraer el project ref de la URL"
    read -p "Ingresa tu Supabase Project Ref (ej: abcdefghijklmnopqrst): " PROJECT_REF
  fi
else
  warning "No se encontró NEXT_PUBLIC_SUPABASE_URL en .env.local"
  read -p "Ingresa tu Supabase Project Ref (ej: abcdefghijklmnopqrst): " PROJECT_REF
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 2. INICIALIZAR SUPABASE EN EL PROYECTO
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Inicializando Supabase CLI ---${NC}"

if [ -f "supabase/config.toml" ]; then
  success "Supabase ya está inicializado"
else
  info "Inicializando Supabase..."
  supabase init || warning "supabase init falló (puede que ya exista)"
fi

# Link al proyecto
info "Linking al proyecto Supabase..."
supabase link --project-ref "$PROJECT_REF" || {
  warning "No se pudo link automáticamente. Configura manualmente con:"
  info "supabase link --project-ref $PROJECT_REF"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 3. VERIFICAR MIGRACIONES EXISTENTES
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Verificando migraciones ---${NC}"

if [ -d "migrations" ] && [ "$(ls -A migrations/*.sql 2>/dev/null | wc -l)" -gt 0 ]; then
  success "Migrations encontradas:"
  ls -1 migrations/*.sql
  
  info "Verificando si las migraciones están en Supabase..."
  supabase migration list 2>/dev/null || warning "No se pudo listar migraciones (autenticación requerida)"
  
  info ""
  info "Para aplicar migraciones en producción, ejecuta:"
  info "  supabase db push"
else
  warning "No se encontraron archivos de migración en migrations/"
  info "Crea tu primera migración con:"
  info "  supabase migration new initial_schema"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 4. GENERAR TYPES DE TYPESCRIPT
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Generando tipos TypeScript ---${NC}"

info "Generando types desde la base de datos..."
supabase gen types typescript --project-id "$PROJECT_REF" --schema public > src/types/database.ts 2>/dev/null && {
  success "Types generados en src/types/database.ts"
} || {
  warning "No se pudieron generar types automáticamente."
  info "Esto requiere autenticación en Supabase."
  info "Comando manual:"
  info "  supabase gen types typescript --project-id $PROJECT_REF --schema public > src/types/database.ts"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 5. CONFIGURAR .ENV PARA SUPABASE CLI
# ═══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}--- Configurando entorno local ---${NC}"

# Verificar que el anon key existe
SUPABASE_ANON=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" .env.local 2>/dev/null | cut -d'=' -f2- | sed 's/^["'"'"']*//;s/["'"'"']*$//' || true)

if [ -n "$SUPABASE_ANON" ]; then
  info "Supabase configurado con las variables de .env.local"
else
  warning "No se encontró NEXT_PUBLIC_SUPABASE_ANON_KEY"
fi

echo ""
success "Supabase configurado correctamente"
info "Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF"
info ""
info "Comandos útiles de Supabase:"
info "  supabase db push          # Aplicar migraciones en producción"
info "  supabase db reset         # Resetear DB local"
info "  supabase migration new    # Crear nueva migración"
info "  supabase start            # Iniciar Supabase local (Docker)"
