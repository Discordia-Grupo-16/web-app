# Cliente realtime (@discordia/api)

Cliente WebSocket para la mensajería en tiempo real de `chat-and-real-time`, escrito como
módulo TypeScript plano sin dependencias de React ni del DOM. Lo pensado para ser reusado
tal cual desde `apps/web` (Vite) y, más adelante, desde `apps/mobile` (React Native).

## Uso

```typescript
import { createRealtimeClient } from '@discordia/api';

const client = createRealtimeClient({
    url: 'ws://localhost:8080/api/v1/ws',
    getToken: () => storage.getToken(),
});

const off = client.on('messageCreated', (frame) => { /* ... */ });
client.connect();
client.sendMessage({ channelId, content, clientMessageId: crypto.randomUUID() });
// ...
off();
client.disconnect();
```

(`crypto.randomUUID()` aparece solo en el ejemplo: generar el `clientMessageId` le toca a quien
llama. En React Native hay que buscar otra fuente de UUID.)

## Cómo viaja el token

La API `WebSocket` del navegador no permite mandar headers en el handshake, así que el token
viaja como query param: `<url>?access_token=<jwt urlencoded>`. Lo arma el propio cliente a
partir de `getToken()`.

`getToken()` se llama **en cada intento de conexión**, no solo una vez: el JWT únicamente se
valida en el handshake, así que si el token venció, la reconexión (que abre un handshake nuevo)
es lo único que lo nota. Si tu storage renovó el token, el siguiente intento ya usa el nuevo.

Un 401/403 en el handshake **no se puede distinguir desde JS** de una caída de red — el
navegador solo entrega un `close` con código 1006 sin status HTTP. El cliente trata ambos casos
igual y reintenta con backoff. Distinguir "token inválido" de "red caída" queda como deuda
conocida para CP1.

## Dependencia externa: la ruta del gateway

La ruta correcta según el contrato es `GET /api/v1/ws` (una conexión por usuario, suscripta a
servidores). **El `api-gateway` en `develop` todavía expone otra ruta** (por canal, con un path
distinto). Hasta que se
corrija ese routing, conectar contra el stack real completo (cliente → gateway → chat) no
funciona; este paquete no depende de esa ruta en particular, solo hace falta pasarle la `url`
correcta por config.

## Qué no hace (a propósito)

- No valida contenido vacío ni el largo del mensaje: esas reglas las aplica el servidor y las
  devuelve como `ErrorFrame`, para no duplicar la fuente de verdad.
- No recupera mensajes perdidos durante una desconexión (eso es SCRUM-46, CP2).
- No reintenta un `message.send` sin ack por su cuenta: emite el evento de `ack`/`errorFrame` y
  deja la decisión de reintentar a quien lo consume.
- No implementa ping/pong a mano: usa los frames de control nativos del WebSocket.

## Tests

Todavía no hay tests automatizados: el monorepo no tiene framework de testing definido. La
lista de casos a cubrir: conexión, envío, recepción, reconexión, cierre deliberado y
suscripciones.
