# Discordia - Clientes Frontend & Mobile

Monorepositorio para las aplicaciones cliente del ecosistema Discordia:
- **Web App**: `apps/web` (React 19 + Vite + Tailwind CSS v4)
- **Mobile Android**: `apps/mobile` (React Native + Expo SDK 57 + Expo Router + NativeWind)

## Requisitos

- Node.js 20+
- npm 10+
- (Para Mobile) Expo Go en dispositivo Android o emulador de Android Studio

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

### Mobile Android
Iniciar el bundler de Expo para Mobile:

```bash
npm run dev:mobile
```

O directamente en modo Android:

```bash
npm run android
```

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
| `@discordia/api` | TypeScript puro, sin React: cliente HTTP con refresh de sesión, endpoints y tipos por recurso (`auth/`, `users/`, `servers/`, `channels/`, `roles/`, `invitations/`), cliente WebSocket y protocolo (`realtime/`) | `axios` |
| `@discordia/core` | Lógica React compartida: sesión (`AuthProvider`, `useAuth`), validaciones de formularios y el chat (`chatStore`, `useRealtimeController`, `useChannelMessages`, textos de error) | `@discordia/api`, `react` |
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
│   │       ├── features/             # auth, servers, channels, roles, invitations, profile, chat
│   │       ├── shared/               # api, session, config, hooks, ui
│   │       └── test/setup.ts
│   └── mobile/                       # Mobile Android (Expo + React Native)
│       ├── app.json, metro.config.js, tailwind.config.js
│       └── src/
│           ├── app/                  # Expo Router: solo rutas, layouts y guards
│           │   ├── (auth)/           # login y registro
│           │   └── (app)/            # rutas protegidas
│           ├── features/             # auth, servers, channels, roles, invitations, profile, chat
│           ├── shared/               # api, session, config, hooks, ui
│           └── global.css            # estilos globales NativeWind
├── packages/
│   ├── api/src/                      # @discordia/api
│   ├── core/src/                     # @discordia/core
│   └── ui/src/                       # @discordia/ui (brand, icons)
├── package.json                      # workspaces y scripts globales
└── README.md
```
