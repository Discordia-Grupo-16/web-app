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

### Mobile Android
Iniciar el bundler de Expo para Mobile:

```bash
npm run dev:mobile
```

O directamente en modo Android:

```bash
npm run android
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
