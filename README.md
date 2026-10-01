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

Compilar la aplicación web:

```bash
npm run build:web
```

Correr los tests de la web (Vitest + React Testing Library):

```bash
npm run test --workspace=web-app              # una corrida
npm run test:watch --workspace=web-app        # modo watch
npm run test --workspace=web-app -- --coverage
```

Los tests viven junto al archivo que prueban (`loginForm.tsx` → `loginForm.test.tsx`).
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

## Estructura del Monorepo

```text
├── apps/
│   ├── web/                      # Frontend Web (Vite + React 19)
│   │   ├── src/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── mobile/                   # Frontend Mobile Android (Expo + React Native)
│       ├── assets/
│       ├── src/
│       │   ├── app/              # Expo Router (Rutas, layouts, session guard)
│       │   │   ├── (auth)/       # Rutas de login y registro
│       │   │   ├── (app)/        # Rutas protegidas con guard de sesión
│       │   │   ├── _layout.tsx
│       │   │   └── index.tsx
│       │   ├── context/          # Contexto de autenticación y sesión
│       │   ├── services/         # Cliente API (Axios) y SecureStore (JWT)
│       │   ├── constants/        # Configuración y URLs de backend
│       │   └── global.css        # Estilos globales NativeWind
│       ├── app.json              # Configuración Expo orientada a Android
│       ├── metro.config.js       # Configuración Metro con NativeWind
│       ├── tailwind.config.js    # Configuración de Tailwind para Mobile
│       └── package.json
├── packages/
│   └── ui/                       # Componentes compartidos Web & Mobile (@discordia/ui)
│       ├── src/
│       │   ├── DiscordiaMark.tsx        # Versión Web (DOM SVG)
│       │   ├── DiscordiaMark.native.tsx # Versión Mobile (react-native-svg)
│       │   ├── constants.ts             # Path, viewBox y colores compartidos
│       │   └── index.ts
│       └── package.json
├── package.json                  # Workspaces y scripts globales
└── README.md
```
