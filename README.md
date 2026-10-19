# Discordia - Clientes Frontend & Mobile

Monorepositorio para las aplicaciones cliente del ecosistema Discordia:
- **Web App**: `apps/web` (React 19 + Vite + Tailwind CSS v4)
- **Backoffice**: `apps/backoffice` (app web separada para el staff, mismo stack que la web)
- **Mobile Android**: `apps/mobile` (React Native + Expo SDK 57 + Expo Router + NativeWind)

## Requisitos

- Node.js 20+
- npm 10+
- (Para Mobile) un celular Android o el emulador de Android Studio, con Expo Go o con la app de
  desarrollo (ver [Mobile Android](#mobile-android))
- (Para compilar la app de desarrollo) Android Studio y Java 17

## Setup

Instalar dependencias de todos los workspaces desde la raíz:

```bash
npm install
```

## Comandos de Ejecución

### Frontend Web
Levantar la aplicación web en desarrollo:

```bash
npm run dev:web
```

Compilar la aplicación web (corre `tsc -b` antes de Vite, así que también hace el typecheck):

```bash
npm run build --workspace=web-app
```

Correr los tests de la web (Vitest + React Testing Library):

```bash
npm run test --workspace=web-app              # una corrida
npm run test:watch --workspace=web-app        # modo watch
npm run test --workspace=web-app -- --coverage
```

Los tests viven junto al archivo que prueban (`LoginForm.tsx` → `LoginForm.test.tsx`).
La configuración está en `apps/web/vite.config.ts` y el setup en `apps/web/src/test/setup.ts`.

### Backoffice
Panel para el staff. Es una app aparte de la web, con su propia sesión: las claves de `localStorage`
son `discordia_backoffice_*`, así que loguearse en uno no loguea en el otro.

```bash
npm run dev:backoffice                       # http://localhost:5174 (puerto fijo)
npm run build --workspace=backoffice
npm run test --workspace=backoffice
```

Creá `apps/backoffice/.env.local` (hay un `.env.example`) con la URL del gateway, **sin** `/api/v1`
porque los servicios de `@discordia/api` ya lo agregan:

```
VITE_API_URL=http://localhost:8080
```

Para entrar necesitás un usuario staff: ver el README de `identity` ("Dar el rol de staff"). El
gateway tiene que tener `http://localhost:5174` en `CORS_ALLOWED_ORIGINS`. Una cuenta sin rol staff
con la contraseña correcta ve "Esta cuenta no tiene acceso al backoffice" y no queda ninguna sesión
guardada. Ojo: ocultar pantallas en el front es solo UX; la autorización real es el 403 de los
endpoints de staff en el backend.

### Mobile Android
La app se puede abrir de dos maneras:

| | Expo Go | App de desarrollo |
| --- | --- | --- |
| Qué es | La app "Expo Go" de la Play Store | Una app "Discordia" propia, compilada con `expo-dev-client` |
| Canales de voz | No: muestran "La voz necesita la app de desarrollo." | Sí |
| Todo lo demás | Sí | Sí |
| Instalación | Ninguna | Una vez, con el celular por USB |

La voz necesita los módulos nativos de WebRTC de LiveKit, que Expo Go no trae. El resto de la app
sigue andando en Expo Go, así que quien no trabaje con la voz no necesita instalar nada.

Para el día a día, en las dos maneras, se levanta el bundler y se abre la app en el celular, que
tiene que estar en **la misma red Wi-Fi** que la computadora:

```bash
npm run dev:mobile
```

El bundler arranca en modo Expo Go (la terminal dice "Using Expo Go"): escaneá el QR con Expo Go.
**Para usar la app de desarrollo, apretá `s`** en la terminal hasta que diga "Using development
build", abrí la app "Discordia" (no Expo Go) y elegí tu computadora en la lista, o escaneá el QR
desde esa app.

Los cambios de código aparecen solos en el celular. Los del `.env` tampoco piden reinstalar nada,
pero hay que cortar el bundler y volver a levantarlo limpiando su caché, porque las variables
`EXPO_PUBLIC_*` quedan copiadas adentro del código que ya armó:

```bash
npm run dev:mobile -- -- --clear
```

(Van dos `--`: el primero se lo come `npm run dev:mobile` y el segundo hace que `--clear` llegue a
`expo start`.)

#### Instalar la app de desarrollo (una vez)
1. En el celular, activá las opciones de desarrollador (Ajustes → Acerca del teléfono → tocar 7 veces
   "Número de compilación") y la **depuración por USB**. En Samsung, el **Bloqueador automático**
   (Ajustes → Seguridad y privacidad) la bloquea: hay que desactivarlo mientras se instala.
2. Conectá el celular por USB, aceptá el aviso de depuración y comprobá que aparezca con `device`:
   ```bash
   ~/Android/Sdk/platform-tools/adb devices
   ```
3. Compilá e instalá desde `apps/mobile`, con **Java 17**. Con una versión más nueva (por ejemplo,
   la 25 que trae Android Studio) la compilación nativa falla con "A restricted method in
   java.lang.System has been called":
   ```bash
   cd apps/mobile
   export JAVA_HOME=<ruta a un JDK 17> ANDROID_HOME=~/Android/Sdk
   npx expo run:android
   ```
   Si Gradle ya descargó un JDK 17, está en `~/.gradle/jdks/`. La primera compilación tarda varios
   minutos.

`expo run:android` reescribe los scripts `android` e `ios` de `apps/mobile/package.json` y genera
`apps/mobile/android/` (ignorada por git). **No commitees ese cambio de los scripts**: descartalo con
`git checkout -- apps/mobile/package.json`.

Hay que volver a correr `npx expo run:android` solo cuando cambia algo nativo: se agrega o se
actualiza un paquete con código nativo, se tocan plugins o permisos en `app.json`, o se sube la
versión de Expo. Si después de un `git pull` solo cambió código de `src/`, alcanza con
`npm run dev:mobile`.

#### Voz en mobile: qué esperar
- **Solo Android.** No hay configuración de iOS.
- **Solo con la app en primer plano.** Volver al inicio, cambiar de app, bloquear el teléfono o que se
  apague la pantalla corta la llamada ("La llamada se cortó porque saliste de la app.") y al volver no
  reconecta. Para la demo, subí el tiempo de apagado de la pantalla. El diálogo del permiso del
  micrófono no corta la llamada.
- **Permiso bloqueado.** Si se eligió "No volver a preguntar", la app entra sin micrófono y ofrece
  "Abrir configuración", que corta la llamada porque saca a la app de primer plano.
- **LiveKit local.** Con el stack local, `LIVEKIT_URL` del `.env` de `chat-and-real-time` tiene que
  usar la IP de la computadora en la red (no `localhost`), y la key y el secret van con la misma URL:
  `devkey` / `secret` para el LiveKit local, o las del proyecto para LiveKit Cloud. Si se mezclan, la
  app muestra "La voz no está disponible en este momento.".

Correr los tests de mobile (Jest + React Native Testing Library):

```bash
npm run test --workspace=mobile-app              # una corrida
npm run test:watch --workspace=mobile-app        # modo watch
npm run test --workspace=mobile-app -- --coverage
```

Igual que en web, cada test vive junto al archivo que prueba. La configuración está en
`apps/mobile/jest.config.js`; usa el preset de Expo (`jest-expo`).

## Desarrollo local con API Gateway

La web app se comunica con el backend a través del API Gateway. Creá el archivo `apps/web/.env.local` con:

```
VITE_API_URL=http://localhost:8080/api/v1
```

### Token de desarrollo

Mientras el servicio `identity` no esté levantado, el gateway acepta tokens JWT firmados con el secreto de desarrollo. Para generar uno, abrí las DevTools del browser (F12 → Console) y pegá:

```javascript
const userId = '00000000-0000-0000-0000-000000000001';
const secret = 'local-development-secret-change-me';

const header = btoa(JSON.stringify({alg:'HS256',typ:'JWT'})).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const payload = btoa(JSON.stringify({sub: userId, exp: Math.floor(Date.now()/1000) + 86400*7})).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

const enc = new TextEncoder();
const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${payload}`));
const token = `${header}.${payload}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`;

localStorage.setItem('discordia_token', token);
localStorage.setItem('discordia_user', JSON.stringify({id: userId, username: 'devuser'}));
console.log('Token seteado:', token);
```

Recargá la página (F5). Para simular otro usuario cambiá el `userId` y volvé a ejecutarlo.

### Levantar el stack completo

```bash
# 1. API Gateway (desde api-gateway/)
docker compose up -d --build

# 2. Community (desde community/)
uvicorn app.main:app --reload --port 8000

# 3. Web app (desde web-app/)
npm run dev:web
```

## Lint, typecheck y tests de todo el monorepo

```bash
npm run lint    # ESLint en web y mobile, incluida la regla de capas
npm run test    # web, mobile y los packages
npm run test:coverage   # lo mismo, con el reporte de cobertura de cada workspace
npm run build   # build de web y typecheck de mobile y de los packages
```

## Arquitectura

### Packages: por capa, y por funcionalidad adentro

Lo que comparten web y mobile vive en `packages/`. No hay un package por servicio del backend:
el cliente ve un único `/api/v1` a través del gateway, y hay funcionalidades que cruzan servicios.
Los packages se parten por capa:

| Package | Qué tiene | Depende de |
| --- | --- | --- |
| `@discordia/api` | TypeScript puro, sin React: cliente HTTP con refresh de sesión, endpoints y tipos por recurso (`auth/`, `users/`, `servers/`, `channels/`, `roles/`, `invitations/`, `voice/`), cliente WebSocket y protocolo (`realtime/`) | `axios` |
| `@discordia/core` | Lógica React compartida: sesión (`AuthProvider`, `useAuth`), validaciones de formularios, el chat (`chatStore`, `useRealtimeController`, `useChannelMessages`, textos de error) y la voz (`useVoiceController`, la lista de la llamada y sus textos) | `@discordia/api`, `react` |
| `@discordia/ui` | Componentes con variante web y `.native` (marca, íconos) | `react` |

Cada package expone solo lo de su `src/index.ts` y tiene su propio typecheck (`npm run build`
dentro del package), con `strict` y **sin los tipos del DOM** en `api` y `core`: como también corren
en React Native, usar `window`, `document` o `localStorage` no compila. Lo que sí existe en las dos
plataformas (`FormData`, `Blob`, `setTimeout`…) está declarado en `packages/tsconfig/platform.d.ts`.
Los tests se chequean aparte (`tsconfig.test.json`), porque los tipos de Vitest traen el DOM. La lógica que combine varios recursos va en
una carpeta de funcionalidad dentro de `core`.

### Apps: `shared` → `features` → `app`

Web y mobile se organizan igual, y las dependencias van en un solo sentido:

- **`src/shared/`**: lo genérico, agrupado por tipo. `api/` instancia el cliente HTTP y **todos**
  los servicios de `@discordia/api`, así que cualquier feature puede llamar a cualquier endpoint.
  Además están la sesión (`session/`), las variables de entorno (`config/`), los hooks y la UI
  genéricos.
- **`src/features/<feature>/`**: todo lo de una funcionalidad (componentes, hooks, pantallas y
  tests). Expone su API pública en `index.ts` y **no importa de otra feature ni de `src/app`**.
- **`src/app/`**: la única capa que combina features. En web tiene el router y los layouts; en
  mobile, las rutas de Expo Router, que solo re-exportan o componen pantallas.

ESLint hace cumplir estas reglas con `import-x/no-restricted-paths`. Las zonas se arman leyendo
`src/features`, así que una feature nueva queda cubierta sin tocar la config.

## Estructura del Monorepo

```text
├── apps/
│   ├── web/                          # Web (Vite + React 19)
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app/                  # router, layouts (AppLayout, ServerPanel, RealtimeOutlet)
│   │       ├── features/             # auth, servers, channels, roles, invitations, profile, chat, voice
│   │       ├── shared/               # api, session, config, hooks, ui
│   │       └── test/setup.ts
│   ├── backoffice/                   # Backoffice de staff (Vite + React 19), puerto 5174
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── app/                  # router, StaffLayout
│   │       ├── features/             # auth (login y StaffRoute), dashboard
│   │       └── shared/               # api, session (claves discordia_backoffice_*), config
│   └── mobile/                       # Mobile Android (Expo + React Native)
│       ├── app.json, metro.config.js, tailwind.config.js
│       └── src/
│           ├── app/                  # Expo Router: solo rutas, layouts y guards
│           │   ├── (auth)/           # login y registro
│           │   └── (app)/            # rutas protegidas
│           ├── features/             # auth, servers, channels, roles, invitations, profile, chat, voice
│           ├── shared/               # api, session, config, hooks, ui
│           └── global.css            # estilos globales NativeWind
├── packages/
│   ├── api/src/                      # @discordia/api
│   ├── core/src/                     # @discordia/core
│   └── ui/src/                       # @discordia/ui (brand, icons)
├── package.json                      # workspaces y scripts globales
└── README.md
```
