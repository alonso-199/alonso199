# Cómo generar el archivo APK

La app está configurada para generar un APK con **EAS Build** (Expo Application Services).

## Si te dice "npx no se reconoce"

Node.js está instalado pero **no está en el PATH**. Tenés dos opciones:

### Opción A: Usar el script que ya incluye Node (recomendado)

1. En el Explorador de archivos, andá a la carpeta del proyecto:  
   `C:\Users\pc1\Desktop\rork-margen-bruto-main\rork-margen-bruto-main`
2. **Doble clic** en **`build-apk.bat`**
3. Se abrirá una ventana negra: primero te pedirá iniciar sesión en Expo, después iniciará el build del APK.

### Opción B: Agregar Node al PATH para siempre

1. En la carpeta del proyecto, **clic derecho** en **`agregar-node-al-path.ps1`** → "Ejecutar con PowerShell".
2. Si Windows pide confirmación, aceptá.
3. **Cerrá todas las ventanas** de PowerShell y de Cursor y volvé a abrirlas.
4. Después de eso, en una terminal nueva podés usar:  
   `npx eas login` y `npm run build:apk`.

---

## Requisitos

1. **Cuenta de Expo** (gratuita): [expo.dev/signup](https://expo.dev/signup)
2. **Node.js** instalado desde [nodejs.org](https://nodejs.org) (versión LTS)
3. **EAS CLI** (se ejecuta con `npx eas`; no hace falta instalarlo aparte)

## Pasos para crear el APK

### 1. Instalar EAS CLI (opcional, si querés usarlo globalmente)

```bash
npm install -g eas-cli
```

Si no lo instalás, podés usar `npx eas` en los comandos siguientes.

### 2. Iniciar sesión en Expo

```bash
npx eas login
```

(Te pedirá usuario y contraseña de tu cuenta Expo.)

### 3. Configurar el proyecto (solo la primera vez)

```bash
npx eas build:configure
```

Aceptá la configuración por defecto si ya tenés el archivo `eas.json` en el proyecto.

### 4. Generar el APK

Desde la carpeta del proyecto (`rork-margen-bruto-main`):

```bash
npm run build:apk
```

o directamente:

```bash
npx eas build --platform android --profile preview
```

- El build se ejecuta en la **nube** de Expo (no necesitás Android Studio en tu PC).
- Al terminar, Expo te dará un **enlace para descargar el APK**.
- También podés ver el estado y descargar el APK desde: [expo.dev/accounts/[tu-usuario]/projects/margen-bruto-alonso/builds](https://expo.dev)

### 5. Instalar el APK en el celular

- Descargá el APK desde el enlace que te da EAS.
- En el Android, permití “Instalar desde fuentes desconocidas” para ese navegador o archivo si te lo pide.
- Abrí el archivo APK e instalá la app.

---

## Scripts disponibles en `package.json`

| Comando | Descripción |
|--------|-------------|
| `npm run build:apk` | Build de prueba (perfil **preview**), genera APK para instalar directo |
| `npm run build:apk:prod` | Build de **producción** (perfil **production**), también genera APK |

---

## Build local (sin EAS, avanzado)

Si preferís generar el APK en tu PC sin usar la nube de Expo:

1. Instalá **Android Studio** y **JDK 17**.
2. Generá el proyecto Android:
   ```bash
   npx expo prebuild --platform android
   ```
3. Entrá a la carpeta Android y generá el APK:
   ```bash
   cd android
   .\gradlew assembleRelease
   ```
4. El APK quedará en: `android/app/build/outputs/apk/release/app-release.apk`

Para instalar en dispositivos reales con build local suele ser necesario configurar firma (keystore); con EAS Build eso se gestiona desde la nube.
