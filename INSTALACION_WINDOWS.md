# 🪟 SPIKO.AI - Guía de Instalación para Windows

## ⚠️ Prerequisitos: Instalar Node.js

Si ves el error "npm no se reconoce como un comando...", necesitas instalar Node.js primero.

---

## 📥 Paso 1: Instalar Node.js

### Opción A: Instalador Oficial (Recomendado)

1. **Descargar Node.js:**
   - Ve a: https://nodejs.org/
   - Descarga la versión **LTS** (Long Term Support)
   - Versión recomendada: **v20.x.x** o superior
   - Archivo: `node-v20.x.x-x64.msi` (~50 MB)

2. **Ejecutar el instalador:**
   - Doble clic en el archivo `.msi`
   - Click "Next" → "Next" → "Next"
   - ✅ Asegúrate que estas opciones estén marcadas:
     - ☑️ Node.js runtime
     - ☑️ npm package manager
     - ☑️ Add to PATH
   - Click "Install"
   - Espera 2-3 minutos
   - Click "Finish"

3. **Verificar instalación:**
   - Abre **PowerShell** o **CMD** (nueva ventana)
   - Ejecuta:
   ```bash
   node --version
   # Debería mostrar: v20.x.x
   
   npm --version
   # Debería mostrar: 10.x.x
   ```

### Opción B: Usando winget (Windows 11)

Si tienes Windows 11, puedes usar winget:

```powershell
# Abrir PowerShell como Administrador
winget install OpenJS.NodeJS.LTS
```

---

## 📦 Paso 2: Extraer el Proyecto

### Opción A: Usando 7-Zip (si tienes)

1. Descargar 7-Zip: https://www.7-zip.org/
2. Click derecho en `spiko-mvp.tar.gz`
3. 7-Zip → Extract Here
4. Aparecerá la carpeta `spiko-mvp/`

### Opción B: Usando PowerShell

```powershell
# Navegar a donde descargaste el archivo
cd Downloads

# Extraer (requiere PowerShell 7 o superior)
tar -xzf spiko-mvp.tar.gz

# Navegar al proyecto
cd spiko-mvp
```

### Opción C: Extraer manualmente

Si tar no funciona, te voy a crear una versión .zip:

```powershell
# Le voy a crear un archivo .zip en lugar de .tar.gz
```

---

## 🚀 Paso 3: Instalar Dependencias

```powershell
# Asegúrate de estar dentro de la carpeta spiko-mvp
cd spiko-mvp

# Instalar dependencias (tarda 2-3 minutos)
npm install

# Espera a ver este mensaje:
# "added XXX packages in XXs"
```

**⚠️ Posibles Errores:**

### Error: "npm ERR! EACCES: permission denied"
**Solución:** Ejecuta PowerShell como Administrador

### Error: "npm ERR! network"
**Solución:** Verifica tu conexión a internet

### Error: "gyp ERR!"
**Solución:** Instala Visual Studio Build Tools
```powershell
npm install --global windows-build-tools
```

---

## ▶️ Paso 4: Ejecutar el Proyecto

```powershell
# Dentro de la carpeta spiko-mvp
npm run dev
```

Deberías ver:

```
   ▲ Next.js 14.2.0
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000

 ✓ Ready in 2.5s
```

---

## 🌐 Paso 5: Abrir en el Navegador

1. Abre tu navegador (Chrome, Edge, Firefox)
2. Ve a: **http://localhost:3000**
3. Deberías ver la landing page de SPIKO.AI
4. Prueba el demo: **http://localhost:3000/demo**

---

## 🛑 Para Detener el Servidor

En PowerShell/CMD donde está corriendo:
- Presiona: **Ctrl + C**
- Confirma: **Y** (Yes)

---

## 🔧 Troubleshooting

### Problema: Puerto 3000 ocupado

```powershell
# Error: Port 3000 is already in use
# Solución: Usar otro puerto
npm run dev -- -p 3001

# Ahora abre: http://localhost:3001
```

### Problema: Cambios no se ven

```powershell
# Borrar cache y reinstalar
rm -r .next
rm -r node_modules
npm install
npm run dev
```

### Problema: Pantalla en blanco

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Console"
3. Busca errores en rojo
4. Copia el error y búscalo en Google

---

## 📁 Estructura del Proyecto

```
spiko-mvp/
├── node_modules/        (se crea con npm install)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── demo/
│   │   │   └── page.tsx       # Demo interactivo
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── components/            # (vacío por ahora)
├── public/                    # Imágenes, etc.
├── package.json              # Dependencias
├── tsconfig.json             # Config TypeScript
├── tailwind.config.ts        # Config Tailwind
├── next.config.mjs           # Config Next.js
└── README.md                 # Documentación
```

---

## 🎨 Editar el Proyecto

### Herramientas Recomendadas:

1. **VS Code** (Gratis, mejor opción)
   - Descargar: https://code.visualstudio.com/
   - Instalar extensiones:
     - ESLint
     - Prettier
     - Tailwind CSS IntelliSense

2. **Abrir proyecto en VS Code:**
   ```powershell
   cd spiko-mvp
   code .
   ```

3. **Archivos principales a editar:**
   - `src/app/page.tsx` - Landing page
   - `src/app/demo/page.tsx` - Demo
   - `src/app/globals.css` - Estilos globales
   - `tailwind.config.ts` - Colores, fuentes

---

## 🚀 Desplegar a Internet (Gratis)

### Opción 1: Vercel (Recomendado)

```powershell
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# Sigue las instrucciones en pantalla
# Tu app estará en: https://tu-proyecto.vercel.app
```

### Opción 2: Netlify

1. Ve a: https://netlify.com
2. Arrastra la carpeta `spiko-mvp` a Netlify
3. Espera 2 minutos
4. ¡Listo! Tu app está online

---

## 📊 Comandos Útiles

```powershell
# Ver versiones instaladas
node --version
npm --version

# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Compilar para producción
npm run build

# Ejecutar en producción
npm run start

# Limpiar cache
npm cache clean --force

# Actualizar npm
npm install -g npm@latest

# Ver ayuda
npm help
```

---

## 💡 Tips para Principiantes

### 1. Usar el Terminal Correcto
- ✅ PowerShell (recomendado)
- ✅ CMD (funciona)
- ✅ Git Bash (si tienes Git)
- ❌ WSL (complica Windows)

### 2. Navegación Básica
```powershell
# Ver dónde estás
pwd

# Listar archivos
ls

# Cambiar de carpeta
cd nombre-carpeta

# Volver atrás
cd ..

# Ir a tu carpeta de usuario
cd ~
```

### 3. Copiar/Pegar en Terminal
- **Copiar:** Ctrl + C (o click derecho)
- **Pegar:** Ctrl + V (o click derecho)
- **Interrumpir:** Ctrl + C

---

## ⚡ Quick Start (Resumen)

```powershell
# 1. Instalar Node.js desde nodejs.org

# 2. Verificar
node --version
npm --version

# 3. Extraer proyecto
cd Downloads
tar -xzf spiko-mvp.tar.gz
cd spiko-mvp

# 4. Instalar
npm install

# 5. Correr
npm run dev

# 6. Abrir http://localhost:3000
```

---

## 🆘 ¿Sigues con Problemas?

### Errores Comunes:

**"node no se reconoce..."**
→ Reinstala Node.js, marca "Add to PATH"

**"npm install falla"**
→ Borra `node_modules` y `package-lock.json`, intenta de nuevo

**"Pantalla en blanco"**
→ Abre DevTools (F12), revisa errores en Console

**"Puerto ocupado"**
→ Usa otro puerto: `npm run dev -- -p 3001`

---

## 📞 Ayuda Adicional

### Recursos:
- Node.js Docs: https://nodejs.org/docs
- Next.js Docs: https://nextjs.org/docs
- NPM Docs: https://docs.npmjs.com

### Videos Tutorial:
- "Como instalar Node.js en Windows" (YouTube)
- "Next.js tutorial español" (YouTube)

---

## ✅ Checklist de Instalación

Marca cada paso cuando lo completes:

- [ ] Node.js instalado (`node --version` funciona)
- [ ] NPM instalado (`npm --version` funciona)
- [ ] Proyecto extraído (carpeta `spiko-mvp` existe)
- [ ] Dependencias instaladas (`node_modules` existe)
- [ ] Servidor corriendo (`npm run dev` sin errores)
- [ ] Navegador abierto en http://localhost:3000
- [ ] Landing page se ve correctamente
- [ ] Demo funciona en /demo

**¡Cuando tengas todos ✅ estás listo!** 🎉

---

## 🎯 Siguiente Paso

Una vez que tengas todo corriendo:

1. ✅ Juega con el demo
2. ✅ Lee el código en VS Code
3. ✅ Haz cambios pequeños (colores, textos)
4. ✅ Deploy a Vercel
5. ✅ Comparte con amigos

**¡Mucha suerte!** 🚀
