@echo off
REM ═══════════════════════════════════════════════════════════════════════════════
REM SPEECK.AI - Auto Deploy (Windows Batch)
REM Hace commit + push automático usando el token de GitHub
REM USO: doble click en deploy.bat
REM ═══════════════════════════════════════════════════════════════════════════════

cd /d "%~dp0\.."

echo.
echo ═══════════════════════════════════════════════════════════════════════════════
echo   SPEECK.AI - AUTO DEPLOY
echo ═══════════════════════════════════════════════════════════════════════════════
echo.

REM ─── LEER TOKEN ───
set "TOKEN_FILE=.github-token"
if not exist "%TOKEN_FILE%" (
  echo [ERROR] Token file no encontrado: %TOKEN_FILE%
  echo Crea el archivo con tu GitHub Personal Access Token
  pause
  exit /b 1
)

set /p TOKEN=<%TOKEN_FILE%
set TOKEN=%TOKEN: =%
set TOKEN=%TOKEN:-=%
if "!TOKEN!"=="" (
  echo [ERROR] El archivo %TOKEN_FILE% esta vacio
  pause
  exit /b 1
)

REM ─── CONFIGURAR GIT CON TOKEN ───
echo [INFO] Configurando autenticacion...
git remote remove origin-token 2>nul
git remote add origin-token "https://%TOKEN%@github.com/CrisQuino/spiko-ai.git" 2>nul || git remote set-url origin-token "https://%TOKEN%@github.com/CrisQuino/spiko-ai.git"

REM ─── ADD + COMMIT ───
echo [INFO] Agregando cambios...
git add -A
git diff --cached --quiet
if %errorlevel% == 0 (
  echo [WARN] No hay cambios para commitear
  pause
  exit /b 0
)

set COMMIT_MSG=auto: update from Kimi %date%_%time%
git commit -m "%COMMIT_MSG%"
if %errorlevel% neq 0 (
  echo [WARN] Commit fallo o no hay cambios nuevos
  pause
  exit /b 0
)
echo [OK] Commit creado

REM ─── PUSH ───
echo [INFO] Haciendo push a main...
git push origin-token main --force-with-lease
if %errorlevel% neq 0 (
  echo [ERROR] Push fallo
  pause
  exit /b 1
)
echo [OK] Push exitoso!

REM ─── LIMPIAR URL CON TOKEN ───
git remote remove origin-token 2>nul
git remote add origin "https://github.com/CrisQuino/spiko-ai.git" 2>nul

echo.
echo ═══════════════════════════════════════════════════════════════════════════════
echo   DEPLOY AUTOMATICO COMPLETADO
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo Repo:   https://github.com/CrisQuino/spiko-ai
echo Vercel: https://vercel.com/sppeck-ai/spiko-ai
echo.
echo El deploy en Vercel se activara automaticamente en 1-2 minutos
echo.
pause
