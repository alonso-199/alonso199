@echo off
title Build APK - Margen Bruto
cd /d "%~dp0"

:: Agregar Node.js al PATH para esta ventana (ruta comun en Windows)
set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

:: Usar EAS sin Git (no requiere instalar Git)
set "EAS_NO_VCS=1"

:: Decirle a EAS donde esta el proyecto (evita errores de ruta)
set "EAS_PROJECT_ROOT=%~dp0"
if "%EAS_PROJECT_ROOT:~-1%"=="\" set "EAS_PROJECT_ROOT=%EAS_PROJECT_ROOT:~0,-1%"

:: Si Node esta en otra ubicacion, descomenta y ajusta una de estas lineas:
:: set "NODE_PATH=%LOCALAPPDATA%\Programs\node"
:: set "NODE_PATH=%ProgramFiles(x86)%\nodejs"

echo Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: No se encuentra Node.js.
    echo Instala Node.js desde https://nodejs.org y asegurate de marcar "Add to PATH".
    pause
    exit /b 1
)

node --version
echo.

echo Instalando dependencias del proyecto (puede tardar la primera vez)...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERROR al instalar dependencias. Revisa el mensaje de arriba.
    pause
    exit /b 1
)
echo.

echo Iniciando build del APK...
echo.
echo Si aun no iniciaste sesion en Expo, durante el proceso te pedira:
echo   - Abrir el navegador para ingresar con tu cuenta Expo, o
echo   - Usuario y contrasena de expo.dev
echo.
echo Puede tardar varios minutos. Espera hasta que termine.
echo.

call npx eas-cli build --platform android --profile preview

echo.
if errorlevel 1 (
    echo El build fallo. Revisa el mensaje de arriba.
    echo.
    echo Consejos:
    echo - Crea una cuenta gratis en https://expo.dev/signup si no tenes.
    echo - Para iniciar sesion aparte, abre PowerShell en esta carpeta y ejecuta: npx eas-cli login
    echo   Luego vuelve a ejecutar este build-apk.bat
) else (
    echo Si el build termino bien, en la pagina de Expo te dara un enlace para descargar el APK.
)
echo.
pause
