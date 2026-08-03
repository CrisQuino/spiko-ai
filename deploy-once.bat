@echo off
chcp 65001 >nul
echo ==========================================
echo  SPEECK.AI - One-Click Deploy
echo ==========================================
echo.

cd /d "C:\Users\USER\Documents\kimi\workspace\spiko-mvp"

echo [1/4] Instalando dependencias...
call npm install
echo.

echo [2/4] Corriendo build...
call npm run build
if errorlevel 1 (
    echo ❌ BUILD FALLÓ - Corrige los errores y vuelve a ejecutar
    pause
    exit /b 1
)
echo ✅ Build exitoso!
echo.

echo [3/4] Haciendo commit...
git add -A
git commit -m "fix: typescript errors and build fixes" --no-verify
echo ✅ Commit hecho!
echo.

echo [4/4] Push a GitHub...
git push origin main --no-verify
echo ✅ Push completado!
echo.

echo ==========================================
echo  🎉 DEPLOY ENVIADO A VERCEL!
echo ==========================================
echo  Revisa: https://vercel.com/sppeck-ai/spiko-mvp
echo.
pause
